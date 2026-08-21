// Minimal OpenAI-compatible chat completions client.
// Uses native fetch (Node 22). Supports DeepSeek, OpenAI, OpenRouter, Groq, etc.
// No SDK dependency — fully pluggable via env vars.

const DEFAULTS = {
  // DeepSeek is OpenAI-compatible: https://api.deepseek.com/v1
  baseUrl: process.env.LLM_BASE_URL || "https://api.deepseek.com/v1",
  model: process.env.LLM_MODEL || "deepseek-chat",
  apiKey:
    process.env.LLM_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "",
  // Optional retry config.
  maxRetries: Number(process.env.LLM_MAX_RETRIES || "2"),
  timeoutMs: Number(process.env.LLM_TIMEOUT_MS || "90000"),
};

/**
 * Call the LLM and return the parsed JSON object.
 * Uses response_format json_object (widely supported across OpenAI-compatible
 * providers). The schema is also embedded in the system message to guide
 * structured output (works even where strict json_schema is unsupported).
 *
 * @param {object} opts
 * @param {string} opts.systemMessage
 * @param {string} opts.userMessage
 * @returns {Promise<Record<string, unknown>>}
 */
export async function callLLM({ systemMessage, userMessage }) {
  const { baseUrl, model, apiKey, maxRetries, timeoutMs } = DEFAULTS;
  if (!apiKey) {
    throw new Error(
      "LLM API key not set. Define LLM_API_KEY (or DEEPSEEK_API_KEY / OPENAI_API_KEY) in the environment / GitHub Secrets.",
    );
  }

  const body = {
    model,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  };

  const url = baseUrl.replace(/\/+$/, "") + "/chat/completions";

  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.status === 429 || res.status >= 500) {
        // Transient — retry with backoff.
        lastErr = new Error(`LLM transient error: ${res.status} ${res.statusText}`);
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new LLMError(
          `LLM API error: ${res.status} ${res.statusText}`,
          text.slice(0, 1000),
        );
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new LLMError("LLM returned empty content", JSON.stringify(data).slice(0, 500));
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
      clearTimeout(timeout);
    }
  }
  throw lastErr || new Error("LLM call failed after retries");
}

class LLMError extends Error {
  constructor(message, detail) {
    super(message);
    this.detail = detail;
  }
}

/**
 * Parse the model's content into a JSON object, tolerating fenced code blocks
 * and leading prose.
 */
export function parseJsonContent(content) {
  let txt = content.trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) txt = fence[1].trim();
  if (!txt.startsWith("{")) {
    const start = txt.indexOf("{");
    const end = txt.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      txt = txt.slice(start, end + 1);
    }
  }
  try {
    return JSON.parse(txt);
  } catch (e) {
    throw new LLMError(`LLM вернул невалидный JSON: ${e.message}`, txt.slice(0, 2000));
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
