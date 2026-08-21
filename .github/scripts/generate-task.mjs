#!/usr/bin/env node
// Оркестратор: парсинг issue → промпт → LLM → валидация → генерация файлов
// → vitest → typecheck → результат.
//
// Входные env-переменные:
//   ISSUE_TITLE, ISSUE_BODY    — данные issue
//   TASKS_ROOT                  — путь к tasks/ (по умолчанию <repo>/tasks)
//   LLM_API_KEY / DEEPSEEK_API_KEY / OPENAI_API_KEY
//   LLM_BASE_URL, LLM_MODEL
//   SKIP_VITEST                 — "true" чтобы пропустить vitest
//   SKIP_BUILD                  — "true" чтобы пропустить typecheck
//
// Логи пишутся в stdout И в файл .github/_pipeline-log.md (для artifact).
// При ошибке: exit 1 + ::error:: + .github/_error.md

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseIssueBody, validateParsedIssue } from "./lib/issue-parser.mjs";
import { discoverCategories, describeCategories } from "./lib/categories.mjs";
import { loadPromptParts, buildSystemMessage, buildUserMessage } from "./lib/prompt-builder.mjs";
import { callLLM } from "./lib/llm.mjs";
import { validateTask } from "./lib/validate.mjs";
import { nextTaskNumber, writeTaskFiles, removeTaskDir, buildFileContents } from "./lib/file-generator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// .github/scripts -> .github -> корень репозитория (два уровня вверх).
const REPO_ROOT = path.resolve(__dirname, "../..");
const TASKS_ROOT = process.env.TASKS_ROOT || path.join(REPO_ROOT, "tasks");
const LOG_FILE = path.join(REPO_ROOT, ".github", "_pipeline-log.md");

// Reference-задачи для few-shot grounding (Pattern 1, хорошо оформленные).
const REFERENCE_TASKS = [
  ["sorts", "001-bubble-sort"],
  ["algorithms", "010-fibonacci"],
];

// Накапливаем логи для файла-артефакта.
const logLines = [];
let stepNum = 0;

function log(msg) {
  const ts = new Date().toISOString().slice(11, 23);
  const line = `[${ts}] ${msg}`;
  console.log(line);
  logLines.push(line);
}

function step(name) {
  stepNum++;
  log(`\n━━━ Шаг ${stepNum}: ${name} ━━━`);
}

function flushLog() {
  try {
    fs.writeFileSync(LOG_FILE, logLines.join("\n") + "\n", "utf8");
  } catch {}
}

function fail(msg) {
  log(`❌ ОШИБКА: ${msg}`);
  console.log(`::error::${msg}`);
  try {
    fs.writeFileSync(path.join(REPO_ROOT, ".github", "_error.md"), msg, "utf8");
  } catch {}
  flushLog();
  process.exit(1);
}

