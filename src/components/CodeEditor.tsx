"use client";

import { lazy, Suspense } from "react";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));

interface Props {
  value: string;
  onChange: (v: string) => void;
  language?: string;
}

export default function CodeEditor({ value, onChange, language = "typescript" }: Props) {
  return (
    <div className="editor-wrap">
      <Suspense fallback={<EditorSkeleton />}>
        <MonacoEditor
          height="100%"
          language={language}
          theme="vs-dark"
          value={value}
          onChange={(v) => onChange(v ?? "")}
          loading={<EditorSkeleton />}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            tabSize: 2,
            automaticLayout: true,
            fontFamily: "'SF Mono', Monaco, Menlo, monospace",
            lineNumbers: "on",
            padding: { top: 12 },
          }}
        />
      </Suspense>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        background: "var(--bg)",
        color: "var(--text-muted)",
        fontSize: 13,
      }}
    >
      <span className="spinner" style={{ marginRight: 8 }} />
      Загрузка редактора…
    </div>
  );
}
