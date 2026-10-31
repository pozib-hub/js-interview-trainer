import { NextResponse } from "next/server";
import { listQuestions } from "@lib/questions-scanner";

export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(listQuestions(), {
    headers: { "Cache-Control": "public, s-maxage=3600" },
  });
}
