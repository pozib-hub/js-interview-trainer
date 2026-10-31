import { Suspense } from "react";
import { readFileSync } from "fs";
import { join } from "path";
import DirectionPageClient from "./DirectionPageClient";

export function generateStaticParams() {
  if (process.env.NEXT_PUBLIC_STATIC_MODE !== "true") return [];
  try {
    const data = JSON.parse(
      readFileSync(join(process.cwd(), "public", "questions.json"), "utf8")
    );
    return (data.directions || []).map((d: { id: string }) => ({
      direction: d.id,
    }));
  } catch {
    return [];
  }
}

export default async function DirectionPage({
  params,
}: {
  params: Promise<{ direction: string }>;
}) {
  const { direction } = await params;
  return (
    <Suspense>
      <DirectionPageClient directionId={direction} />
    </Suspense>
  );
}
