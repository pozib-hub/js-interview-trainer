import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QUESTIONS_ROOT = path.resolve(__dirname, "../questions");
const OUT_FILE = path.resolve(__dirname, "../public/questions.json");

function readText(file, fallback = "") {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return fallback;
  }
}

function readJson(file) {
  const raw = readText(file);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseChapterMarkdown(relDir, fileName, raw) {
  const chapterId = `${relDir}/${fileName.replace(/\.md$/, "")}`;
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const title = (titleMatch?.[1] ?? fileName).trim();

  const questions = [];
  for (const segment of splitByQuestionHeadings(raw)) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const nl = trimmed.indexOf("\n");
    const question = (nl === -1 ? trimmed : trimmed.slice(0, nl)).trim();
    const answer = (nl === -1 ? "" : trimmed.slice(nl + 1)).trim();
    if (!question) continue;
    questions.push({
      id: `${chapterId}/${String(questions.length + 1).padStart(3, "0")}`,
      question,
      answer,
    });
  }

  return { id: chapterId, title, questions };
}

/**
 * Делит markdown на сегменты по заголовкам `## ...` вне блоков кода.
 * Первый сегмент (до первого вопроса) отбрасывается.
 */
function splitByQuestionHeadings(raw) {
  const segments = [];
  let current = "";
  let inCode = false;
  for (const line of raw.split("\n")) {
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
    } else if (!inCode && /^##\s+/.test(line)) {
      segments.push(current);
      current = line.replace(/^##\s+/, "") + "\n";
      continue;
    }
    current += line + "\n";
  }
  segments.push(current);
  return segments.slice(1);
}

function readChaptersDir(relDir) {
  const absDir = path.join(QUESTIONS_ROOT, relDir, "chapters");
  let files;
  try {
    files = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return files
    .filter((f) => f.isFile() && f.name.endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => parseChapterMarkdown(relDir, f.name, readText(path.join(absDir, f.name))));
}

function scanTechnology(directionId, dirName) {
  const absDir = path.join(QUESTIONS_ROOT, directionId, dirName);
  const meta = readJson(path.join(absDir, "meta.json"));
  if (!meta) return null;
  return {
    id: `${directionId}/${dirName}`,
    directionId,
    title: String(meta.title ?? dirName),
    description: String(meta.description ?? ""),
    order: Number(meta.order) || 0,
    chapters: readChaptersDir(`${directionId}/${dirName}`),
  };
}

function scanDirection(dirName) {
  const absDir = path.join(QUESTIONS_ROOT, dirName);
  const meta = readJson(path.join(absDir, "meta.json"));
  if (!meta) return null;

  const technologies = [];
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    entries = [];
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
    if (entry.name === "chapters") continue;
    const tech = scanTechnology(dirName, entry.name);
    if (tech) technologies.push(tech);
  }

  technologies.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  return {
    id: dirName,
    title: String(meta.title ?? dirName),
    description: String(meta.description ?? ""),
    order: Number(meta.order) || 0,
    technologies,
    chapters: readChaptersDir(dirName),
  };
}

let entries;
try {
  entries = fs.readdirSync(QUESTIONS_ROOT, { withFileTypes: true });
} catch {
  console.error(`questions/ not found at ${QUESTIONS_ROOT}`);
  process.exit(1);
}

const directions = [];
for (const entry of entries) {
  if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
  const direction = scanDirection(entry.name);
  if (direction) directions.push(direction);
}
directions.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify({ directions }, null, 2), "utf8");

const techCount = directions.reduce((n, d) => n + d.technologies.length, 0);
const questionCount = directions.reduce(
  (n, d) =>
    n +
    d.technologies.reduce((m, t) => m + t.chapters.reduce((k, c) => k + c.questions.length, 0), 0) +
    d.chapters.reduce((k, c) => k + c.questions.length, 0),
  0
);
console.log(`Built questions index: ${directions.length} directions, ${techCount} technologies, ${questionCount} questions → ${OUT_FILE}`);
