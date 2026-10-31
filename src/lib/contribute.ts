// Repo coordinates + helpers to build GitHub Issue links from the static
// frontend (no backend, no tokens). Configurable via NEXT_PUBLIC_GITHUB_REPO.

const DEFAULT_REPO = "pozib-hub/js-interview-trainer";
const REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || DEFAULT_REPO;

export function repoUrl(): string {
  return `https://github.com/${REPO}`;
}

/**
 * Build a "new issue" URL pre-filled with the simplified task-proposal
 * template. Only the description is required; AI determines the rest
 * (category, difficulty, tags, slug, metadata).
 */
export function newTaskIssueUrl(opts: {
  title?: string;
  sourceUrl?: string;
  description?: string;
} = {}): string {
  const params = new URLSearchParams();
  params.set("template", "new-task.md");
  params.set("labels", "task");

  if (opts.title) params.set("title", `[TASK] ${opts.title}`);

  const body: string[] = [];
  body.push("## URL источника");
  body.push(opts.sourceUrl || "");
  body.push("");
  body.push("## Описание задачи");
  body.push(opts.description || "");
  body.push("");
  body.push("## Решение (необязательно)");
  body.push("");
  body.push("## Дополнительные заметки");
  body.push("");
  params.set("body", body.join("\n"));

  return `${repoUrl()}/issues/new?${params.toString()}`;
}

/**
 * Build a "new question" issue URL pre-filled with the question-proposal
 * template. Direction/technology are pre-filled when known (from the current
 * section); the question text and answer are provided by the user.
 */
export function newQuestionIssueUrl(opts: {
  direction?: string;
  technology?: string;
  question?: string;
} = {}): string {
  const params = new URLSearchParams();
  params.set("template", "new-question.md");
  params.set("labels", "question");

  if (opts.question) params.set("title", `[QUESTION] ${opts.question}`);

  const body: string[] = [];
  body.push("## Направление");
  body.push(opts.direction || "");
  body.push("");
  body.push("## Технология");
  body.push(opts.technology || "");
  body.push("");
  body.push("## Глава (необязательно)");
  body.push("");
  body.push("## Вопрос");
  body.push("");
  body.push("");
  body.push("## Ответ (необязательно)");
  body.push("");
  body.push("## Дополнительные заметки");
  body.push("");
  params.set("body", body.join("\n"));

  return `${repoUrl()}/issues/new?${params.toString()}`;
}
