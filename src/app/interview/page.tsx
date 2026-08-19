"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RunResult, TaskFull, TaskSummary } from "@/lib/types";
import CodeEditor from "@/components/CodeEditor";
import { useResizableLayout, DragHandle, HDragHandle } from "@/lib/useResizableLayout";
import { useAppData, pickRandomTasks, type InterviewSession } from "@/lib/useAppData";
import { fetchTasks, fetchTask, runTests } from "@/lib/taskApi";

type Phase = "setup" | "running" | "results";

const STORAGE_PREFIX = "it:code:";

export default function InterviewPage() {
  return <InterviewInner />;
}

function InterviewInner() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [allTasks, setAllTasks] = useState<TaskSummary[]>([]);
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [task, setTask] = useState<TaskFull | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [showSolution, setShowSolution] = useState(false);

  const { layout, startDrag, containerRef } = useResizableLayout();
  const app = useAppData();
  const startedRef = useRef(false);

  // Refs to avoid re-creating callbacks when app methods change identity
  const getCodeRef = useRef(app.getCode);
  const saveCodeRef = useRef(app.saveCode);
  const markSolvedRef = useRef(app.markSolved);
  const getUsedTaskIdsRef = useRef(app.getUsedTaskIds);
  const saveSessionRef = useRef(app.saveSession);
  getCodeRef.current = app.getCode;
  saveCodeRef.current = app.saveCode;
  markSolvedRef.current = app.markSolved;
  getUsedTaskIdsRef.current = app.getUsedTaskIds;
  saveSessionRef.current = app.saveSession;

  useEffect(() => {
    fetchTasks().then((data) => setAllTasks(data));
  }, []);

  const loadTask = useCallback((taskId: string) => {
    setTask(null);
    setTaskLoading(true);
    setResult(null);
    setShowSolution(false);
    fetchTask(taskId)
      .then((data: TaskFull | null) => {
        setTask(data);
        if (data) {
          const saved = getCodeRef.current(taskId) ?? localStorage.getItem(STORAGE_PREFIX + taskId);
          setCode(saved ?? data.template);
        }
      })
      .finally(() => setTaskLoading(false));
  }, []);

  const startInterview = useCallback(() => {
    if (allTasks.length === 0 || startedRef.current) return;
    startedRef.current = true;

    const count = Math.min(5 + Math.floor(Math.random() * 3), allTasks.length); // 5-7
    const usedIds = getUsedTaskIdsRef.current();
    const picked = pickRandomTasks(allTasks, count, usedIds);

    setTaskIds(picked);
    setCurrentIndex(0);
    setResults({});
    setPhase("running");
    loadTask(picked[0]);
  }, [allTasks, loadTask]);

  const run = async () => {
    if (!task) return;
    setLoading(true);
    setResult(null);
    localStorage.setItem(STORAGE_PREFIX + task.id, code);
    try {
      const data = await runTests(task.id, code, task.testFile, task.exports);
      setResult(data);
      setResults((prev) => ({ ...prev, [task.id]: data.passed }));
      if (data.passed) markSolvedRef.current(task.id);
    } catch (e) {
      setResult({
        taskId: task.id,
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

  const saveCurrentCode = useCallback(() => {
    if (task) {
      localStorage.setItem(STORAGE_PREFIX + task.id, code);
      saveCodeRef.current(task.id, code);
    }
  }, [task, code]);

  const switchTask = useCallback((index: number) => {
    saveCurrentCode();
    setCurrentIndex(index);
    loadTask(taskIds[index]);
  }, [saveCurrentCode, loadTask, taskIds]);

  const goNext = useCallback(() => {
    if (currentIndex + 1 >= taskIds.length) {
      saveCurrentCode();
      const session: InterviewSession = {
        id: Date.now().toString(),
        date: Date.now(),
        taskIds,
        results,
      };
      saveSessionRef.current(session);
      setPhase("results");
    } else {
      switchTask(currentIndex + 1);
    }
  }, [currentIndex, taskIds, results, switchTask, saveCurrentCode]);

  const goPrev = useCallback(() => {
    if (currentIndex === 0) return;
    switchTask(currentIndex - 1);
  }, [currentIndex, switchTask]);

  const finishEarly = useCallback(() => {
    if (confirm("Завершить тренировку досрочно?")) {
      saveCurrentCode();
      const session: InterviewSession = {
        id: Date.now().toString(),
        date: Date.now(),
        taskIds,
        results,
      };
      saveSessionRef.current(session);
      setPhase("results");
    }
  }, [taskIds, results, saveCurrentCode]);

  // ===== SETUP PHASE =====
  if (phase === "setup") {
    const solvedCount = app.solvedList.length;
    const usedCount = app.getUsedTaskIds().size;
    const totalTasks = allTasks.length;

    return (
      <div className="app-shell">
        <header className="app-header">
          <h1>Interview Trainer</h1>
          <div className="spacer" />
          <a href="/tasks" className="btn btn-sm" style={{ textDecoration: "none" }}>
            ← К списку задач
          </a>
        </header>
        <div className="main" style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ maxWidth: 520, width: "100%", padding: 40 }}>
            <h2 style={{ marginBottom: 8 }}>Режим собеседования</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
              Случайно выбираются 5–7 задач из разных тем.
              Задачи, которые уже были в прошлых тренировках,
              не повторяются (или повторяются минимально).
            </p>

            <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-value">{totalTasks}</div>
                <div className="stat-label">Всего задач</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{solvedCount}</div>
                <div className="stat-label">Решено</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{app.sessions.length}</div>
                <div className="stat-label">Тренировок</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{usedCount}</div>
                <div className="stat-label">Пройдено в тренировках</div>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={startInterview}
              disabled={allTasks.length < 5}
              style={{ width: "100%", padding: "12px", fontSize: 15 }}
            >
              {allTasks.length < 5 ? "Загрузка задач…" : "▶ Начать тренировку"}
            </button>

            {app.sessions.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <h3 style={{ fontSize: 14, marginBottom: 12 }}>История тренировок</h3>
                {app.sessions.slice(0, 5).map((s) => {
                  const passed = Object.values(s.results).filter(Boolean).length;
                  return (
                    <div key={s.id} className="history-item">
                      <span style={{ color: "var(--text-muted)" }}>
                        {new Date(s.date).toLocaleString("ru-RU")}
                      </span>
                      <span>
                        {passed}/{s.taskIds.length} решено
                      </span>
                      <span style={{ color: passed === s.taskIds.length ? "var(--green)" : "var(--text-muted)" }}>
                        {passed === s.taskIds.length ? "✓" : "○"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== RESULTS PHASE =====
  if (phase === "results") {
    const passedCount = Object.values(results).filter(Boolean).length;
    const total = taskIds.length;

    return (
      <div className="app-shell">
        <header className="app-header">
          <h1>Результаты тренировки</h1>
          <div className="spacer" />
        </header>
        <div className="main" style={{ alignItems: "center", justifyContent: "center" }}>
          <div style={{ maxWidth: 600, width: "100%", padding: 40 }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: passedCount === total ? "var(--green)" : "var(--accent)" }}>
                {passedCount}/{total}
              </div>
              <div style={{ color: "var(--text-muted)", marginTop: 8 }}>
                {passedCount === total
                  ? "Все задачи решены!"
                  : `${total - passedCount} задач не решено`}
              </div>
            </div>

            <div style={{ marginBottom: 32 }}>
              {taskIds.map((id, i) => {
                const passed = results[id];
                return (
                  <div key={id} className="history-item">
                    <span style={{ color: "var(--text-muted)" }}>#{i + 1}</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {id}
                    </span>
                    <span style={{ color: passed ? "var(--green)" : "var(--red)" }}>
                      {passed ? "✓ Решено" : "✗ Не решено"}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              className="btn btn-primary"
              onClick={() => {
                startedRef.current = false;
                setPhase("setup");
              }}
              style={{ width: "100%", padding: "12px", fontSize: 15 }}
            >
              Новая тренировка
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== RUNNING PHASE =====
  if (taskLoading || !task) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <h1>Собеседование</h1>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            <span className="spinner" style={{ marginRight: 6 }} />
            Загрузка задачи…
          </span>
        </header>
        <div className="app-body">
          <div className="left-pane" style={{ width: layout.leftPane, flexShrink: 0 }}>
            <div style={{ padding: 20 }}>
              <div className="skeleton skeleton-line" style={{ width: "70%", height: 20 }} />
              <div className="skeleton skeleton-line" style={{ width: "40%", height: 14, marginTop: 12 }} />
              <div className="skeleton skeleton-line" style={{ width: "90%", height: 14, marginTop: 20 }} />
              <div className="skeleton skeleton-line" style={{ width: "85%", height: 14, marginTop: 8 }} />
            </div>
          </div>
          <div className="right-pane">
            <div className="editor-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const passedCount = Object.values(results).filter(Boolean).length;

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Собеседование</h1>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
          Задача {currentIndex + 1} из {taskIds.length} • решено: {passedCount}
        </span>
        <div className="spacer" />
        <button className="btn btn-sm" onClick={finishEarly}>
          Завершить
        </button>
      </header>

      {/* Progress bar */}
      <div className="interview-progress">
        {taskIds.map((id, i) => {
          const r = results[id];
          const isCurrent = i === currentIndex;
          return (
            <div
              key={id}
              className={`progress-step ${
                isCurrent ? "current" : r === true ? "done" : r === false ? "fail" : ""
              }`}
              onClick={() => {
                switchTask(i);
              }}
              title={id}
            >
              {i + 1}
            </div>
          );
        })}
      </div>

      <div className="app-body" ref={containerRef}>
        <div
          className="left-pane"
          style={{ width: layout.leftPane, flexShrink: 0 }}
        >
          <div style={{ padding: "16px 20px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{task.title}</h2>
              <span className={`difficulty-badge ${task.difficulty}`}>
                {task.difficulty}
              </span>
            </div>
            <div style={{ marginTop: 8, marginBottom: 4 }}>
              <span className="tag">{task.topic}</span>
              {task.tags.slice(0, 3).map((t) => (
                <span key={t} className="tag">{t}</span>
              ))}
            </div>
          </div>
          <ConditionPanel condition={task.condition} hints={[]} />
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
              {loading ? "Запуск…" : "▶ Проверить"}
            </button>
            <button className="btn btn-sm" onClick={() => setShowSolution((s) => !s)}>
              {showSolution ? "Скрыть" : "Эталон"}
            </button>
            <div className="spacer" />
            <button
              className="btn btn-sm"
              onClick={goPrev}
              disabled={currentIndex === 0}
            >
              ←
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={goNext}
            >
              {currentIndex + 1 >= taskIds.length ? "Готово ✓" : "Дальше →"}
            </button>
          </div>

          {showSolution && (
            <pre
              style={{
                margin: 0,
                background: "var(--bg)",
                borderBottom: "1px solid var(--border)",
                padding: 12,
                fontSize: 13,
                maxHeight: 200,
                overflow: "auto",
              }}
            >
              <code>{task.solution}</code>
            </pre>
          )}

          <CodeEditor
            value={code}
            onChange={setCode}
            language={task.language === "typescript" ? "typescript" : "javascript"}
          />
          <HDragHandle onMouseDown={(e) => startDrag("resultsHeight", e)} />
          <TestResults result={result} loading={loading} height={layout.resultsHeight} />
        </div>
      </div>
    </div>
  );
}

function ConditionPanel({ condition, hints }: { condition: string; hints: string[] }) {
  return (
    <div className="condition" style={{ paddingTop: 12 }}>
      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(condition) }} />
    </div>
  );
}

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const code = match.replace(/```\w*\n?/, "").replace(/```$/, "");
    return `<pre><code>${code}</code></pre>`;
  });

  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  return html;
}

function TestResults({
  result,
  loading,
  height = 260,
}: {
  result: RunResult | null;
  loading: boolean;
  height?: number;
}) {
  if (loading) {
    return (
      <div className="results-panel" style={{ height, flexShrink: 0 }}>
        <div className="results-summary">
          <span className="spinner" style={{ marginRight: 8 }} />
          Запуск тестов…
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="results-panel" style={{ height, flexShrink: 0 }}>
        <div className="results-summary" style={{ color: "var(--text-muted)" }}>
          Нажмите «Проверить», чтобы проверить решение
        </div>
      </div>
    );
  }

  return (
    <div className="results-panel" style={{ height, flexShrink: 0 }}>
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
    </div>
  );
}
