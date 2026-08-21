import { NextResponse } from "next/server";
import { getTask } from "@lib/scanner";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const task = getTask(decoded);
  if (!task) {
    return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
  }
  return NextResponse.json(task);
}
