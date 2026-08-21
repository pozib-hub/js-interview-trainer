// Deterministic file generator: takes a validated task JSON object and
// produces the 6 project files with the exact project conventions.
// The LLM NEVER writes files directly — this module assembles them.

import fs from "fs";
import path from "path";

/**
 * Find the next free 3-digit number for a topic under tasks/.
 * @param {string} tasksRoot
 * @param {string} topic
 * @returns {string} e.g. "027"
 */
export function nextTaskNumber(tasksRoot, topic) {
  const dir = path.join(tasksRoot, topic);
  let max = 0;
  if (fs.existsSync(dir)) {
    for (const entry of fs.readdirSync(dir)) {
      const m = entry.match(/^(\d{3,})-/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  }
  return String(max + 1).padStart(3, "0");
}

/**
 * Assemble the file contents (in-memory) from a validated task object.
 * @param {Record<string, any>} task
 * @returns {{ metaJson: string, condition: string, template: string, solution: string, hints: string, test: string }}
 */
export function buildFileContents(task) {
  const metaJson = JSON.stringify(
    {
      title: task.title,
      difficulty: task.difficulty,
      tags: task.tags,
      language: task.language,
      exports: task.exports,
    },
    null,
    2,
  ) + "\n";

  // condition.md: prepend the title as the only H1; render examples &
  // constraints (only if non-empty); append source link.
  const parts = [`# ${task.title}`, "", task.condition.trim()];
  const examples = Array.isArray(task.examples) ? task.examples.filter((e) => e && e.trim()) : [];
  if (examples.length) {
    parts.push("", "## Примеры");
    for (const ex of examples) parts.push("", ex.trim());
  }
  const constraints = Array.isArray(task.constraints) ? task.constraints.filter((c) => c && c.trim()) : [];
  if (constraints.length) {
    parts.push("", "## Ограничения");
    for (const c of constraints) parts.push(`- ${c.trim()}`);
  }
  if (task.source?.url) {
    parts.push("", `> Источник: [${task.source.name || "ссылка"}](${task.source.url})`);
  }
  let condition = parts.join("\n");
  if (!condition.endsWith("\n")) condition += "\n";

  const ensureTrailingNewline = (s) => (s.endsWith("\n") ? s : s + "\n");
  const template = ensureTrailingNewline(task.templateCode.trim() + "\n");
  const solution = ensureTrailingNewline(task.solutionCode.trim() + "\n");
  const test = ensureTrailingNewline(task.testCode.trim() + "\n");

  const hints =
    task.hints
      .map((h, i) => `## Подсказка ${i + 1}\n${h.trim()}`)
      .join("\n\n") + "\n";

  return { metaJson, condition, template, solution, hints, test };
}

/**
 * Write the 6 task files to disk.
 * @param {string} tasksRoot
 * @param {string} topic
 * @param {string} numberStr  e.g. "027"
 * @param {string} slug
 * @param {Record<string, any>} task
 * @returns {string} created task id, e.g. "algorithms/027-valid-parentheses"
 */
export function writeTaskFiles(tasksRoot, topic, numberStr, slug, task) {
  const taskDir = path.join(tasksRoot, topic, `${numberStr}-${slug}`);
  fs.mkdirSync(path.join(taskDir, "tests"), { recursive: true });
  const files = buildFileContents(task);
  fs.writeFileSync(path.join(taskDir, "meta.json"), files.metaJson);
  fs.writeFileSync(path.join(taskDir, "condition.md"), files.condition);
  fs.writeFileSync(path.join(taskDir, "template.ts"), files.template);
  fs.writeFileSync(path.join(taskDir, "solution.ts"), files.solution);
  fs.writeFileSync(path.join(taskDir, "hints.md"), files.hints);
  fs.writeFileSync(path.join(taskDir, "tests", "test.ts"), files.test);
  return `${topic}/${numberStr}-${slug}`;
}

/**
 * Remove the generated task directory (used for cleanup on validation failure).
 */
export function removeTaskDir(tasksRoot, taskId) {
  const dir = path.join(tasksRoot, taskId);
  fs.rmSync(dir, { recursive: true, force: true });
}
