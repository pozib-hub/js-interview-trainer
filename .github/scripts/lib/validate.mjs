// Dependency-free JSON validator for the generated task schema.
// Mirrors .github/llm/task-schema.json but runs in plain JS (no ajv dep).

import fs from "fs";
import path from "path";

const KEBAB = /^[a-z][a-z0-9-]*$/;
const DIFFICULTIES = ["easy", "medium", "hard"];

/**
 * @param {any} t
 * @param {object} [opts]
 * @param {string[]} [opts.allowedTopics]  dynamic categories from tasks/
 * @param {string} [opts.tasksRoot]       for slug uniqueness check
 * @returns {string[]}  human-readable errors (empty = valid)
 */
export function validateTask(t, opts = {}) {
  const errors = [];
  if (!t || typeof t !== "object" || Array.isArray(t)) {
    return ["Ожидается JSON-объект."];
  }

  const req = [
    "title", "topic", "slug", "difficulty", "tags", "language",
    "exports", "condition", "examples", "constraints",
    "templateCode", "solutionCode", "testCode", "hints", "source",
  ];
  for (const k of req) {
    if (!(k in t)) errors.push(`Отсутствует обязательное поле: ${k}.`);
  }
  if (errors.length) return errors;

  // title
  if (typeof t.title !== "string" || t.title.length < 3 || t.title.length > 120) {
    errors.push(`title должен быть строкой 3–120 символов.`);
  }

  // topic
  if (typeof t.topic !== "string" || !KEBAB.test(t.topic)) {
    errors.push(`topic должен быть kebab-case (получено ${JSON.stringify(t.topic)}).`);
  } else if (opts.allowedTopics && !opts.allowedTopics.includes(t.topic)) {
    errors.push(`topic "${t.topic}" не входит в список разрешённых категорий: ${opts.allowedTopics.join(", ")}.`);
  }

  // slug
  if (typeof t.slug !== "string" || !KEBAB.test(t.slug) || t.slug.length < 2 || t.slug.length > 60) {
    errors.push(`slug должен быть kebab-case строкой 2–60 символов (получено ${JSON.stringify(t.slug)}).`);
  } else if (opts.tasksRoot && slugExists(opts.tasksRoot, t.topic, t.slug)) {
    errors.push(`slug "${t.slug}" уже существует в категории "${t.topic}" — выбери уникальный slug.`);
  }

  // difficulty
  if (!DIFFICULTIES.includes(t.difficulty)) {
    errors.push(`difficulty должен быть easy|medium|hard (получено ${JSON.stringify(t.difficulty)}).`);
  }

  // tags
  if (!Array.isArray(t.tags) || t.tags.length < 1) {
    errors.push("tags должен быть непустым массивом.");
  } else {
    if (t.tags.length > 8) errors.push("tags должен содержать не более 8 элементов.");
    for (const tag of t.tags) {
      if (typeof tag !== "string" || !KEBAB.test(tag)) {
        errors.push(`тег ${JSON.stringify(tag)} не kebab-case.`);
      }
    }
    if (typeof t.tags[0] === "string" && t.tags[0] !== t.topic) {
      errors.push(`Первый тег должен совпадать с topic (${t.topic}), получено ${t.tags[0]}.`);
    }
  }

  // language
  if (t.language !== "typescript") {
    errors.push(`language должен быть "typescript".`);
  }

  // exports
  if (!Array.isArray(t.exports) || t.exports.length !== 1 || typeof t.exports[0] !== "string" || t.exports[0].length < 1) {
    errors.push("exports должен содержать ровно одно непустое имя функции.");
  }

  // examples / constraints (optional arrays, may be empty)
  for (const f of ["examples", "constraints"]) {
    if (!Array.isArray(t[f])) {
      errors.push(`${f} должен быть массивом (пустым, если данных нет).`);
    } else {
      for (const item of t[f]) {
        if (typeof item !== "string" || item.trim().length === 0) {
          errors.push(`каждый элемент ${f} должен быть непустой строкой.`);
          break;
        }
      }
    }
  }

  // code fields
  for (const f of ["condition", "templateCode", "solutionCode", "testCode"]) {
    if (typeof t[f] !== "string" || t[f].trim().length < 10) {
      errors.push(`${f} должен быть непустой строкой (мин. 10 символов).`);
    }
  }

  // sanity: solution exports the declared symbol
  if (typeof t.solutionCode === "string" && typeof t.exports?.[0] === "string") {
    const re = new RegExp(`export(?:\\s+const|\\s+function)\\s+${escapeReg(t.exports[0])}\\b`);
    if (!re.test(t.solutionCode)) {
      errors.push(`solutionCode не содержит \`export ${t.exports[0]}\`.`);
    }
  }
  if (typeof t.templateCode === "string" && typeof t.exports?.[0] === "string") {
    const re = new RegExp(`export(?:\\s+const|\\s+function)\\s+${escapeReg(t.exports[0])}\\b`);
    if (!re.test(t.templateCode)) {
      errors.push(`templateCode не содержит \`export ${t.exports[0]}\`.`);
    }
  }
  // test imports from ../solution
  if (typeof t.testCode === "string" && !/from\s+["']\.\.\/solution["']/.test(t.testCode)) {
    errors.push("testCode должен импортировать решение из \"../solution\".");
  }
  if (typeof t.testCode === "string" && !/import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*["']vitest["']/.test(t.testCode)) {
    errors.push('testCode должен использовать `import { test, expect } from "vitest"`.');
  }
  if (typeof t.testCode === "string" && /describe\s*\(/.test(t.testCode)) {
    errors.push("testCode не должен использовать describe (используй test).");
  }
  if (typeof t.solutionCode === "string" && /console\.log/.test(t.solutionCode)) {
    errors.push("solutionCode не должен содержать console.log.");
  }

  // hints
  if (!Array.isArray(t.hints) || t.hints.length < 1) {
    errors.push("hints должен быть непустым массивом строк.");
  } else {
    for (const h of t.hints) {
      if (typeof h !== "string" || h.trim().length < 5) {
        errors.push("Каждая подсказка должна быть строкой мин. 5 символов.");
      }
    }
  }

  // source
  const s = t.source;
  if (!s || typeof s !== "object") {
    errors.push("source должен быть объектом.");
  } else if (typeof s.name !== "string" || s.name.length < 1) {
    errors.push("source.name обязателен.");
  } else if (typeof s.url !== "string" || s.url.length < 1) {
    errors.push("source.url обязателен.");
  } else {
    try {
      new URL(s.url);
    } catch {
      errors.push(`source.url некорректен: ${s.url}`);
    }
  }

  return errors;
}

/** Check whether a slug already exists under tasks/<topic>/ (any number). */
function slugExists(tasksRoot, topic, slug) {
  const dir = path.join(tasksRoot, topic);
  if (!fs.existsSync(dir)) return false;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    // <NNN>-<slug>
    const m = entry.name.match(/^\d{3,}-(.+)$/);
    if (m && m[1] === slug) return true;
  }
  return false;
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
