import { redirect } from "next/navigation";

export default function HomePage() {
  // Главная — редирект на первую попавшуюся задачу (определяется на клиенте через TaskTree)
  redirect("/tasks");
}
