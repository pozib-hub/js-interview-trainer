import { NextResponse } from "next/server";
import { runTaskTests } from "@lib/runner";

export async function POST(req: Request) {
  let body: { taskId?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const { taskId, code } = body;
  if (!taskId || typeof code !== "string") {
    return NextResponse.json({ error: "Требуются taskId и code" }, { status: 400 });
  }

  const result = await runTaskTests(taskId, code);
  return NextResponse.json(result);
}
