import { readFileSync } from "fs";
import { join } from "path";
import TaskPageClient from "./TaskPageClient";

export function generateStaticParams() {
  if (process.env.NEXT_PUBLIC_STATIC_MODE !== "true") return [];
  try {
    const data = JSON.parse(readFileSync(join(process.cwd(), "public", "tasks.json"), "utf8"));
    return (data.tasks || []).map((t: { id: string }) => ({
      id: t.id.split("/"),
    }));
  } catch {
    return [];
  }
}

export default async function TaskPage({ params }: { params: Promise<{ id: string[] }> }) {
  const { id } = await params;
  const taskId = id.join("/");
  return <TaskPageClient taskId={taskId} />;
}
