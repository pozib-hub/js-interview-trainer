import type { RunResult, TaskFull, TaskSummary } from "./types";
import { runTestsInBrowser } from "./browser-runner";
import { apiFetch } from "./fetchApi";

const isStatic = typeof process.env.NEXT_PUBLIC_STATIC_MODE !== "undefined" && process.env.NEXT_PUBLIC_STATIC_MODE === "true";

export async function fetchTasks(): Promise<TaskSummary[]> {
  if (isStatic) {
    const res = await apiFetch("/tasks.json");
    const data = await res.json();
    return data.tasks || [];
  }
  const res = await fetch("/api/tasks");
  const data = await res.json();
  return data.tasks || [];
}

export async function fetchTopics(): Promise<Record<string, TaskSummary[]>> {
  if (isStatic) {
    const res = await apiFetch("/tasks.json");
    const data = await res.json();
    return data.topics || {};
  }
  const res = await fetch("/api/tasks");
  const data = await res.json();
  return data.topics || {};
}

export async function fetchTask(id: string): Promise<TaskFull | null> {
  if (isStatic) {
    const res = await apiFetch(`/tasks/${id}.json`);
    if (!res.ok) return null;
    return res.json();
  }
  const res = await fetch(`/api/task/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function runTests(taskId: string, code: string, testFile: string, taskExports?: string[]): Promise<RunResult> {
  if (isStatic) {
    return runTestsInBrowser(code, testFile, taskExports);
  }
  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, code }),
  });
  return res.json();
}
