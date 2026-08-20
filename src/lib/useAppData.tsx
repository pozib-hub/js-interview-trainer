"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "./fetchApi";

export interface InterviewSession {
  id: string;
  date: number;
  taskIds: string[];
  results: Record<string, boolean>;
}

export interface AppData {
  solved: string[];
  sessions: InterviewSession[];
  code: Record<string, string>;
  layout: { sidebar: number; leftPane: number };
}

const LS_KEYS = {
  solved: "it:solved",
  sessions: "it:interview-history",
  layout: "it:layout",
};

function loadFromStorage(): AppData {
  let solved: string[] = [];
  let sessions: InterviewSession[] = [];
  let layout = { sidebar: 280, leftPane: 420 };
  const code: Record<string, string> = {};

  try {
    const raw = localStorage.getItem(LS_KEYS.solved);
    if (raw) solved = JSON.parse(raw);
  } catch {}
  try {
    const raw = localStorage.getItem(LS_KEYS.sessions);
    if (raw) sessions = JSON.parse(raw);
  } catch {}
  try {
    const raw = localStorage.getItem(LS_KEYS.layout);
    if (raw) layout = { ...layout, ...JSON.parse(raw) };
  } catch {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("it:code:")) {
        code[key.replace("it:code:", "")] = localStorage.getItem(key)!;
      }
    }
  } catch {}

  return { solved, sessions, code, layout };
}

function saveToStorage(data: Partial<AppData>) {
  if (data.solved !== undefined)
    localStorage.setItem(LS_KEYS.solved, JSON.stringify(data.solved));
  if (data.sessions !== undefined)
    localStorage.setItem(LS_KEYS.sessions, JSON.stringify(data.sessions));
  if (data.layout !== undefined)
    localStorage.setItem(LS_KEYS.layout, JSON.stringify(data.layout));
  if (data.code !== undefined) {
    for (const [id, val] of Object.entries(data.code)) {
      localStorage.setItem("it:code:" + id, val);
    }
  }
}

interface AppDataContextValue {
  data: AppData | null;
  loaded: boolean;
  solvedList: string[];
  isSolved: (taskId: string) => boolean;
  toggleSolved: (taskId: string) => void;
  markSolved: (taskId: string) => void;
  clearSolved: () => void;
  sessions: InterviewSession[];
  saveSession: (session: InterviewSession) => void;
  getUsedTaskIds: () => Set<string>;
  clearHistory: () => void;
  saveCode: (taskId: string, code: string) => void;
  getCode: (taskId: string) => string | undefined;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

const EMPTY_DATA: AppData = {
  solved: [],
  sessions: [],
  code: {},
  layout: { sidebar: 280, leftPane: 420 },
};

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Partial<AppData>>({});

  // Ref to always access latest data without re-creating callbacks
  const dataRef = useRef<AppData>(EMPTY_DATA);
  dataRef.current = data ?? EMPTY_DATA;

