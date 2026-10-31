import { NextResponse } from "next/server";
import { callLLMJSON, isLLMConfigured, LLMError, type LLMMessage } from "@lib/llm";

const MAX_ITEMS = 30;
const MAX_ANSWER_CHARS = 8000;

interface AnalyzeItem {
  id: string;
  question: string;
  referenceAnswer: string;
  userAnswer: string;
}

interface AnalyzeResponse {
  results: { id: string; ok: boolean; feedback: string }[];
  summary: string;
}

export async function POST(req: Request) {
  if (!isLLMConfigured()) {
    return NextResponse.json(
      { error: "LLM не настроен: задайте LLM_API_KEY в .env.local и перезапустите dev-сервер" },
      { status: 503 }
    );
  }

  let body: { items?: AnalyzeItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON в запросе" }, { status: 400 });
  }

  const items = (body.items ?? [])
    .filter(
      (it) =>
        typeof it?.id === "string" &&
        typeof it?.question === "string" &&
        typeof it?.userAnswer === "string" &&
        it.userAnswer.trim().length > 0
    )
    .slice(0, MAX_ITEMS)
    .map((it) => ({
      ...it,
      userAnswer: it.userAnswer.slice(0, MAX_ANSWER_CHARS),
      referenceAnswer: (it.referenceAnswer ?? "").slice(0, MAX_ANSWER_CHARS),
    }));

  if (items.length === 0) {
    return NextResponse.json(
      { error: "Нет вопросов с ответами для разбора" },
      { status: 400 }
    );
  }

  const system = [
    "Ты — технический интервьюер. Кандидат прошёл устное собеседование:",
    "вопросы задавались по очереди, ответы давались голосом и распознаны в текст",
    "(могут быть ошибки распознавания — не суди строго за опечатки и отсутствие пунктуации).",
    "",
    "Разбери каждый ответ:",
    "- ok=true — если ответ по сути корректен (мелкие неточности допустимы);",
    "  false — если ответ неверный, существенно неполный или мимо вопроса.",
    "- feedback — 1–3 предложения: что верно, что нет, что стоит повторить.",
    "  Кратко и по делу, без воды.",
    "",
    "Верни строго JSON без пояснений:",
    '{"results": [{"id": "...", "ok": true, "feedback": "..."}], "summary": "общий итог 2–3 предложения и главный совет"}',
    "",
    "В results — по одному объекту на каждый вопрос с тем же id.",
  ].join("\n");

  const user = [
    `Ответы кандидата (${items.length} вопросов):`,
    "",
    JSON.stringify(
      items.map((it) => ({
        id: it.id,
        question: it.question,
        referenceAnswer: it.referenceAnswer,
        userAnswer: it.userAnswer,
      })),
      null,
      1
    ),
  ].join("\n");

  let parsed: AnalyzeResponse;
  try {
    parsed = (await callLLMJSON(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ] as LLMMessage[],
      { timeoutMs: 180_000 }
    )) as unknown as AnalyzeResponse;
  } catch (e) {
    const err = e as LLMError;
    return NextResponse.json(
      { error: err.message || "Не удалось разобрать ответы", detail: err.detail || "" },
      { status: 502 }
    );
  }

  // Валидируем и заполняем пробелы: на каждый вопрос должен быть вердикт
  const byId = new Map<string, { id: string; ok: boolean; feedback: string }>();
  if (Array.isArray(parsed.results)) {
    for (const r of parsed.results) {
      if (typeof r?.id === "string") {
        byId.set(r.id, {
          id: r.id,
          ok: r.ok === true,
          feedback: typeof r.feedback === "string" ? r.feedback : "",
        });
      }
    }
  }

  const results = items.map((it) => {
    const r = byId.get(it.id);
    return (
      r ?? {
        id: it.id,
        ok: false,
        feedback: "ИИ не оценил этот ответ — вердикт не получен.",
      }
    );
  });

  return NextResponse.json({
    results,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  });
}
