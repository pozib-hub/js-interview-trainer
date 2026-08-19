import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data.json");

export interface AppData {
  solved: string[];
  sessions: Array<{
    id: string;
    date: number;
    taskIds: string[];
    results: Record<string, boolean>;
  }>;
  code: Record<string, string>;
  layout: { sidebar: number; leftPane: number };
}

const EMPTY: AppData = {
  solved: [],
  sessions: [],
  code: {},
  layout: { sidebar: 280, leftPane: 420 },
};

export async function readData(): Promise<AppData> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      solved: parsed.solved ?? [],
      sessions: parsed.sessions ?? [],
      code: parsed.code ?? {},
      layout: parsed.layout ?? EMPTY.layout,
    };
  } catch {
    return { ...EMPTY };
  }
}

export async function writeData(data: AppData): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function patchData(
  patch: Partial<AppData>
): Promise<AppData> {
  const current = await readData();
  const next: AppData = {
    solved: patch.solved ?? current.solved,
    sessions: patch.sessions ?? current.sessions,
    code: patch.code ?? current.code,
    layout: patch.layout ?? current.layout,
  };
  await writeData(next);
  return next;
}
