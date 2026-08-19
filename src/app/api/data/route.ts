import { NextResponse } from "next/server";
import { readData, patchData, type AppData } from "@/lib/fileStorage";

export async function GET() {
  const data = await readData();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<AppData>;
  const updated = await patchData(body);
  return NextResponse.json(updated);
}
