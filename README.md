# Interview Trainer

Тренажёр для подготовки к техническим собеседованиям (JS/TS/React).
Аналог LeetCode для собственных задач: пиши решение в редакторе, запускай
тесты, смотри подсказки и эталонные решения.

🌐 **[Открыть приложение](https://pozib-hub.github.io/js-interview-trainer/)**

## Возможности

- **Редактор кода** Monaco с подсветкой TypeScript/JavaScript
- **Тесты** в стиле JUnit: каждая задача содержит `tests/test.ts` на vitest
- **Подсказки** по уровням — открываются по одной
- **Эталонные решения** (скрыты до явного показа)
- **Дерево задач** по темам с подсветкой сложности
- **Прогресс** хранится локально (код решения сохраняется в localStorage)
- **Добавление задач через GitHub Issues** — кнопка «➕ Добавить задачу» открывает
  предзаполненный Issue, а GitHub Actions автоматически генерирует файлы задачи и
  открывает Pull Request (через LLM)

## Быстрый старт

```bash
npm install
npm run dev
# откройте http://localhost:3000
```

## Структура задачи

```
tasks/
  <тема>/
    <NNN-slug>/
      meta.json       # заголовок, сложность, теги, язык
      condition.md    # условие (markdown)
      template.ts     # стартовый код для пользователя
      solution.ts     # эталонное решение (скрыто)
      hints.md        # подсказки (## Подсказка 1, 2, 3...)
      tests/
        test.ts       # тесты (vitest), импортируют ../solution
```

### Пример `meta.json`

```json
{
  "title": "Найти пары чисел с заданной суммой",
  "difficulty": "medium",
  "tags": ["algorithms", "array", "hash-map"],
  "language": "typescript",
  "exports": ["findSumPairs"]
}
```

### Как писать тесты

Тесты импортируют решение из `../solution`:

```ts
import { test, expect } from "vitest";
import { findSumPairs } from "../solution";

test("базовый случай", () => {
  expect(findSumPairs([2, 7, 11], 9)).toEqual([[0, 1]]);
});
```

Раннер записывает код пользователя во временный `solution.ts` и запускает
vitest с JSON-репортёром. Результаты (passed/failed + сообщения) возвращаются
в UI.

## Добавление новой задачи

### Вручную
1. Создайте папку `tasks/<тема>/<NNN-slug>/` со всеми файлами
2. Или откройте Issue по шаблону `.github/ISSUE_TEMPLATE/new-task.md`

### Через UI (автоматически)
1. Нажмите **«➕ Добавить задачу»** в шапке приложения.
2. Заполните предзаполненный GitHub Issue (URL источника и/или текст задачи, тема,
   сложность). Создайте Issue.
3. Workflow `Generate Task from Issue` (.github/workflows/new-task.yml) сработает
   автоматически: LLM преобразует задачу в структурированный JSON → детерминированный
   генератор соберёт 6 файлов → прогон vitest → черновик Pull Request.
4. Проверьте PR и смержите.

## Автоматическая генерация задач (GitHub Actions + LLM)

Pipeline: `GitHub Issue → GitHub Actions → LLM (DeepSeek) → JSON → детерминированные
шаблоны → файлы задачи → ветка → Pull Request`.

### Нужные GitHub Secrets

| Secret | Обязателен | Описание |
|---|---|---|
| `LLM_API_KEY` *(или `DEEPSEEK_API_KEY` / `OPENAI_API_KEY`)* | да | API-ключ LLM-провайдера |
| `LLM_BASE_URL` | нет | OpenAI-compatible endpoint (по умолчанию `https://api.deepseek.com/v1`) |
| `LLM_MODEL` | нет | Модель (по умолчанию `deepseek-chat`) |

Чтобы сменить провайдера — задайте `LLM_BASE_URL` и `LLM_MODEL` (любой
OpenAI-compatible endpoint: OpenAI, OpenRouter, Groq, Together, локальный Ollama).

### Permissions GitHub Actions
Используется только встроенный `GITHUB_TOKEN` (без PAT):
- `contents: write` — коммит файлов в новую ветку
- `pull-requests: write` — создание PR
- `issues: write` — комментарии и метки на issue

PR всегда открывается как **черновик** в отдельную ветку `task/<topic>-<NNN>-<slug>`.
В `main` напрямую ничего не пишется. Для полной защиты включите branch protection
на `main` в Settings → Branches.

### Защита от повторной обработки
- Issue с label `task-processed` повторно не обрабатывается.
- На время работы вешается label `task-processing`.
- При ошибке — label `task-failed` + комментарий с причиной.
- Ручной перезапуск: Actions → «Generate Task from Issue» → Run workflow →
  указать номер issue.

### Локальное тестирование генератора
```bash
export ISSUE_TITLE="[TASK] Two Sum"
export ISSUE_BODY="$(cat test-issue-body.md)"   # тело issue по шаблону
export LLM_API_KEY=...                           # ваш ключ
npm ci
node .github/scripts/generate-task.mjs
# SKIP_VITEST=true node .github/scripts/generate-task.mjs  # без прогона тестов
```
Сгенерированные файлы появятся в `tasks/<тема>/<NNN-slug>/`.

## Скрипты

| Команда | Описание |
|---|---|
| `npm run dev` | Запуск в режиме разработки |
| `npm run build` | Production-сборка |
| `npm run typecheck` | Проверка типов |
| `npm run lint` | ESLint |

## Стек

- Next.js 15 (App Router)
- React 19
- TypeScript 5
- Vitest 2 (раннер тестов)
- Monaco Editor (редактор кода)
