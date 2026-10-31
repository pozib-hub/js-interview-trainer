"use client";

import { Button, Spacer, ThemeToggle } from "@ui/index";
import { newQuestionIssueUrl } from "@lib/contribute";
import styles from "./questions.module.css";

export default function QuestionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="AppShell">
      <header className="AppHeader">
        <h1>Вопросы с собеседований</h1>
        <Spacer />
        <ThemeToggle />
        <Button size="sm" href="/tasks">🧩 Задачи</Button>
        <Button size="sm" href="/interview">🎯 Собеседование</Button>
        <Button
          size="sm"
          variant="primary"
          href={newQuestionIssueUrl()}
          external
          title="Предложить новый вопрос через GitHub Issue (AI оформит ответ)"
        >
          ➕ Добавить вопрос
        </Button>
      </header>
      <main className={styles.Main}>{children}</main>
    </div>
  );
}
