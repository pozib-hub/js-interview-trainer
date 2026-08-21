// Assemble the full LLM prompt from multiple versioned parts in .github/llm/
// plus dynamic project context (categories, reference examples, source, user).
//
// Prompt structure (per spec):
//   1. System instructions / rules            (system-prompt.md)
//   2. Project format spec                    (project-format.md)
//   3. Available categories                   (dynamic, from tasks/)
//   4. Reference examples                     (dynamic, from real tasks)
//   5. Source information                     (fetched LeetCode / issue text)
//   6. User-provided issue content
//   7. Output JSON Schema                      (task-schema.json)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LLM_DIR = path.resolve(__dirname, "../../llm");

/** Load all static prompt parts from .github/llm/. */
export function loadPromptParts() {
  return {
    systemPrompt: readMd("system-prompt.md"),
    projectFormat: readMd("project-format.md"),
    schema: JSON.parse(fs.readFileSync(path.join(LLM_DIR, "task-schema.json"), "utf8")),
  };
}

function readMd(name) {
  return fs.readFileSync(path.join(LLM_DIR, name), "utf8");
}

/**
 * Build the categories section, dynamically from tasks/.
 * @param {ReturnType<import("./categories.mjs").describeCategories>} categories
 */
function buildCategoriesSection(categories) {
  const lines = ["# Разрешённые категории (topic)"];
  lines.push("");
  lines.push("Выбери ОДНУ категорию из списка ниже. НЕ придумывай новые категории.");
  lines.push("");
  for (const c of categories) {
    const ex = c.examples.length ? ` (примеры: ${c.examples.join(", ")})` : "";
    lines.push(`- \`${c.name}\` — ${c.count} задач${ex}`);
  }
  lines.push("");
  lines.push("Если ни одна категория не подходит по смыслу — выбери `other`.");
  return lines.join("\n");
}

/**
 * Build reference examples from a few well-formed real tasks, to ground the
 * model on the actual project conventions (few-shot).
 * @param {string} tasksRoot
 * @param {string[][]} taskIds  e.g. [["sorts","001-bubble-sort"], ["algorithms","010-fibonacci"]]
 */
function buildReferenceSection(tasksRoot, taskIds) {
  const lines = ["# Reference-примеры реальных задач"];
  lines.push("");
  lines.push("Изучи структуру этих задач и следуй их стилю.");
  lines.push("");
  for (const parts of taskIds) {
    const dir = path.join(tasksRoot, ...parts);
    if (!fs.existsSync(path.join(dir, "meta.json"))) continue;
    const id = parts.join("/");
    lines.push(`## ${id}`);
    lines.push("");
    lines.push("```meta.json");
    lines.push(readTrim(path.join(dir, "meta.json")));
    lines.push("```");
    lines.push("");
    lines.push("```template.ts");
    lines.push(readTrim(path.join(dir, "template.ts")));
    lines.push("```");
    lines.push("");
    lines.push("```solution.ts");
    lines.push(readTrim(path.join(dir, "solution.ts")));
    lines.push("```");
    lines.push("");
    lines.push("```tests/test.ts");
    lines.push(readTrim(path.join(dir, "tests", "test.ts")));
    lines.push("```");
    lines.push("");
    const hints = readTrimSafe(path.join(dir, "hints.md"));
    if (hints) {
      lines.push("```hints.md");
      lines.push(hints);
      lines.push("```");
      lines.push("");
    }
  }
  return lines.join("\n");
}

function readTrim(p) {
  return fs.readFileSync(p, "utf8").trim();
}
function readTrimSafe(p) {
  try {
    return fs.readFileSync(p, "utf8").trim();
  } catch {
    return "";
  }
}

/**
 * @param {object} opts
 * @param {string} opts.systemPrompt
 * @param {string} opts.projectFormat
 * @param {object} opts.schema
 * @param {Array} opts.categories
 * @param {string} opts.tasksRoot
 * @param {string[][]} opts.referenceTaskIds
 * @param {ReturnType<import("./issue-parser.mjs").parseIssueBody>} opts.parsed
 * @param {null | { name: string, url: string, content: string, title?: string, difficulty?: string|null, topicTags?: string[] }} opts.source
 */
export function buildSystemMessage(opts) {
  const parts = [
    opts.systemPrompt,
    "",
    opts.projectFormat,
    "",
    buildCategoriesSection(opts.categories),
    "",
    buildReferenceSection(opts.tasksRoot, opts.referenceTaskIds),
    "",
    "# JSON Schema (строго соблюдай структуру)",
    "",
    "```json",
    JSON.stringify(opts.schema, null, 2),
    "```",
  ];
  return parts.join("\n");
}

/**
 * Build the user message: issue content (URL + description + solution + notes).
 * We do NOT fetch the source URL — the issue text is the single source of
 * truth. The URL is passed to the LLM for context (the model knows popular
 * LeetCode tasks by slug) and preserved in `source.url` of the output.
 */
export function buildUserMessage(parsed) {
  const lines = ["# Входные данные"];
  lines.push("");
  if (parsed.title) {
    lines.push(`Заголовок issue: ${parsed.title}`);
    lines.push("");
  }
  if (parsed.sourceUrl) {
    lines.push(`## URL источника: ${parsed.sourceUrl}`);
    lines.push("(контент не получаем — используй описание задачи ниже; URL сохрани в source.url)");
    lines.push("");
  }

  lines.push("## Описание задачи от пользователя");
  lines.push(parsed.description || "(пусто)");
  lines.push("");

  if (parsed.userSolution) {
    lines.push("## Решение пользователя (проверь и оформи как solutionCode)");
    lines.push("```ts");
    lines.push(parsed.userSolution);
    lines.push("```");
    lines.push("");
  }

  if (parsed.notes) {
    lines.push("## Дополнительные заметки");
    lines.push(parsed.notes);
    lines.push("");
  }

  lines.push("# Задача");
  lines.push("Верни только JSON по переданной JSON Schema. Не добавляй пояснений вне JSON.");
  return lines.join("\n");
}
