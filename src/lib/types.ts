export type Difficulty = "easy" | "medium" | "hard";

export type TaskLanguage = "typescript" | "javascript";

export interface TaskMeta {
  title: string;
  difficulty: Difficulty;
  tags: string[];
  language: TaskLanguage;
  /** Функция/символ, который пользователь должен реализовать и экспортировать */
  exports?: string[];
}

export interface TaskSummary {
  id: string;
  topic: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  language: TaskLanguage;
}

export interface TaskFull extends TaskSummary {
  condition: string;
  template: string;
  hints: string[];
  solution: string;
  testFile: string;
  exports?: string[];
}

export interface TestAssertion {
  name: string;
  passed: boolean;
  message?: string;
}

export interface RunResult {
  taskId: string;
  passed: boolean;
  total: number;
  failed: number;
  assertions: TestAssertion[];
  stdout: string;
  stderr: string;
  durationMs: number;
}

// ─── Сборник вопросов с собеседований ──────────────────────────────────────

/** Один вопрос с ответом внутри главы. */
export interface QuestionEntry {
  /** "frontend/javascript/003-async-event-loop/002" */
  id: string;
  question: string;
  /** Ответ в markdown (без заголовков `##` — они зарезервированы для вопросов) */
  answer: string;
}

/** Глава внутри технологии (или внутри направления без технологий, как у HR). */
export interface QuestionChapter {
  /** "frontend/javascript/003-async-event-loop" */
  id: string;
  title: string;
  questions: QuestionEntry[];
}

/** Технология внутри направления (javascript, react, kubernetes...). */
export interface QuestionsTechnology {
  /** "frontend/javascript" */
  id: string;
  directionId: string;
  title: string;
  description: string;
  /** Порядок сортировки внутри направления */
  order?: number;
  chapters: QuestionChapter[];
}

/** Направление (frontend, backend, devops, hr). */
export interface QuestionsDirection {
  /** "frontend" */
  id: string;
  title: string;
  description: string;
  /** Порядок сортировки на главной */
  order?: number;
  /** Технологии направления. Пусто для направлений с главами напрямую (hr). */
  technologies: QuestionsTechnology[];
  /** Главы без уровня технологий — только для раздела HR. */
  chapters: QuestionChapter[];
}

export interface QuestionsIndex {
  directions: QuestionsDirection[];
}

/** Вопрос пользователя — хранится локально в браузере (localStorage). */
export interface UserQuestion {
  id: string;
  question: string;
  answer: string;
  /** id технологии ("frontend/javascript") или направления ("hr"), "" — без категории */
  category?: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Устное собеседование по вопросам ──────────────────────────────────────

/** Вопрос из плана устного собеседования (с эталонным ответом для разбора). */
export interface PlanQuestion {
  id: string;
  question: string;
  answer: string;
  techTitle: string;
  chapterTitle: string;
}

/** Вердикт ИИ по одному ответу. */
export interface AnalyzeVerdict {
  id: string;
  ok: boolean;
  feedback: string;
}

/** Незавершённая сессия собеседования (localStorage, для возобновления). */
export interface StoredInterviewSession {
  version: 1;
  startedAt: number;
  direction: string;
  questions: PlanQuestion[];
  answers: Record<string, string>;
  currentIndex: number;
}
