"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { TaskSummary } from "@/lib/types";

interface Props {
  topics: Record<string, TaskSummary[]>;
  isSolved: (taskId: string) => boolean;
  onToggleSolved: (taskId: string) => void;
}

const DIFF_COLOR: Record<string, string> = {
  easy: "var(--green)",
  medium: "var(--yellow)",
  hard: "var(--red)",
};

export default function TaskTree({ topics, isSolved, onToggleSolved }: Props) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [hideSolved, setHideSolved] = useState(false);

  const currentId = pathname?.startsWith("/tasks/")
    ? decodeURIComponent(pathname.replace("/tasks/", ""))
    : null;

  const topicNames = Object.keys(topics).sort();

  const filteredTopics = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && !hideSolved) return null; // no filter

    const result: Record<string, TaskSummary[]> = {};
    for (const topic of topicNames) {
      const tasks = (topics[topic] || []).filter((t) => {
        if (hideSolved && isSolved(t.id)) return false;
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      });
      if (tasks.length > 0) result[topic] = tasks;
    }
    return result;
  }, [query, hideSolved, topics, isSolved, topicNames]);

  const displayTopics = filteredTopics ?? Object.fromEntries(
    topicNames.map((t) => [t, topics[t]])
  );
  const displayNames = Object.keys(displayTopics).sort();
  const totalShown = Object.values(displayTopics).flat().length;

  if (topicNames.length === 0) {
    return (
      <div style={{ padding: 16, color: "var(--text-muted)" }}>Загрузка…</div>
    );
  }

  return (
    <nav>
      <div className="search-box">
        <input
          type="text"
          placeholder="Поиск задач…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />
        {query && (
          <button
            className="search-clear"
            onClick={() => setQuery("")}
            title="Очистить"
          >
            ✕
          </button>
        )}
        <button
          className={`filter-btn ${hideSolved ? "active" : ""}`}
          onClick={() => setHideSolved((v) => !v)}
          title="Скрыть решённые"
        >
          {hideSolved ? "◐" : "○"}
        </button>
      </div>

      {(query || hideSolved) && (
        <div className="search-count">
          Найдено: {totalShown}
        </div>
      )}

      {displayNames.length === 0 ? (
        <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13 }}>
          Ничего не найдено
        </div>
      ) : (
        displayNames.map((topic) => {
          const tasks = displayTopics[topic] || [];
          const solvedCount = tasks.filter((t) => isSolved(t.id)).length;
          return (
            <div key={topic} className="topic-group">
              <div className="topic-title">
                {topic}
                {solvedCount > 0 && (
                  <span style={{ color: "var(--green)", marginLeft: 6, fontSize: 10 }}>
                    {solvedCount}/{tasks.length}
                  </span>
                )}
              </div>
              {tasks.map((task) => {
                const active = task.id === currentId;
                const solved = isSolved(task.id);
                return (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className={`task-item ${active ? "active" : ""}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <span
                      className={`dot ${solved ? "solved" : ""}`}
                      style={{
                        borderColor: solved ? "var(--green)" : DIFF_COLOR[task.difficulty],
                        background: solved ? "var(--green)" : "transparent",
                        cursor: "pointer",
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleSolved(task.id);
                      }}
                      title={solved ? "Отметить как нерешённую" : "Отметить как решённую"}
                    />
                    <span className="label" style={{ textDecoration: solved ? "line-through" : "none", opacity: solved ? 0.7 : 1 }}>
                      {task.title}
                    </span>
                  </Link>
                );
              })}
            </div>
          );
        })
      )}
    </nav>
  );
}
