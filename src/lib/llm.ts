// Серверный LLM-клиент (OpenAI-compatible) для устных собеседований.
// Конфигурация через env (те же переменные, что у workflow-генераторов):
//   LLM_API_KEY (или DEEPSEEK_API_KEY / OPENAI_API_KEY)
//   LLM_BASE_URL — по умолчанию https://api.deepseek.com/v1
//   LLM_MODEL    — по умолчанию deepseek-chat

const DEFAULTS = {
  baseUrl: process.env.LLM_BASE_URL || "https://api.deepseek.com/v1",
  model: process.env.LLM_MODEL || "deepseek-chat",
  apiKey:
    process.env.LLM_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "",
};

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function isLLMConfigured(): boolean {
  return DEFAULTS.apiKey !== "";
}

export function llmModelName(): string {
  return DEFAULTS.model;
}

export class LLMError extends Error {
  detail: string;
  constructor(message: string, detail: string) {
    super(message);
    this.detail = detail;
  }
}

/**
 * Вызов LLM с ожиданием JSON-ответа (response_format: json_object).
 * Возвращает распарсенный объект.
 */
export async function callLLMJSON(
  messages: LLMMessage[],
  opts: { timeoutMs?: number; maxRetries?: number } = {}
): Promise<Record<string, unknown>> {
  const { timeoutMs = 120_000, maxRetries = 1 } = opts;
  if (!DEFAULTS.apiKey) {
    throw new LLMError(
      "LLM не настроен: задайте LLM_API_KEY в .env.local",
      "Скопируйте ключ провайдера (DeepSeek/OpenAI или любой OpenAI-compatible)."
    );
  }

  const url = DEFAULTS.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const body = JSON.stringify({
    model: DEFAULTS.model,
    messages,
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEFAULTS.apiKey}`,
        },
        body,
        signal: controller.signal,
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = new LLMError(`LLM временно недоступен: ${res.status}`, "");
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new LLMError(`LLM API error: ${res.status}`, text.slice(0, 1000));
      }

      const data = await res.json();
      const content: unknown = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new LLMError("LLM вернул пустый ответ", JSON.stringify(data).slice(0, 500));
      }
      return parseJsonContent(content);
    } catch (e) {
      if (e instanceof LLMError) throw e;
      lastErr = e;
      if (attempt < maxRetries) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new LLMError("LLM call failed", "");
}

/**
 * Парсинг ответа модели в JSON.
 * Толерантен к fenced code blocks и prose вокруг JSON.
 * Важно: внутри JSON-строк могут быть ```-блоки — сначала пробуем прямой
 * парсинг, фенсы срезаем только при неудаче.
 */
export function parseJsonContent(content: string): Record<string, unknown> {
  let txt = content.trim();

  try {
    return JSON.parse(txt) as Record<string, unknown>;
  } catch {}

  if (txt.startsWith("```")) {
    const firstNl = txt.indexOf("\n");
    if (firstNl !== -1) {
      let inner = txt.slice(firstNl + 1);
      const lastFence = inner.lastIndexOf("```");
      if (lastFence !== -1) inner = inner.slice(0, lastFence);
      inner = inner.trim();
      try {
        return JSON.parse(inner) as Record<string, unknown>;
      } catch {}
    }
  }

  const start = txt.indexOf("{");
  const end = txt.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return JSON.parse(txt.slice(start, end + 1)) as Record<string, unknown>;
  }

  throw new LLMError("LLM вернул невалидный JSON", txt.slice(0, 2000));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
