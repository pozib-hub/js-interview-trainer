"use client";

import type { RunResult } from "@/lib/types";

export default function TestResults({
  result,
  loading,
  height = 260,
}: {
  result: RunResult | null;
  loading: boolean;
  height?: number;
}) {
  return (
    <div
      className="results-panel"
      style={{ height, flexShrink: 0 }}
    >
      {loading ? (
        <div className="results-summary">
          <span className="spinner" style={{ marginRight: 8 }} />
          Запуск тестов…
        </div>
      ) : !result ? (
        <div className="results-summary" style={{ color: "var(--text-muted)" }}>
          Нажмите «Запустить тесты», чтобы проверить решение
        </div>
      ) : (
        <>
          <div className={`results-summary ${result.passed ? "ok" : "fail"}`}>
            {result.passed
              ? `✓ Все тесты пройдены (${result.total})`
              : `✗ Провалено: ${result.failed} из ${result.total}`}
            <span style={{ float: "right", color: "var(--text-muted)", fontWeight: 400 }}>
              {result.durationMs} мс
            </span>
          </div>
          {result.assertions.map((a, i) => (
            <div key={i} className={`result-item ${a.passed ? "passed" : "failed"}`}>
              {a.passed ? "✓" : "✗"} {a.name}
              {a.message && <div className="msg">{a.message}</div>}
            </div>
          ))}
          {result.stderr && (
            <div className="result-item" style={{ color: "var(--text-muted)" }}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{result.stderr}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
