#!/usr/bin/env node
/**
 * Валидация структуры задач:
 * - meta.json существует и корректна
 * - exports из meta.json совпадают с реальными экспортами template.ts
 * - нет дублей в exports
 * - tests/test.ts импортирует из ../solution
 * - все файлы задачи присутствуют (condition.md, template.ts, solution.ts, tests/test.ts)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TASKS_ROOT = path.resolve(__dirname, "../tasks");

const errors = [];
const warnings = [];
let checked = 0;

function readSafe(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function extractExports(code) {
  const names = [];
  const regex = /export\s+(?:const|let|function|class|async\s+function)\s+(\w+)/g;
  let m;
  while ((m = regex.exec(code)) !== null) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  // Also check export { ... }
  const reExport = /export\s*\{([^}]+)\}/g;
  while ((m = reExport.exec(code)) !== null) {
    const items = m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    for (const item of items) {
      if (item && !names.includes(item)) names.push(item);
    }
  }
  return names;
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const metaPath = path.join(dir, "meta.json");

  if (fs.existsSync(metaPath)) {
    checked++;
    const rel = path.relative(TASKS_ROOT, dir);
    const meta = JSON.parse(readSafe(metaPath) || "{}");

    // Check required files
    const required = ["condition.md", "template.ts", "solution.ts", "tests/test.ts"];
    for (const file of required) {
      if (!fs.existsSync(path.join(dir, file))) {
        errors.push(`${rel}: отсутствует ${file}`);
      }
    }

    // Check meta fields
    if (!meta.title) errors.push(`${rel}: meta.json без title`);
    if (!["easy", "medium", "hard"].includes(meta.difficulty)) {
      errors.push(`${rel}: meta.json difficulty="${meta.difficulty}" (ожидалось easy|medium|hard)`);
    }
    if (!meta.language || !["typescript", "javascript"].includes(meta.language)) {
      warnings.push(`${rel}: meta.json language="${meta.language}" (ожидалось typescript|javascript)`);
    }

    // Check exports for duplicates
    const exports = meta.exports || [];
    const seen = new Set();
    for (const name of exports) {
      if (seen.has(name)) {
        errors.push(`${rel}: дубликат в exports: "${name}"`);
      }
      seen.add(name);
    }

    // Check exports match template
    const template = readSafe(path.join(dir, "template.ts")) || "";
    const templateExports = extractExports(template);
    const missingInTemplate = exports.filter((e) => !templateExports.includes(e));
    if (missingInTemplate.length > 0) {
      warnings.push(`${rel}: exports из meta.json не найдены в template.ts: ${missingInTemplate.join(", ")}`);
    }

    // Check test imports from ../solution
    const testFile = readSafe(path.join(dir, "tests/test.ts")) || "";
    if (testFile && !testFile.includes('from "../solution"') && !testFile.includes("from '../solution'")) {
      warnings.push(`${rel}: tests/test.ts не импортирует из ../solution`);
    }

    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    walk(path.join(dir, entry.name));
  }
}

walk(TASKS_ROOT);

console.log(`Checked ${checked} tasks`);
if (warnings.length > 0) {
  console.log(`\nWarnings (${warnings.length}):`);
  warnings.forEach((w) => console.log("  ⚠ " + w));
}
if (errors.length > 0) {
  console.log(`\nErrors (${errors.length}):`);
  errors.forEach((e) => console.log("  ✗ " + e));
  process.exit(1);
} else {
  console.log("All tasks valid ✓");
}
