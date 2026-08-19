import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TASKS_ROOT = path.resolve(__dirname, "../tasks");
const OUT_FILE = path.resolve(__dirname, "../public/tasks.json");
const API_DIR = path.resolve(__dirname, "../src/app/api");
const API_BACKUP = path.resolve(__dirname, "../src/app/_api_backup");

// In static mode, move API routes out of the way so Next.js doesn't try to build them
if (process.env.NEXT_PUBLIC_STATIC_MODE === "true" && fs.existsSync(API_DIR)) {
  if (fs.existsSync(API_BACKUP)) fs.rmSync(API_BACKUP, { recursive: true, force: true });
  fs.renameSync(API_DIR, API_BACKUP);
  console.log("API routes moved to backup for static build");
}

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

    acc.push({
      id: parts.join("/"),
      topic: topicName,
      slug,
      title: meta.title,
      difficulty: meta.difficulty,
      tags: meta.tags || [],
      language: meta.language || "typescript",
      condition: readSafe(dir, "condition.md"),
      template: readSafe(dir, "template.ts", "export {}"),
      hints,
      solution: readSafe(dir, "solution.ts"),
      testFile: readSafe(dir, path.join("tests", "test.ts")),
      exports: meta.exports || [],
    });
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    walk(path.join(dir, entry.name), acc);
  }
}

const tasks = [];
walk(TASKS_ROOT, tasks);
tasks.sort((a, b) => a.topic.localeCompare(b.topic) || a.slug.localeCompare(b.slug));

const byTopic = {};
for (const t of tasks) {
  if (!byTopic[t.topic]) byTopic[t.topic] = [];
  byTopic[t.topic].push(t);
}

const output = { tasks, topics: byTopic };
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf8");

console.log(`Built ${tasks.length} tasks → ${OUT_FILE}`);
