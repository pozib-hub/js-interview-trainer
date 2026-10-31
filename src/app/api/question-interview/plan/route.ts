import { NextResponse } from "next/server";
import { listQuestions } from "@lib/questions-scanner";
import { callLLMJSON, isLLMConfigured, LLMError, type LLMMessage } from "@lib/llm";
import type { PlanQuestion } from "@lib/types";

// ─── Константы сценария ───────────────────────────────────────────────────

const DURATION_MINUTES = 30;
/** Средний устный ответ + уточнения ≈ 2.5 мин → 12 вопросов на 30 минут */
const INITIAL_COUNT = 12;
const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 20;
/** Максимум итераций «оценка → коррекция»: гарантирует завершение цикла */
const MAX_ITERATIONS = 4;

interface PlanResponse {
  ok: boolean;
  reason?: string;
  finalIds?: string[];
}

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function POST(req: Request) {
  if (!isLLMConfigured()) {
    return NextResponse.json(
      { error: "LLM не настроен: задайте LLM_API_KEY в .env.local и перезапустите dev-сервер" },
      { status: 503 }
    );
  }

  let body: { direction?: string; technologies?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON в запросе" }, { status: 400 });
  }

  const directionId = body.direction ?? "";
  const index = listQuestions();
  const direction = index.directions.find((d) => d.id === directionId);
  if (!direction) {
    return NextResponse.json(
      { error: `Направление «${directionId}» не найдено` },
      { status: 400 }
    );
  }

  // Пул вопросов: выбранные технологии направления (или все), либо
  // собственные главы направления (hr).
  const pool: PlanQuestion[] = [];
  const techIds = new Set(body.technologies ?? []);
  const selectedTechs =
    body.technologies && body.technologies.length > 0
      ? direction.technologies.filter((t) => techIds.has(t.id))
      : direction.technologies;

  if (selectedTechs.length > 0) {
    for (const tech of selectedTechs) {
      for (const chapter of tech.chapters) {
        for (const q of chapter.questions) {
          pool.push({
            id: q.id,
            question: q.question,
            answer: q.answer,
            techTitle: tech.title,
            chapterTitle: chapter.title,
          });
        }
      }
    }
  } else if (direction.chapters.length > 0) {
    for (const chapter of direction.chapters) {
      for (const q of chapter.questions) {
        pool.push({
          id: q.id,
          question: q.question,
          answer: q.answer,
          techTitle: direction.title,
          chapterTitle: chapter.title,
        });
      }
    }
  }

  if (pool.length < MIN_QUESTIONS) {
    return NextResponse.json(
      { error: "Слишком мало вопросов в выбранной комбинации — выберите больше технологий" },
      { status: 400 }
    );
  }

  // Стартовая случайная выборка
  let current = fisherYates(pool).slice(0, Math.min(INITIAL_COUNT, pool.length));
  const poolIndex = new Map(pool.map((q) => [q.id, q]));

  // ─── Цикл «оценка → коррекция → повторная проверка» ─────────────────────
  let iterations = 0;
  let lastReason = "";
  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const resp = (await callLLMJSON(buildMessages(current, pool, selectedTechs.length > 0 ? selectedTechs.map((t) => t.title) : [direction.title]))) as unknown as PlanResponse;

      const finalIds = resp.finalIds;
      const valid =
        Array.isArray(finalIds) &&
        finalIds.length >= MIN_QUESTIONS &&
        finalIds.length <= MAX_QUESTIONS &&
        finalIds.every((id) => poolIndex.has(id));

      if (valid) {
        // Уникализируем и сохраняем порядок из ответа LLM
        current = [...new Set(finalIds)].map((id) => poolIndex.get(id)!);
      }

      if (resp.ok) break;
      lastReason = resp.reason ?? "";
      // ok=false + валидный finalIds → скорректированный список уйдёт
      // на следующую итерацию проверки. Ничего не делаем.
    }
  } catch (e) {
    const err = e as LLMError;
    return NextResponse.json(
      { error: err.message || "Не удалось сгенерировать план собеседования", detail: err.detail || "" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    questions: current,
    durationMinutes: DURATION_MINUTES,
    iterations,
    lastAdjustment: lastReason || null,
  });
}

function buildMessages(
  sample: PlanQuestion[],
  pool: PlanQuestion[],
  techTitles: string[]
): LLMMessage[] {
  const system = [
    `Ты — опытный технический интервьюер. Формируешь план устного собеседования на ${DURATION_MINUTES} минут.`,
    "",
    "Правила:",
    "- Устный ответ на вопрос занимает в среднем 2–3 минуты (краткий ответ кандидата + уточняющие вопросы).",
    `- Итоговый список должен укладываться в ${DURATION_MINUTES} минут и сбалансированно покрывать выбранные темы, без однотипных вопросов подряд.`,
    "- Меняй состав выборки только при необходимости: лишнее убирай, недостающее добавляй из пула.",
    "",
    "Верни строго JSON без пояснений:",
    '{"ok": true|false, "reason": "краткое пояснение", "finalIds": ["id1", "id2", ...]}',
    "",
    "ok=true — итоговый список из finalIds укладывается в лимит времени.",
    "finalIds — финальный список id вопросов в порядке проведения. Если выборка уже подходит — верни её же id с ok=true.",
  ].join("\n");

  const sampleLines = sample.map(
    (q) => `- ${q.id}: ${q.question} (глава: ${q.chapterTitle})`
  );
  const poolLines = pool
    .filter((q) => !sample.some((s) => s.id === q.id))
    .map((q) => `- ${q.id}: ${q.question}`);

  const user = [
    `Длительность собеседования: ${DURATION_MINUTES} минут.`,
    `Технологии: ${techTitles.join(", ")}.`,
    "",
    "Текущая выборка вопросов:",
    ...sampleLines,
    "",
    "Пул доступных вопросов (для добавления, только отсюда):",
    ...(poolLines.length > 0 ? poolLines : ["- (пул исчерпан — только убирай)"]),
    "",
    "Оцени выборку и верни JSON.",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
