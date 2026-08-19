import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OLD_ROOT = path.resolve(__dirname, "..", "..", "tech_interview_tasks-main");
const NEW_ROOT = path.resolve(__dirname, "..", "tasks");

const EXCLUDE_DIRS = new Set(["node_modules", ".git", "server", "web", "dist", "build"]);
const EXCLUDE_FILES = new Set(["Readme.md", "package.json", "package-lock.json", "tsconfig.json", ".gitignore", ".DS_Store"]);
const INCLUDE_EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);

const OUTPUT_TOPICS = new Set(["eventLoop", "this", "var", "scope", "proto"]);
const TYPE_TOPICS = new Set(["ts", "transformation"]);

const topicCounters = {};

function getNextNumber(topic) {
  if (!topicCounters[topic]) topicCounters[topic] = 0;
  topicCounters[topic]++;
  return String(topicCounters[topic]).padStart(3, "0");
}

const TOPIC_MAP = {
  eventLoop: "event-loop",
  Promises: "promises",
  React: "react",
};

function mapTopic(name) {
  return TOPIC_MAP[name] || name;
}

function toKebabCase(name) {
  return name
    .replace(/\.(ts|js|tsx|jsx)$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function extractTopic(oldPath) {
  const rel = path.relative(OLD_ROOT, oldPath);
  const parts = rel.split(path.sep);
  let topic = parts[0];
  if (parts.length > 2) {
    topic = parts[0] + "-" + parts[1];
  }
  return mapTopic(topic);
}

function extractSlug(oldPath) {
  const basename = path.basename(oldPath);
  return toKebabCase(basename);
}

function parseOldFile(content) {
  let cleaned = content.replace(/^\/\/\s*@ts-nocheck\s*\n?/m, "");

  const commentRegex = /\/\*([\s\S]*?)\*\//g;
  const comments = [];
  let match;
  while ((match = commentRegex.exec(cleaned)) !== null) {
    comments.push({
      full: match[0],
      inner: match[1],
      index: match.index,
      end: match.index + match[0].length,
    });
  }

  const answerComment = comments.find((c) => /ответ/i.test(c.inner));
  const conditionComment = comments.find(
    (c) => !/ответ/i.test(c.inner) && c.inner.trim().length > 5
  );

  let condition = "";
  if (conditionComment) {
    condition = conditionComment.inner.replace(/^\n+/, "").replace(/\s+$/, "").trim();
  }

  let answer = "";
  if (answerComment) {
    const lines = answerComment.inner.split("\n");
    const parsed = lines
      .map((l) => l.replace(/^\s*\|\s?/, "").replace(/\s+$/, ""))
      .filter((l) => l.trim() && l.trim() !== "|");
    if (parsed.length > 0) parsed[0] = parsed[0].replace(/^ответ\s*/i, "").trim();
    answer = parsed.filter(Boolean).join("\n").trim();
  }

  let solution = cleaned;
  for (const c of comments) {
    solution = solution.replace(c.full, "");
  }
  solution = solution.replace(/export\s*\{\s*\}\s*;?/g, "").trim();

  return { condition, answer, solution };
}

function determineTaskType(topic, solution) {
  if (OUTPUT_TOPICS.has(topic)) return "output";
  if (TYPE_TOPICS.has(topic)) {
    if (/^\s*(export\s+)?type\s/m.test(solution) || /^\s*(export\s+)?interface\s/m.test(solution)) {
      return "type";
    }
  }
  return "algorithm";
}

function extractFunctions(code) {
  const funcs = [];
  const funcRegex =
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*\{/g;
  let m;
  while ((m = funcRegex.exec(code)) !== null) {
    funcs.push({
      name: m[1],
      params: m[2].trim(),
      returnType: (m[3] || "").trim(),
      isAsync: /async\s/.test(m[0]),
    });
  }
  const arrowRegex =
    /(?:export\s+)?const\s+(\w+)\s*=\s*(async\s*)?\(([^)]*)\)\s*(?::\s*([^=]+?))?\s*=>/g;
  while ((m = arrowRegex.exec(code)) !== null) {
    funcs.push({
      name: m[1],
      params: m[3].trim(),
      returnType: (m[4] || "").trim(),
      isAsync: !!m[2],
      isArrow: true,
    });
  }
  return funcs;
}

function extractTypes(code) {
  const types = [];
  const typeRegex = /(?:export\s+)?type\s+(\w+)\s*[<=(]/g;
  let m;
  while ((m = typeRegex.exec(code)) !== null) {
    types.push(m[1]);
  }
  return types;
}

function getStubValue(returnType) {
  const rt = returnType.toLowerCase();
  if (!returnType || rt.includes("void")) return "undefined as any";
  if (rt.includes("number")) return "0";
  if (rt.includes("string")) return '""';
  if (rt.includes("boolean")) return "false";
  if (rt.includes("array") || rt.includes("[]") || rt.includes("<")) return "[]";
  if (rt.includes("promise")) return "Promise.resolve() as any";
  if (rt.includes("object") || rt.includes("record")) return "{}";
  return "undefined as any";
}

function generateTemplate(taskType, solution, funcs, types) {
  if (taskType === "output") {
    return `export function getResult(): string[] {\n  // TODO: верните ожидаемый результат\n  return [];\n}\n`;
  }

  if (taskType === "type") {
    if (types.length > 0) {
      return types
        .map((t) => `export type ${t}<T> = any;`)
        .join("\n\n") + "\n";
    }
    return "export type Result = any;\n";
  }

  if (funcs.length > 0) {
    return funcs
      .map((f) => {
        const asyncKw = f.isAsync ? "async " : "";
        const rt = f.returnType ? `: ${f.returnType}` : "";
        const stub = getStubValue(f.returnType);
        return `export ${asyncKw}function ${f.name}(${f.params})${rt} {\n  // TODO: реализуйте\n  return ${stub};\n}`;
      })
      .join("\n\n") + "\n";
  }

  if (types.length > 0) {
    return types
      .map((t) => `export type ${t}<T> = any;`)
      .join("\n\n") + "\n";
  }

  return "// TODO: реализуйте решение\nexport {};\n";
}

function generateSolutionOutput(answer) {
  const lines = answer
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const arr = lines.map((l) => `"${l.replace(/"/g, '\\"')}"`).join(", ");
  return `export function getResult(): string[] {\n  return [${arr}];\n}\n`;
}

function generateTestOutput(answer) {
  const lines = answer
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const arr = lines.map((l) => `"${l.replace(/"/g, '\\"')}"`).join(", ");
  return `import { test, expect } from "vitest";
import { getResult } from "../solution";

test("результат", () => {
  expect(getResult()).toEqual([${arr}]);
});
`;
}

function parseConsoleLogExamples(solution) {
  const examples = [];
  const lines = solution.split("\n");
  const pattern = /console\.log\(\s*(\w+)\(([^)]*)\)\s*\);?\s*\/\/\s*(?:→|=>)?\s*(.+)/;
  for (const line of lines) {
    const m = line.match(pattern);
    if (m) {
      examples.push({
        func: m[1],
        args: m[2].trim(),
        expected: m[3].trim().replace(/;.*$/, "").trim(),
      });
    }
  }
  return examples;
}

function generateTestAlgorithm(funcs) {
  if (funcs.length === 0) {
    return `import { test, expect } from "vitest";

test("решение загружается", () => {
  expect(true).toBe(true);
});
`;
  }

  const imports = funcs.map((f) => f.name).join(", ");
  let testCode = `import { test, expect } from "vitest";\nimport { ${imports} } from "../solution";\n`;

  for (const f of funcs) {
    const noArgs = !f.params || f.params.trim() === "";
    if (noArgs) {
      testCode += `\ntest("${f.name} возвращает значение", () => {\n  expect(${f.name}()).toBeDefined();\n});\n`;
    } else {
      testCode += `\ntest("${f.name} определена", () => {\n  expect(typeof ${f.name}).toBe("function");\n});\n`;
    }
  }

  return testCode;
}

function generateTestType(types) {
  if (types.length === 0) {
    return `import { test, expect } from "vitest";\n\ntest("тип определён", () => {\n  expect(true).toBe(true);\n});\n`;
  }
  const imports = types.join(", ");
  let testCode = `import { test, expectTypeOf } from "vitest";\nimport type { ${imports} } from "../solution";\n`;

  for (const t of types) {
    testCode += `\ntest("${t} — тип определён", () => {\n  expectTypeOf<${t}<unknown>>().toBeDefined();\n});\n`;
  }
  return testCode;
}

function generateTest(taskType, solution, answer, funcs, types) {
  if (taskType === "output" && answer) {
    return generateTestOutput(answer);
  }

  if (taskType === "algorithm") {
    const examples = parseConsoleLogExamples(solution);
    if (examples.length > 0) {
      const imports = [...new Set(examples.map((e) => e.func))].join(", ");
      let testCode = `import { test, expect } from "vitest";\nimport { ${imports} } from "../solution";\n`;

      for (const ex of examples.slice(0, 8)) {
        const isObj = ex.expected.startsWith("[") || ex.expected.startsWith("{");
        const matcher = isObj ? "toEqual" : "toBe";
        testCode += `\ntest("${ex.func}(${ex.args}) => ${ex.expected}", () => {\n  expect(${ex.func}(${ex.args})).${matcher}(${ex.expected});\n});\n`;
      }
      return testCode;
    }
    return generateTestAlgorithm(funcs);
  }

  if (taskType === "type") {
    return generateTestType(types);
  }

  return generateTestAlgorithm(funcs);
}

function estimateDifficulty(solution, answer) {
  const lines = solution.split("\n").filter((l) => l.trim()).length;
  if (lines <= 5) return "easy";
  if (lines <= 15) return "medium";
  return "hard";
}

function extractTags(topic, solution) {
  const tags = [topic];
  if (/recursi/i.test(solution)) tags.push("recursion");
  if (/array|\.map|\.filter|\.reduce/i.test(solution)) tags.push("array");
  if (/sort/i.test(solution)) tags.push("sort");
  if (/promise|async|await/i.test(solution)) tags.push("async");
  if (/this\./.test(solution)) tags.push("this");
  if (/type\s+\w|interface\s+\w/.test(solution)) tags.push("types");
  if (/closure|setTimeout|debounce|throttle/i.test(solution)) tags.push("closure");
  return [...new Set(tags)];
}

function generateHints(answer, taskType) {
  if (taskType === "output" && answer) {
    return "## Подсказка 1\nПроанализируйте порядок выполнения: синхронный код, microtasks (Promise), macrotasks (setTimeout).\n\n## Подсказка 2\nУчитывайте замыкания и контекст `this` при вызове функций.\n";
  }
  return "## Подсказка 1\nВнимательно прочитайте условие и определите, какие данные нужны для решения.\n\n## Подсказка 2\nПодумайте о краевых случаях: пустые массивы, null, отрицательные числа.\n";
}

function extractTitle(condition, filename) {
  if (!condition) return toKebabCase(filename);
  const firstLine = condition.split("\n").find((l) => l.trim().length > 3);
  if (!firstLine) return toKebabCase(filename);
  let title = firstLine.trim().replace(/^#+\s*/, "").replace(/^Компания\s*-\s*/i, "").replace(/^Компания:\s*/i, "");
  if (title.length > 80) title = title.substring(0, 77) + "...";
  return title || toKebabCase(filename);
}

function ensureExport(code) {
  let result = code;
  result = result.replace(/^function\s/gm, "export function ");
  result = result.replace(/^const\s/gm, "export const ");
  result = result.replace(/^let\s/gm, "export let ");
  result = result.replace(/^type\s/gm, "export type ");
  result = result.replace(/^interface\s/gm, "export interface ");
  result = result.replace(/^async function\s/gm, "export async function ");
  result = result.replace(/^class\s/gm, "export class ");

  if (!/export\s/.test(result) && result.trim()) {
    result = "export " + result;
  }

  if (!/\bexport\b/.test(result)) {
    result += "\nexport {};\n";
  }

  return result;
}

function migrateFile(oldPath, stats) {
  const content = fs.readFileSync(oldPath, "utf8");
  const { condition, answer, solution: rawSolution } = parseOldFile(content);

  const topic = extractTopic(oldPath);
  const slug = toKebabCase(path.basename(oldPath));
  const num = getNextNumber(topic);
  const taskSlug = `${num}-${slug}`;
  const taskDir = path.join(NEW_ROOT, topic, taskSlug);

  let solution = rawSolution.trim();
  if (!solution || solution === "export {};") {
    if (answer && !OUTPUT_TOPICS.has(topic)) {
      solution = answer;
    } else {
      solution = "// TODO: реализуйте решение\nexport {};\n";
    }
  }

  const ext = path.extname(oldPath);
  const isTS = ext === ".ts" || ext === ".tsx";
  const language = isTS ? "typescript" : "javascript";

  const taskType = determineTaskType(topic, solution);
  const funcs = extractFunctions(solution);
  const types = extractTypes(solution);

  let finalSolution = solution;
  let finalTemplate = generateTemplate(taskType, solution, funcs, types);

  if (taskType === "output" && answer) {
    finalSolution = generateSolutionOutput(answer);
    finalTemplate = "export function getResult(): string[] {\n  // TODO: верните ожидаемый результат\n  return [];\n}\n";
  } else {
    finalSolution = ensureExport(solution);
  }

  const testCode = generateTest(taskType, solution, answer, funcs, types);

  const title = extractTitle(condition, path.basename(oldPath));
  const difficulty = estimateDifficulty(solution, answer);
  const tags = extractTags(topic, solution);

  const meta = {
    title,
    difficulty,
    tags,
    language,
    exports: taskType === "output" ? ["getResult"] : funcs.map((f) => f.name),
  };

  const conditionMd = condition
    ? `# ${title}\n\n${condition}\n`
    : `# ${title}\n\nСм. код решения для понимания задачи.\n`;

  const hintsMd = generateHints(answer, taskType);

  fs.mkdirSync(path.join(taskDir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(taskDir, "meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(taskDir, "condition.md"), conditionMd, "utf8");
  fs.writeFileSync(path.join(taskDir, "template.ts"), finalTemplate, "utf8");
  fs.writeFileSync(path.join(taskDir, "solution.ts"), finalSolution, "utf8");
  fs.writeFileSync(path.join(taskDir, "hints.md"), hintsMd, "utf8");
  fs.writeFileSync(path.join(taskDir, "tests", "test.ts"), testCode, "utf8");

  stats.migrated++;
  stats.byTopic[topic] = (stats.byTopic[topic] || 0) + 1;
}

function walk(dir, stats) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) walk(fullPath, stats);
    } else if (entry.isFile()) {
      if (EXCLUDE_FILES.has(entry.name)) continue;
      const ext = path.extname(entry.name);
      if (!INCLUDE_EXT.has(ext)) continue;
      try {
        migrateFile(fullPath, stats);
      } catch (e) {
        console.error(`  ✗ ${path.relative(OLD_ROOT, fullPath)}: ${e.message}`);
        stats.failed++;
      }
    }
  }
}

function main() {
  if (!fs.existsSync(OLD_ROOT)) {
    console.error(`Старый проект не найден: ${OLD_ROOT}`);
    process.exit(1);
  }

  fs.rmSync(NEW_ROOT, { recursive: true, force: true });
  fs.mkdirSync(NEW_ROOT, { recursive: true });

  const stats = { migrated: 0, failed: 0, byTopic: {} };
  walk(OLD_ROOT, stats);

  console.log("\n=== Миграция завершена ===");
  console.log(`Мигрировано: ${stats.migrated} задач`);
  console.log(`Ошибок: ${stats.failed}`);
  console.log("\nПо темам:");
  for (const [topic, count] of Object.entries(stats.byTopic).sort()) {
    console.log(`  ${topic}: ${count}`);
  }
  console.log(`\nВсего: ${stats.migrated} задач в ${Object.keys(stats.byTopic).length} темах`);
}

main();
