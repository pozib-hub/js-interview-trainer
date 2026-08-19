# Interview Trainer

Тренажёр для подготовки к техническим собеседованиям (JS/TS/React).
Аналог LeetCode для собственных задач: пиши решение в редакторе, запускай
тесты, смотри подсказки и эталонные решения.

## Возможности

- **Редактор кода** Monaco с подсветкой TypeScript/JavaScript
- **Тесты** в стиле JUnit: каждая задача содержит `tests/test.ts` на vitest
- **Подсказки** по уровням — открываются по одной
- **Эталонные решения** (скрыты до явного показа)
- **Дерево задач** по темам с подсветкой сложности
- **Прогресс** хранится локально (код решения сохраняется в localStorage)
- **Добавление задач через GitHub Issues** (шаблон `.github/ISSUE_TEMPLATE/`)

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

1. Создайте папку `tasks/<тема>/<NNN-slug>/` со всеми файлами
2. Или откройте Issue по шаблону `.github/ISSUE_TEMPLATE/new-task.md`

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
