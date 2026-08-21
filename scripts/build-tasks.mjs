import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TASKS_ROOT = path.resolve(__dirname, "../tasks");
const OUT_DIR = path.resolve(__dirname, "../public");
const INDEX_FILE = path.join(OUT_DIR, "tasks.json");
const TASKS_OUT_DIR = path.join(OUT_DIR, "tasks");

function readSafe(dir, name, fallback = "") {
  try {
    return fs.readFileSync(path.join(dir, name), "utf8");
  } catch {
    return fallback;
  }
}

function readMeta(dir) {
  const raw = readSafe(dir, "meta.json");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function walk(dir, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const meta = readMeta(dir);
  if (meta) {
    const rel = path.relative(TASKS_ROOT, dir);
    const parts = rel.split(path.sep);
    const topicName = parts[0] || "misc";
    const slug = parts[1] || path.basename(dir);

    const hintsRaw = readSafe(dir, "hints.md");
    const hints = hintsRaw
      .split(/^##\s/m)
      .map((h) => h.trim())
      .filter(Boolean);

    const id = parts.join("/");
    const summary = {
      id,
      topic: topicName,
      slug,
      title: meta.title,
      difficulty: meta.difficulty,
      tags: meta.tags || [],
      language: meta.language || "typescript",
      exports: meta.exports || [],
    };
    const full = {
      ...summary,
      condition: readSafe(dir, "condition.md"),
      template: readSafe(dir, "template.ts", "export {}"),
      hints,
      solution: readSafe(dir, "solution.ts"),
      testFile: readSafe(dir, path.join("tests", "test.ts")),
    };

    acc.push({ summary, full });
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    walk(path.join(dir, entry.name), acc);
  }
}

const all = [];
walk(TASKS_ROOT, all);
all.sort((a, b) => a.summary.topic.localeCompare(b.summary.topic) || a.summary.slug.localeCompare(b.summary.slug));

// Build index: metadata only (no solution/testFile)
const summaries = all.map((t) => t.summary);
const byTopic = {};
for (const t of summaries) {
  if (!byTopic[t.topic]) byTopic[t.topic] = [];
  byTopic[t.topic].push(t);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(INDEX_FILE, JSON.stringify({ tasks: summaries, topics: byTopic }, null, 2), "utf8");
console.log(`Built index: ${summaries.length} tasks → ${INDEX_FILE}`);

// Build individual task files with full data (solution, tests, etc.)
fs.rmSync(TASKS_OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(TASKS_OUT_DIR, { recursive: true });

for (const t of all) {
  const dir = path.join(TASKS_OUT_DIR, t.summary.topic);
  fs.mkdirSync(dir, { recursive: true });
  const outFile = path.join(dir, `${t.summary.slug}.json`);
  fs.writeFileSync(outFile, JSON.stringify(t.full, null, 2), "utf8");
}

console.log(`Built ${all.length} individual task files → ${TASKS_OUT_DIR}/`);
