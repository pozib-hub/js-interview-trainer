import { Suspense } from "react";
import { readFileSync } from "fs";
import { join } from "path";
import TechnologyPageClient from "./TechnologyPageClient";

export function generateStaticParams() {
  if (process.env.NEXT_PUBLIC_STATIC_MODE !== "true") return [];
  try {
    const data = JSON.parse(
      readFileSync(join(process.cwd(), "public", "questions.json"), "utf8")
    );
    const params: { direction: string; technology: string }[] = [];
    for (const d of data.directions || []) {
      for (const t of d.technologies || []) {
        params.push({ direction: d.id, technology: String(t.id).split("/")[1] });
      }
    }
    return params;
  } catch {
    return [];
  }
}

export default async function TechnologyPage({
  params,
}: {
  params: Promise<{ direction: string; technology: string }>;
}) {
  const { direction, technology } = await params;
  return (
    <Suspense>
      <TechnologyPageClient
        directionId={direction}
        technologyId={technology}
      />
    </Suspense>
  );
}
