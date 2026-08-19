"use client";

import { useState } from "react";

interface Props {
  condition: string;
  hints: string[];
}

export default function ConditionPanel({ condition, hints }: Props) {
  const [hintIndex, setHintIndex] = useState(-1);

  return (
    <div className="condition">
      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(condition) }} />

      {hints.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            className="btn btn-sm"
            onClick={() =>
              setHintIndex((i) => (i >= hints.length - 1 ? i : i + 1))
            }
            disabled={hintIndex >= hints.length - 1}
          >
            {hintIndex < 0 ? "Показать подсказку" : "Следующая подсказка"}
          </button>
          {hintIndex >= 0 && (
            <>
              {hints.slice(0, hintIndex + 1).map((h, i) => (
                <div key={i} className="hint-block">
                  <strong style={{ color: "var(--yellow)" }}>
                    Подсказка {i + 1}:
                  </strong>
                  <div
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(h) }}
                    style={{ marginTop: 6 }}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Минимальный markdown-рендер для условий задач. */
function renderMarkdown(md: string): string {
  let html = md;
  // экранируем HTML
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // блоки кода
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, _lang, code) =>
    `<pre><code>${code.replace(/\n$/, "")}</code></pre>`
  );
  // инлайн-код
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // заголовки
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // жирный
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // параграфы / переносы
  html = html
    .split(/\n\n+/)
    .map((block) => (block.startsWith("<") ? block : `<p>${block.replace(/\n/g, "<br>")}</p>`))
    .join("\n");
  return html;
}
