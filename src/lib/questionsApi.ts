import type { QuestionsIndex } from "./types";
import { apiFetch } from "./fetchApi";

const isStatic =
  typeof process.env.NEXT_PUBLIC_STATIC_MODE !== "undefined" &&
  process.env.NEXT_PUBLIC_STATIC_MODE === "true";

export async function fetchQuestionsIndex(): Promise<QuestionsIndex> {
  if (isStatic) {
    const res = await apiFetch("/questions.json");
    const data = await res.json();
    return data;
  }
  const res = await fetch("/api/questions");
  const data = await res.json();
  return data;
}

/** Общее число вопросов в направлении (через технологии + собственные главы). */
export function directionQuestionCount(direction: QuestionsIndex["directions"][number]): number {
  const viaTech = direction.technologies.reduce(
    (n, t) => n + t.chapters.reduce((m, c) => m + c.questions.length, 0),
    0
  );
  const own = direction.chapters.reduce((n, c) => n + c.questions.length, 0);
  return viaTech + own;
}

export function technologyQuestionCount(technology: QuestionsIndex["directions"][number]["technologies"][number]): number {
  return technology.chapters.reduce((n, c) => n + c.questions.length, 0);
}

// ─── Категории пользовательских вопросов ────────────────────────────────────

export interface QuestionCategoryOption {
  /** id технологии ("frontend/javascript") или направления ("hr") */
  value: string;
  label: string;
}

/** Список категорий для привязки пользовательских вопросов. */
export function buildCategoryOptions(index: QuestionsIndex): QuestionCategoryOption[] {
  const out: QuestionCategoryOption[] = [];
  for (const d of index.directions) {
    if (d.technologies.length > 0) {
      for (const t of d.technologies) {
        out.push({ value: t.id, label: `${d.title} / ${t.title}` });
      }
    } else {
      out.push({ value: d.id, label: d.title });
    }
  }
  return out;
}

/** Человекочитаемое название категории ("frontend/javascript" → "Frontend / JavaScript"). */
export function categoryLabel(index: QuestionsIndex, value: string): string {
  if (!value) return "Без категории";
  for (const d of index.directions) {
    const tech = d.technologies.find((t) => t.id === value);
    if (tech) return `${d.title} / ${tech.title}`;
    if (d.id === value) return d.title;
  }
  return "Без категории";
}