async function main() {
  log("🚀 Запуск AI-генерации задачи");
  log(`   REPO_ROOT: ${REPO_ROOT}`);
  log(`   TASKS_ROOT: ${TASKS_ROOT}`);
  log(`   Node: ${process.version}`);

  const title = process.env.ISSUE_TITLE || "";
  const body = process.env.ISSUE_BODY || "";

  if (!title && !body) {
    fail("Нет данных issue (ISSUE_TITLE / ISSUE_BODY не заданы).");
  }

  // ─── Шаг 1: Парсинг issue ─────────────────────────────────────────────
  step("Парсинг issue");
  log(`   Заголовок: "${title}"`);
  log(`   Тело issue: ${body.length} символов`);

  const parsed = parseIssueBody(body, title);
  log(`   Распарсено:`);
  log(`     title:       ${parsed.title || "(пусто)"}`);
  log(`     sourceUrl:   ${parsed.sourceUrl || "(пусто)"}`);
  log(`     description: ${parsed.description.length} символов`);
  log(`     userSolution: ${parsed.userSolution ? parsed.userSolution.length + " символов" : "(нет)"}`);
  log(`     notes:       ${parsed.notes || "(пусто)"}`);

  const parseErrors = validateParsedIssue(parsed);
  if (parseErrors.length) {
    fail(parseErrors.join("\n"));
  }
  log("   ✓ Валидация issue пройдена (описание есть)");

  // ─── Шаг 2: Категории ──────────────────────────────────────────────────
  step("Сканирование категорий из tasks/");
  const categories = describeCategories(TASKS_ROOT);
  const allowedTopics = discoverCategories(TASKS_ROOT);
  if (allowedTopics.length === 0) {
    fail("В tasks/ не найдено ни одной категории. Невозможно выбрать topic.");
  }
  log(`   Найдено категорий: ${allowedTopics.length}`);
  log(`   Список: ${allowedTopics.join(", ")}`);

  // ─── Шаг 3: Сборка промпта ────────────────────────────────────────────
  step("Сборка промпта");
  const { systemPrompt, projectFormat, schema } = loadPromptParts();
  log(`   system-prompt.md: ${systemPrompt.length} символов`);
  log(`   project-format.md: ${projectFormat.length} символов`);
  log(`   task-schema.json: ${JSON.stringify(schema).length} символов`);

  const systemMessage = buildSystemMessage({
    systemPrompt,
    projectFormat,
    schema,
    categories,
    tasksRoot: TASKS_ROOT,
    referenceTaskIds: REFERENCE_TASKS,
  });
  const userMessage = buildUserMessage(parsed);
  log(`   Системное сообщение: ${systemMessage.length} символов`);
  log(`   Пользовательское сообщение: ${userMessage.length} символов`);
  log(`   Модель: ${process.env.LLM_MODEL || "deepseek-chat"}`);
  log(`   Endpoint: ${process.env.LLM_BASE_URL || "https://api.deepseek.com/v1"}`);

  // ─── Шаг 4: Вызов LLM ─────────────────────────────────────────────────
  step("Вызов LLM");
  log("   Отправляю запрос...");
  let task;
  try {
    task = await callLLM({ systemMessage, userMessage });
  } catch (e) {
    fail(`Ошибка вызова LLM: ${e.message}${e.detail ? `\nДетали: ${e.detail}` : ""}`);
  }
  log(`   Получен ответ: ${JSON.stringify(task).length} символов`);
  log(`   title:       ${task.title || "(нет)"}`);
  log(`   topic:       ${task.topic || "(нет)"}`);
  log(`   slug:        ${task.slug || "(нет)"}`);
  log(`   difficulty:  ${task.difficulty || "(нет)"}`);
  log(`   exports:     ${JSON.stringify(task.exports)}`);
  log(`   tags:        ${JSON.stringify(task.tags)}`);
  log(`   examples:    ${(task.examples || []).length} шт.`);
  log(`   constraints: ${(task.constraints || []).length} шт.`);
  log(`   hints:       ${(task.hints || []).length} шт.`);
  log(`   source:      ${task.source ? task.source.url : "(нет)"}`);
  log(`   solutionCode: ${task.solutionCode?.length || 0} символов`);
  log(`   testCode:     ${task.testCode?.length || 0} символов`);
  log(`   templateCode: ${task.templateCode?.length || 0} символов`);
  log(`   condition:    ${task.condition?.length || 0} символов`);

  // ─── Шаг 5: Валидация ─────────────────────────────────────────────────
  step("Валидация JSON (schema + семантика + уникальность slug)");
  const errors = validateTask(task, { allowedTopics, tasksRoot: TASKS_ROOT });
  if (errors.length) {
    log(`   Найдено ${errors.length} ошибок валидации:`);
    for (const e of errors) log(`     • ${e}`);
    fail(
      "LLM вернул невалидный результат:\n" +
        errors.map((e) => `  - ${e}`).join("\n") +
        "\n\nСырой ответ LLM:\n" +
        JSON.stringify(task, null, 2),
    );
  }
  log("   ✓ Валидация пройдена");

  // ─── Шаг 6: Генерация файлов ──────────────────────────────────────────
  step("Генерация файлов задачи");
  const num = nextTaskNumber(TASKS_ROOT, task.topic);
  const taskId = writeTaskFiles(TASKS_ROOT, task.topic, num, task.slug, task);
  log(`   Номер задачи: ${num}`);
  log(`   Task ID: ${taskId}`);
  log(`   Branch: task/${taskId.replace("/", "-")}`);
  console.log(`::task-id::${taskId}`);
  console.log(`::branch::task/${taskId.replace("/", "-")}`);
  console.log(`::title::${task.title}`);

  // ─── Шаг 7: Vitest ────────────────────────────────────────────────────
  if (process.env.SKIP_VITEST !== "true") {
    step("Прогон vitest на сгенерированной задаче");
    log(`   Директория: ${path.join(TASKS_ROOT, taskId)}`);
    const vitestResult = await runVitest(TASKS_ROOT, taskId);
    if (!vitestResult.ok) {
      log(`   ✗ Тесты не прошли:\n${vitestResult.output}`);
      removeTaskDir(TASKS_ROOT, taskId);
      fail(`Сгенерированная задача не прошла тесты (vitest):\n${vitestResult.output}`);
    }
    log("   ✓ Vitest прошёл успешно");
  } else {
    log("   ⏭ Vitest пропущен (SKIP_VITEST=true)");
  }

  // ─── Шаг 8: Typecheck ────────────────────────────────────────────────
  if (process.env.SKIP_BUILD !== "true") {
    step("Проверка typecheck");
    const buildResult = await runTypecheck();
    if (!buildResult.ok) {
      log(`   ✗ Typecheck упал:\n${buildResult.output}`);
      removeTaskDir(TASKS_ROOT, taskId);
      fail(`Typecheck упал после добавления задачи:\n${buildResult.output}`);
    }
    log("   ✓ Typecheck прошёл успешно");
  } else {
    log("   ⏭ Typecheck пропущен (SKIP_BUILD=true)");
  }

  // ─── Шаг 9: PR preview ───────────────────────────────────────────────
  step("Генерация PR preview");
  const files = buildFileContents(task);
  const preview = buildPrPreview(task, taskId, files);
  fs.writeFileSync(path.join(REPO_ROOT, ".github", "_pr_preview.md"), preview);
  log("   ✓ PR preview записан в .github/_pr_preview.md");

  log("\n✅ Генерация завершена успешно!");
  log(`   Задача: ${taskId}`);
  log(`   Заголовок: ${task.title}`);
  flushLog();
}

