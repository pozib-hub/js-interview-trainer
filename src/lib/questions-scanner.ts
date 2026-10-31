import fs from "fs";
import path from "path";
import type { QuestionChapter, QuestionEntry, QuestionsDirection, QuestionsIndex, QuestionsTechnology } from "./types";

const QUESTIONS_ROOT = path.resolve(process.cwd(), "questions");
const isDev = process.env.NODE_ENV !== "production";

/**
 * Проверяет, что id (направление/технология) безопасен: kebab-case,
 * без слешей, точек и null bytes. Защищает от path traversal.
 */
function isSafeId(id: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id);
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readText(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

/**
 * Разбирает markdown-файл главы.
 *
 * Формат:
 *   # Название главы
 *
 *   ## Текст вопроса?
 *
 *   Ответ на вопрос...
 *
 * Вопросы разделяются заголовками `## ` (как hints.md у задач).
 * Разделение не затрагивает `##` внутри блоков кода (\`\`\`).
 */
export function parseChapterMarkdown(relDir: string, fileName: string, raw: string): QuestionChapter {
  const chapterId = `${relDir}/${fileName.replace(/\.md$/, "")}`;
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const title = (titleMatch?.[1] ?? fileName).trim();

  const questions: QuestionEntry[] = [];
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
 * Первый сегмент (текст до первого вопроса) отбрасывается.
 */
export function splitByQuestionHeadings(raw: string): string[] {
  const segments: string[] = [];
  let current = "";
  let inCode = false;
  for (const line of raw.split("\n")) {
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
    } else if (!inCode && /^##\s+/.test(line)) {
      segments.push(current);
      current = "";
      current += line.replace(/^##\s+/, "") + "\n";
      continue;
    }
    current += line + "\n";
  }
  segments.push(current);
  return segments.slice(1);
}

function readChaptersDir(relDir: string): QuestionChapter[] {
  const absDir = path.join(QUESTIONS_ROOT, relDir, "chapters");
  let files: fs.Dirent[];
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

// In-memory cache — survives across requests
let cache: QuestionsIndex | null = null;
let cacheTime = 0;
const CACHE_TTL = isDev ? 2000 : Infinity;

function scanTechnology(directionId: string, dirName: string): QuestionsTechnology | null {
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

function scanDirection(dirName: string): QuestionsDirection | null {
  const absDir = path.join(QUESTIONS_ROOT, dirName);
  const meta = readJson(path.join(absDir, "meta.json"));
  if (!meta) return null;

  const technologies: QuestionsTechnology[] = [];
  let entries: fs.Dirent[] = [];
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

  technologies.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title));

  return {
    id: dirName,
    title: String(meta.title ?? dirName),
    description: String(meta.description ?? ""),
    order: Number(meta.order) || 0,
    technologies,
    chapters: readChaptersDir(dirName),
  };
}

export function listQuestions(): QuestionsIndex {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL) {
    return cache;
  }

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(QUESTIONS_ROOT, { withFileTypes: true });
  } catch {}

  const directions: QuestionsDirection[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
    if (!isSafeId(entry.name)) continue;
    const direction = scanDirection(entry.name);
    if (direction) directions.push(direction);
  }
  directions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title));

  cache = { directions };
  cacheTime = now;
  return cache;
}

export function clearQuestionsCache() {
  cache = null;
  cacheTime = 0;
}

export { QUESTIONS_ROOT };
