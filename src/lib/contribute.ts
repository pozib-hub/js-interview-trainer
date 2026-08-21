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
