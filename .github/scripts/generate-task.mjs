#!/usr/bin/env node
// Orchestration: parse issue -> build prompt -> LLM -> validate
// -> generate files -> run vitest -> run typecheck/build -> emit results.
//
// Inputs (env vars):
//   ISSUE_TITLE, ISSUE_BODY    — issue data
//   TASKS_ROOT                 — path to tasks/ (default: repo root ./tasks)
//   LLM_API_KEY / DEEPSEEK_API_KEY / OPENAI_API_KEY
//   LLM_BASE_URL, LLM_MODEL
//   SKIP_VITEST                — "true" to skip vitest (local fast tests)
//   SKIP_BUILD                 — "true" to skip typecheck/build
//
// Outputs (stdout, machine-parseable by the workflow):
//   On success: lines `::task-id::`, `::branch::`, `::title::`
//   On failure: non-zero exit code + `::error::<message>` lines + `.github/_error.md`

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
// .github/scripts -> .github -> repo root (two levels up).
const REPO_ROOT = path.resolve(__dirname, "../..");
const TASKS_ROOT = process.env.TASKS_ROOT || path.join(REPO_ROOT, "tasks");

// Reference tasks for few-shot grounding (well-formed, Pattern 1).
const REFERENCE_TASKS = [
  ["sorts", "001-bubble-sort"],
  ["algorithms", "010-fibonacci"],
];

function emit(line) {
  console.log(line);
}

function fail(msg) {
  emit(`::error::${msg}`);
  // Persist full error to a file so the workflow can comment it on the issue
  // (GitHub step outputs have a 1MB limit and expression-eval quirks).
  try {
    fs.writeFileSync(path.join(REPO_ROOT, ".github", "_error.md"), msg);
  } catch {}
  process.exit(1);
}

async function main() {
  const title = process.env.ISSUE_TITLE || "";
  const body = process.env.ISSUE_BODY || "";
  if (!title && !body) {
    fail("Нет данных issue (ISSUE_TITLE / ISSUE_BODY не заданы).");
  }

  // 1. Parse issue body (free-form).
  const parsed = parseIssueBody(body, title);
  const parseErrors = validateParsedIssue(parsed);
  if (parseErrors.length) {
    fail(parseErrors.join("\n"));
  }

  // 2. Discover actual categories from tasks/.
  const categories = describeCategories(TASKS_ROOT);
  const allowedTopics = discoverCategories(TASKS_ROOT);
  if (allowedTopics.length === 0) {
    fail("В tasks/ не найдено ни одной категории. Невозможно выбрать topic.");
  }
  emit(`::info::Найдено категорий: ${allowedTopics.length}`);

  // 3. Build composed prompt + call LLM.
  //    Source URL (if any) is passed to the LLM in the user message for
  //    context — the model knows popular LeetCode tasks by slug. We do NOT
  //    scrape the source: the issue text is the single source of truth.
  const { systemPrompt, projectFormat, schema } = loadPromptParts();
  const systemMessage = buildSystemMessage({
    systemPrompt,
    projectFormat,
    schema,
    categories,
    tasksRoot: TASKS_ROOT,
    referenceTaskIds: REFERENCE_TASKS,
  });
  const userMessage = buildUserMessage(parsed);

  emit("::info::Запрос к LLM...");
  let task;
  try {
    task = await callLLM({ systemMessage, userMessage });
  } catch (e) {
    fail(`Ошибка вызова LLM: ${e.message}${e.detail ? `\nДетали: ${e.detail}` : ""}`);
  }

  // 5. Validate structured output (incl. category + slug uniqueness).
  const errors = validateTask(task, { allowedTopics, tasksRoot: TASKS_ROOT });
  if (errors.length) {
    fail(
      "LLM вернул невалидный результат:\n" +
        errors.map((e) => `  - ${e}`).join("\n") +
        "\n\nСырой ответ LLM:\n" +
        JSON.stringify(task, null, 2),
    );
  }

  // 6. Determine number + write files.
  const num = nextTaskNumber(TASKS_ROOT, task.topic);
  const taskId = writeTaskFiles(TASKS_ROOT, task.topic, num, task.slug, task);
  emit(`::task-id::${taskId}`);
  emit(`::branch::task/${taskId.replace("/", "-")}`);
  emit(`::title::${task.title}`);

  // 7. Run vitest against generated solution.
  if (process.env.SKIP_VITEST !== "true") {
    emit("::info::Прогон vitest на сгенерированной задаче...");
    const vitestResult = await runVitest(TASKS_ROOT, taskId);
    if (!vitestResult.ok) {
      removeTaskDir(TASKS_ROOT, taskId);
      fail(`Сгенерированная задача не прошла тесты (vitest):\n${vitestResult.output}`);
    }
    emit("::info::vitest прошёл успешно.");
  }

  // 8. Run typecheck + build to ensure the repo still compiles.
  if (process.env.SKIP_BUILD !== "true") {
    emit("::info::Проверка typecheck + build...");
    const buildResult = await runTypecheckAndBuild();
    if (!buildResult.ok) {
      removeTaskDir(TASKS_ROOT, taskId);
      fail(`Сборка проекта упала после добавления задачи:\n${buildResult.output}`);
    }
    emit("::info::typecheck + build прошли успешно.");
  }

  // 9. Emit PR preview.
  const files = buildFileContents(task);
  const preview = buildPrPreview(task, taskId, files);
  fs.writeFileSync(path.join(REPO_ROOT, ".github", "_pr_preview.md"), preview);
}

/**
 * Run vitest via the node API (mirrors src/lib/vitest-worker.mts) so the
 * non-standard tests/test.ts filename is picked up via `include`.
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
  if (failed > 0) {
    const failures = (report.testResults || [])
      .flatMap((tr) =>
        (tr.assertionResults || [])
          .filter((a) => a.status === "failed")
          .map((a) => `  ✗ ${a.title}: ${(a.failureMessages || []).join(" ").slice(0, 500)}`),
      )
      .join("\n");
    return { ok: false, output: failures || "Есть проваленные тесты." };
  }
  return { ok: true, output: "" };
}

async function runTypecheckAndBuild() {
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
