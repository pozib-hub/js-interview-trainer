import { Suspense } from "react";
import MyQuestionsPageClient from "./MyQuestionsPageClient";

export default function MyQuestionsPage() {
  return (
    <Suspense>
      <MyQuestionsPageClient />
    </Suspense>
  );
}
