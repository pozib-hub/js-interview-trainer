"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { TaskSummary } from "@/lib/types";
import TaskTree from "@/components/TaskTree";
import {
  useResizableLayout,
  DragHandle,
} from "@/lib/useResizableLayout";
import { useAppData } from "@/lib/useAppData";
import { fetchTopics } from "@/lib/taskApi";

export default function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [topics, setTopics] = useState<Record<string, TaskSummary[]>>({});
  const { layout, startDrag, containerRef } = useResizableLayout();
  const app = useAppData();

  useEffect(() => {
    fetchTopics().then((data) => setTopics(data));
  }, []);

  const taskCount = Object.values(topics).flat().length;
  const loadingTasks = taskCount === 0;

  const handleClearSolved = () => {
    if (app.solvedList.length === 0) return;
    if (confirm(`Сбросить все решённые задачи (${app.solvedList.length})?`)) {
      app.clearSolved();
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Interview Trainer</h1>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {loadingTasks ? (
            <><span className="spinner" style={{ marginRight: 6 }} />Загрузка…</>
          ) : (
            <>{taskCount} задач{app.solvedList.length > 0 && (
              <span style={{ marginLeft: 8, color: "var(--green)" }}>
                • решено: {app.solvedList.length}
              </span>
            )}</>
          )}
        </span>
        <div className="spacer" />
        {app.solvedList.length > 0 && (
          <button
            className="btn btn-sm"
            onClick={handleClearSolved}
            title="Сбросить все решённые задачи"
          >
            Сбросить решённые
          </button>
        )}
        <Link href="/interview" className="btn btn-sm" style={{ textDecoration: "none" }}>
          🎯 Собеседование
        </Link>
      </header>
      <div className="app-body" ref={containerRef}>
        <aside
          className="sidebar"
          style={{ width: layout.sidebar, flexShrink: 0 }}
        >
          <TaskTree
            topics={topics}
            isSolved={app.isSolved}
            onToggleSolved={app.toggleSolved}
          />
          {loadingTasks && (
            <div style={{ padding: 16 }}>
              <div className="skeleton skeleton-line" style={{ width: "60%" }} />
              <div className="skeleton skeleton-line" style={{ width: "80%" }} />
              <div className="skeleton skeleton-line" style={{ width: "50%" }} />
              <div className="skeleton skeleton-line" style={{ width: "70%" }} />
              <div className="skeleton skeleton-line" style={{ width: "65%" }} />
            </div>
          )}
        </aside>
        <DragHandle onMouseDown={(e) => startDrag("sidebar", e)} />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