/**
 * Прогон vitest через node API (как в src/lib/vitest-worker.mts),
 * чтобы нестандартное имя tests/test.ts подхватилось через include.
 */
async function runVitest(tasksRoot, taskId) {
  const taskDir = path.join(tasksRoot, taskId);
  const jsonOut = path.join(taskDir, ".vitest-result.json");
  try {
    const { startVitest } = await import("vitest/node");
    const vitest = await startVitest("test", ["tests/test.ts"], {
      root: taskDir,
      reporters: ["json"],
      outputFile: jsonOut,
      pool: "forks",
      isolate: true,
      testTimeout: 8000,
      watch: false,
      include: ["tests/test.ts"],
      config: undefined,
    });
    await vitest.close();
  } catch (e) {
    return { ok: false, output: String(e?.stack || e) };
  }

  if (!fs.existsSync(jsonOut)) {
    return { ok: false, output: "Отчёт vitest не создан (вероятно, ошибка компиляции solution.ts)." };
  }
  let report;
  try {
    report = JSON.parse(fs.readFileSync(jsonOut, "utf8"));
  } catch (e) {
    fs.rmSync(jsonOut, { force: true });
    return { ok: false, output: `Не удалось разобрать отчёт vitest: ${e.message}` };
  }
  fs.rmSync(jsonOut, { force: true });

  const failed = Number(report.numFailedTests ?? 0);
  const total = Number(report.numTotalTests ?? 0);
  if (failed > 0) {
    const failures = (report.testResults || [])
      .flatMap((tr) =>
        (tr.assertionResults || [])
          .filter((a) => a.status === "failed")
          .map((a) => `  ✗ ${a.title}: ${(a.failureMessages || []).join(" ").slice(0, 500)}`),
      )
      .join("\n");
    return { ok: false, output: `Провалено ${failed}/${total}:\n${failures}` };
  }
  return { ok: true, output: `Прошло ${total} тестов` };
}

async function runTypecheck() {
  const { execSync } = await import("node:child_process");
  try {
    execSync("npm run typecheck", { cwd: REPO_ROOT, stdio: "pipe", env: process.env });
    return { ok: true, output: "" };
  } catch (e) {
    const out = (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
    return { ok: false, output: out.slice(-3000) };
  }
}

function buildPrPreview(task, taskId, files) {
  return [
    `## Сгенерированная задача: \`${taskId}\``,
    "",
    `**Заголовок:** ${task.title}  `,
    `**Категория:** \`${task.topic}\` · **Сложность:** \`${task.difficulty}\`  `,
    `**Теги:** ${task.tags.map((t) => `\`${t}\``).join(", ")}`,
    "",
    task.source?.url ? `> Источник: [${task.source.name}](${task.source.url})` : "",
    "",
    "Сгенерировано AI из соответствующего Issue. Проверьте корректность перед merge.",
    "",
    fold("meta.json", "json", files.metaJson),
    fold("condition.md", "md", files.condition),
    fold("solution.ts", "ts", files.solution),
    fold("tests/test.ts", "ts", files.test),
    fold("template.ts", "ts", files.template),
    fold("hints.md", "md", files.hints),
  ].join("\n");
}

function fold(name, lang, content) {
  return `<details><summary>${name}</summary>\n\n\`\`\`${lang}\n${content}\`\`\`\n</details>`;
}

main().catch((e) => fail(e?.stack || String(e)));
