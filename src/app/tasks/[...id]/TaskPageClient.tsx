"use client";

import { useEffect, useRef, useState } from "react";
import type { RunResult, TaskFull } from "@/lib/types";
import CodeEditor from "@/components/CodeEditor";
import ConditionPanel from "@/components/ConditionPanel";
import TestResults from "@/components/TestResults";
import { useResizableLayout, DragHandle, HDragHandle } from "@/lib/useResizableLayout";
import { useAppData } from "@/lib/useAppData";
import { fetchTask, runTests } from "@/lib/taskApi";

const STORAGE_PREFIX = "it:code:";

export default function TaskPageClient({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<TaskFull | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(true);
  const [tab, setTab] = useState<"condition" | "solution">("condition");
  const [showSolution, setShowSolution] = useState(false);

  const { layout, startDrag } = useResizableLayout();
  const app = useAppData();

  const saveCodeRef = useRef(app.saveCode);
  saveCodeRef.current = app.saveCode;

  const codeRef = useRef(code);
  const taskIdRef = useRef(taskId);
  codeRef.current = code;
  taskIdRef.current = taskId;

  useEffect(() => {
    return () => {
      const id = taskIdRef.current;
      const c = codeRef.current;
      if (c) {
        localStorage.setItem(STORAGE_PREFIX + id, c);
        saveCodeRef.current(id, c);
      }
    };
  }, []);

  useEffect(() => {
    setTask(null);
    setTaskLoading(true);
    setResult(null);
    setTab("condition");
    setShowSolution(false);
    fetchTask(taskId)
      .then((data) => {
        setTask(data);
        if (data) {
          const saved = localStorage.getItem(STORAGE_PREFIX + taskId);
          setCode(saved ?? data.template);
        }
      })
      .finally(() => setTaskLoading(false));
  }, [taskId]);

  const run = async () => {
    if (!task) return;
    setLoading(true);
    setResult(null);
    localStorage.setItem(STORAGE_PREFIX + taskId, code);
    try {
      const data = await runTests(taskId, code, task.testFile, task.exports);
      setResult(data);
      if (data.passed) {
        app.markSolved(taskId);
        app.saveCode(taskId, code);
      }
    } catch (e) {
      setResult({
        taskId,
        passed: false,
        total: 0,
        failed: 0,
        assertions: [],
        stdout: "",
        stderr: String(e),
        durationMs: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    if (!task) return;
    if (confirm("Сбросить код к шаблону?")) {
      setCode(task.template);
      localStorage.removeItem(STORAGE_PREFIX + taskId);
    }
  };

  if (taskLoading || !task) {
    return (
      <div className="workspace">
        <div className="left-pane" style={{ width: layout.leftPane, flexShrink: 0 }}>
          <div style={{ padding: 20 }}>
            <div className="skeleton skeleton-line" style={{ width: "70%", height: 20 }} />
            <div className="skeleton skeleton-line" style={{ width: "40%", height: 14, marginTop: 12 }} />
            <div className="skeleton skeleton-line" style={{ width: "90%", height: 14, marginTop: 20 }} />
            <div className="skeleton skeleton-line" style={{ width: "85%", height: 14, marginTop: 8 }} />
            <div className="skeleton skeleton-line" style={{ width: "60%", height: 14, marginTop: 8 }} />
          </div>
        </div>
        <div className="right-pane">
          <div className="editor-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
          </div>
        </div>
      </div>
    );
  }

  const isTaskSolved = app.isSolved(taskId);

  return (
    <div className="workspace">
      <div
        className="left-pane"
        style={{ width: layout.leftPane, flexShrink: 0 }}
      >
        <div className="tabs">
          <div
            className={`tab ${tab === "condition" ? "active" : ""}`}
            onClick={() => setTab("condition")}
          >
            Условие
          </div>
          <div
            className={`tab ${tab === "solution" ? "active" : ""}`}
            onClick={() => setTab("solution")}
          >
            Решение
          </div>
          <div className="spacer" style={{ flex: 1 }} />
          {isTaskSolved && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                alignSelf: "center",
                color: "var(--green)",
                fontSize: 12,
                marginRight: 12,
              }}
            >
              ✓ Решено
              <button
                className="btn btn-sm"
                onClick={() => app.toggleSolved(taskId)}
                title="Отметить как нерешённую"
                style={{ padding: "2px 8px", fontSize: 11 }}
              >
                Сбросить
              </button>
            </span>
          )}
        </div>
        {tab === "condition" ? (
          <>
            <div style={{ padding: "16px 20px 0" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18 }}>{task.title}</h2>
                <span className={`difficulty-badge ${task.difficulty}`}>
                  {task.difficulty}
                </span>
              </div>
              <div style={{ marginTop: 8, marginBottom: 4 }}>
                {task.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <ConditionPanel condition={task.condition} hints={task.hints} />
          </>
        ) : (
          <div className="condition">
            <button
              className="btn btn-sm"
              onClick={() => setShowSolution((s) => !s)}
            >
              {showSolution ? "Скрыть эталон" : "Показать эталонное решение"}
            </button>
            {showSolution ? (
              <pre
                style={{
                  marginTop: 12,
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: 12,
                  fontSize: 13,
                }}
              >
                <code>{task.solution}</code>
              </pre>
            ) : (
              <p style={{ color: "var(--text-muted)", marginTop: 12 }}>
                Эталон скрыт. Сначала попробуйте решить самостоятельно.
              </p>
            )}
          </div>
        )}
      </div>

      <DragHandle onMouseDown={(e) => startDrag("leftPane", e)} />

      <div className="right-pane">
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "8px 12px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <button
            className="btn btn-primary"
            onClick={run}
            disabled={loading || !code.trim()}
          >
            {loading ? "Запуск…" : "▶ Запустить тесты"}
          </button>
          <button className="btn" onClick={reset}>
            Сбросить
          </button>
          <span
            style={{
              alignSelf: "center",
              color: "var(--text-muted)",
              fontSize: 12,
            }}
          >
            {task.language}
          </span>
        </div>
        <CodeEditor
          value={code}
          onChange={setCode}
          language={task.language === "typescript" ? "typescript" : "javascript"}
        />
        <HDragHandle onMouseDown={(e) => startDrag("resultsHeight", e)} />
        <TestResults result={result} loading={loading} height={layout.resultsHeight} />
      </div>
    </div>
  );
}
