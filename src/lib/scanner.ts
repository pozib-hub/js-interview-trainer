import fs from "fs";
import path from "path";
import type { TaskFull, TaskMeta, TaskSummary } from "./types";

const TASKS_ROOT = path.resolve(process.cwd(), "tasks");
const isDev = process.env.NODE_ENV !== "production";

// In-memory cache — survives across requests
let tasksCache: TaskSummary[] | null = null;
let tasksCacheTime = 0;
const taskCache = new Map<string, { data: TaskFull | null; mtime: number }>();

// Max cache age in dev: 2 seconds. In production: infinite.
const CACHE_TTL = isDev ? 2000 : Infinity;

function readMeta(dir: string): TaskMeta | null {
  const metaPath = path.join(dir, "meta.json");
  try {
    const raw = fs.readFileSync(metaPath, "utf8");
    return JSON.parse(raw) as TaskMeta;
  } catch {
    return null;
  }
}

function isTaskDir(dir: string): boolean {
  return fs.existsSync(path.join(dir, "meta.json"));
}

function getDirMtime(dir: string): number {
  try {
    let max = 0;
    for (const name of ["meta.json", "condition.md", "template.ts", "solution.ts", "hints.md", path.join("tests", "test.ts")]) {
      const p = path.join(dir, name);
      try {
        const stat = fs.statSync(p);
        if (stat.mtimeMs > max) max = stat.mtimeMs;
      } catch {}
    }
    return max;
  } catch {
    return 0;
  }
}

function walk(dir: string, topic: string, acc: TaskSummary[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  if (isTaskDir(dir)) {
    const meta = readMeta(dir);
    if (!meta) return;
    const rel = path.relative(TASKS_ROOT, dir);
    const [topicName, slug] = rel.split(path.sep);
    acc.push({
      id: rel.split(path.sep).join("/"),
      topic: topicName || topic || "misc",
      slug: slug || path.basename(dir),
      title: meta.title,
      difficulty: meta.difficulty,
      tags: meta.tags,
      language: meta.language,
    });
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    walk(path.join(dir, entry.name), entry.name, acc);
  }
}

export function listTasks(): TaskSummary[] {
  const now = Date.now();
  if (tasksCache && now - tasksCacheTime < CACHE_TTL) {
    return tasksCache;
  }

  const acc: TaskSummary[] = [];
  walk(TASKS_ROOT, "", acc);
  acc.sort((a, b) => a.topic.localeCompare(b.topic) || a.slug.localeCompare(b.slug));
  tasksCache = acc;
  tasksCacheTime = now;
  return acc;
}

export function getTask(id: string): TaskFull | null {
  const now = Date.now();

  // Check cache freshness by mtime in dev
  const dir = path.join(TASKS_ROOT, id);

  if (isDev) {
    const cached = taskCache.get(id);
    if (cached) {
      const currentMtime = getDirMtime(dir);
      if (currentMtime === cached.mtime && now - cached.mtime < CACHE_TTL * 10) {
        return cached.data;
      }
    }
  } else {
    const cached = taskCache.get(id);
    if (cached) return cached.data;
  }

  if (!fs.existsSync(dir) || !isTaskDir(dir)) {
    taskCache.set(id, { data: null, mtime: 0 });
    return null;
  }
  const meta = readMeta(dir);
  if (!meta) {
    taskCache.set(id, { data: null, mtime: 0 });
    return null;
  }

  const [topicName, slug] = id.split("/");

  const readSafe = (name: string, fallback = ""): string => {
    try {
      return fs.readFileSync(path.join(dir, name), "utf8");
    } catch {
      return fallback;
    }
  };

  const hintsRaw = readSafe("hints.md");
  const hints = hintsRaw
    .split(/^##\s/m)
    .map((h) => h.trim())
    .filter(Boolean);

  const testFile = readSafe(path.join("tests", "test.ts"));

  const task: TaskFull = {
    id,
    topic: topicName || "misc",
    slug: slug || path.basename(dir),
    title: meta.title,
    difficulty: meta.difficulty,
    tags: meta.tags,
    language: meta.language,
    condition: readSafe("condition.md"),
    template: readSafe("template.ts"),
    hints,
    solution: readSafe("solution.ts"),
    testFile,
  };

  taskCache.set(id, { data: task, mtime: getDirMtime(dir) });
  return task;
}

export function clearCache() {
  tasksCache = null;
  tasksCacheTime = 0;
  taskCache.clear();
}

export { TASKS_ROOT };