  useEffect(() => {
    (async () => {
      const local = loadFromStorage();
      try {
        const res = await apiFetch("/api/data");
        if (res.ok) {
          const server = (await res.json()) as AppData;
          const merged: AppData = {
            solved: server.solved.length >= local.solved.length
              ? server.solved
              : local.solved,
            sessions: server.sessions.length >= local.sessions.length
              ? server.sessions
              : local.sessions,
            code: Object.keys(server.code).length >= Object.keys(local.code).length
              ? server.code
              : local.code,
            layout: server.layout ?? local.layout,
          };
          setData(merged);
          dataRef.current = merged;
          saveToStorage(merged);
          if (
            local.solved.length > server.solved.length ||
            local.sessions.length > server.sessions.length ||
            Object.keys(local.code).length > Object.keys(server.code).length
          ) {
            apiFetch("/api/data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(merged),
            });
          }
        } else {
          setData(local);
          dataRef.current = local;
        }
      } catch {
        setData(local);
        dataRef.current = local;
      }
      setLoaded(true);
    })();
  }, []);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      if (Object.keys(pendingPatch.current).length === 0) return;
      apiFetch("/api/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingPatch.current),
      }).catch(() => {});
      pendingPatch.current = {};
    }, 800);
  }, []);

  // All callbacks below use dataRef instead of [data] dependency
  // → stable identity → no cascading re-renders

  const toggleSolved = useCallback(
    (taskId: string) => {
      const prev = dataRef.current;
      const set = new Set(prev.solved);
      if (set.has(taskId)) set.delete(taskId);
      else set.add(taskId);
      const solved = [...set];
      saveToStorage({ solved });
      pendingPatch.current = { ...pendingPatch.current, solved };
      setData({ ...prev, solved });
      scheduleSync();
    },
    [scheduleSync]
  );

  const markSolved = useCallback(
    (taskId: string) => {
      const prev = dataRef.current;
      if (prev.solved.includes(taskId)) return;
      const solved = [...prev.solved, taskId];
      saveToStorage({ solved });
      pendingPatch.current = { ...pendingPatch.current, solved };
      setData({ ...prev, solved });
      scheduleSync();
    },
    [scheduleSync]
  );

  const isSolved = useCallback(
    (taskId: string) => dataRef.current.solved.includes(taskId),
    []
  );

  const clearSolved = useCallback(() => {
    const prev = dataRef.current;
    saveToStorage({ solved: [] });
    pendingPatch.current = { ...pendingPatch.current, solved: [] };
    setData({ ...prev, solved: [] });
    scheduleSync();
  }, [scheduleSync]);

  const saveSession = useCallback(
    (session: InterviewSession) => {
      const prev = dataRef.current;
      const sessions = [session, ...prev.sessions].slice(0, 50);
      saveToStorage({ sessions });
      pendingPatch.current = { ...pendingPatch.current, sessions };
      setData({ ...prev, sessions });
      scheduleSync();
    },
    [scheduleSync]
  );

  const getUsedTaskIds = useCallback((): Set<string> => {
    const used = new Set<string>();
    for (const s of dataRef.current.sessions) {
      for (const id of s.taskIds) used.add(id);
    }
    return used;
  }, []);

  const clearHistory = useCallback(() => {
    const prev = dataRef.current;
    saveToStorage({ sessions: [] });
    pendingPatch.current = { ...pendingPatch.current, sessions: [] };
    setData({ ...prev, sessions: [] });
    scheduleSync();
  }, [scheduleSync]);

  const saveCode = useCallback((taskId: string, code: string) => {
    const prev = dataRef.current;
    localStorage.setItem("it:code:" + taskId, code);
    setData({ ...prev, code: { ...prev.code, [taskId]: code } });
  }, []);

  const getCode = useCallback(
    (taskId: string): string | undefined => dataRef.current.code[taskId],
    []
  );

  const value = useMemo<AppDataContextValue>(
    () => ({
      data,
      loaded,
      solvedList: data?.solved ?? [],
      isSolved,
      toggleSolved,
      markSolved,
      clearSolved,
      sessions: data?.sessions ?? [],
      saveSession,
      getUsedTaskIds,
      clearHistory,
      saveCode,
      getCode,
    }),
    [data, loaded, isSolved, toggleSolved, markSolved, clearSolved, saveSession, getUsedTaskIds, clearHistory, saveCode, getCode]
  );

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}

export function pickRandomTasks(
  allTasks: { id: string }[],
  count: number,
  excludeIds: Set<string>
): string[] {
  const available = allTasks.filter((t) => !excludeIds.has(t.id));

  if (available.length < count) {
    const used = available.map((t) => t.id);
    const pool = allTasks.filter((t) => !used.includes(t.id));
    const shuffled = [...available, ...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, allTasks.length)).map((t) => t.id);
  }

  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((t) => t.id);
}
