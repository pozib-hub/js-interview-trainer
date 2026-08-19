import TaskPageClient from "./TaskPageClient";

export function generateStaticParams() {
  if (process.env.NEXT_PUBLIC_STATIC_MODE !== "true") return [];
  try {
    const { readFileSync } = require("fs");
    const { join } = require("path");
    const data = JSON.parse(readFileSync(join(process.cwd(), "public", "tasks.json"), "utf8"));
    return (data.tasks || []).map((t: { id: string }) => ({ id: encodeURIComponent(t.id) }));
  } catch {
    return [];
  }
}

export default function TaskPage({ params }: { params: { id: string } }) {
  const taskId = decodeURIComponent(params.id);
  return <TaskPageClient taskId={taskId} />;
}
