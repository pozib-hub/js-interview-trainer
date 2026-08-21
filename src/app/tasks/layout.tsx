"use client";

import { useEffect, useState } from "react";
import type { TaskSummary } from "@lib/types";
import TaskTree from "@components/TaskTree";
import { useResizableLayout, DragHandle } from "@hooks/useResizableLayout";
import { useAppData } from "@hooks/useAppData";
import { fetchTopics } from "@lib/taskApi";
import { Box, Button, Skeleton, Spacer, Spinner, ThemeToggle, Typography } from "@ui/index";

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
    <div className="AppShell">
      <header className="AppHeader">
        <h1>Interview Trainer</h1>
        <Typography color="text-muted" size={12}>
          {loadingTasks ? (
            <>
              <Spinner mr={6} />
              Загрузка…
            </>
          ) : (
            <>
              {taskCount} задач
              {app.solvedList.length > 0 && (
                <Typography tag="span" color="green" ml={8}>
                  • решено: {app.solvedList.length}
                </Typography>
              )}
            </>
          )}
        </Typography>
        <Spacer />
        {app.solvedList.length > 0 && (
          <Button
            size="sm"
            onClick={handleClearSolved}
            title="Сбросить все решённые задачи"
          >
            Сбросить решённые
          </Button>
        )}
        <ThemeToggle />
        <Button size="sm" href="/interview">🎯 Собеседование</Button>
      </header>
      <div className="AppBody" ref={containerRef}>
        <aside
          className="Sidebar"
          style={{ width: layout.sidebar, flexShrink: 0 }}
        >
          <TaskTree
            topics={topics}
            isSolved={app.isSolved}
            onToggleSolved={app.toggleSolved}
          />
          {loadingTasks && (
            <Box p={16}>
              <Skeleton line width="60%" />
              <Skeleton line width="80%" />
              <Skeleton line width="50%" />
              <Skeleton line width="70%" />
              <Skeleton line width="65%" />
            </Box>
          )}
        </aside>
        <DragHandle
          onMouseDown={(e: React.MouseEvent) => startDrag("sidebar", e)}
        />
        <main className="Main">{children}</main>
      </div>
    </div>
  );
}
