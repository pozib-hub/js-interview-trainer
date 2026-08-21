import { NextResponse } from "next/server";
import { listTasks } from "@lib/scanner";

export const revalidate = 3600;

export async function GET() {
  const tasks = listTasks();
  const byTopic = new Map<string, typeof tasks>();
  for (const t of tasks) {
    if (!byTopic.has(t.topic)) byTopic.set(t.topic, []);
    byTopic.get(t.topic)!.push(t);
  }
  return NextResponse.json(
    { topics: Object.fromEntries(byTopic), tasks },
    { headers: { "Cache-Control": "public, s-maxage=3600" } }
  );
}
