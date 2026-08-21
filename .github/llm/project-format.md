# Спецификация формата задач Interview Trainer

## Где хранятся задачи

Задачи — файлы в `tasks/<тема>/<NNN-slug>/`. Каждая задача = папка с 6 файлами:

```
tasks/<topic>/<NNN-slug>/
├── meta.json        # метаданные
├── condition.md     # условие (markdown)
├── template.ts      # стартовый код пользователя
├── solution.ts      # эталонное решение (скрыто)
├── hints.md         # подсказки (## Подсказка N)
└── tests/
    └── test.ts      # тесты (vitest)
```

- `NNN` — трёхзначный номер (назначает код, не ты).
- Номер в `slug` не нужен.

## meta.json

```json
{
  "title": "Найти пары чисел с заданной суммой",
  "difficulty": "medium",
  "tags": ["algorithms", "array", "hash-map"],
  "language": "typescript",
  "exports": ["findSumPairs"]
}
```

- `title` — русский, человекочитаемый.
- `difficulty` — `"easy"` | `"medium"` | `"hard"`.
- `tags` — массив; первый элемент = имя темы.
- `language` — всегда `"typescript"`.
- `exports` — имена функций, которые экспортирует решение.

## condition.md

Markdown. Генератор добавляет заголовок `# <title>`. Поэтому в твоём `condition`
**не пиши** ведущий `#`. Пример структуры:

- Что дано.
- Что нужно вернуть.
- Примеры (если есть — из `examples`).
- Ограничения (если есть — из `constraints`).
- Источник (добавляется генератором).

## template.ts

Стартовый код. Содержит сигнатуру функции с `// TODO` и заглушкой `return`.
Должен компилироваться.

```ts
export function findSumPairs(array: number[], targetSum: number) {
  // TODO: реализуйте
  return;
}
```

## solution.ts

Эталонное решение. Экспортирует функцию из `exports`. Проходит все тесты.
Без `console.log`, без закомментированного кода.

```ts
export function findSumPairs(array: number[], targetSum: number) {
  const seen = new Map<number, number>();
  for (let i = 0; i < array.length; i++) {
    const complement = targetSum - array[i];
    if (seen.has(complement)) return [complement, array[i]];
    seen.set(array[i], i);
  }
  return [];
}
```

## tests/test.ts

Импорт из `"../solution"`. Использовать `import { test, expect } from "vitest"`.
**Без `describe`.**

```ts
import { test, expect } from "vitest";
import { findSumPairs } from "../solution";

test("находит пару", () => {
  expect(findSumPairs([6, 4, 7, 0, 1, 2, 8, 5], 7)).toEqual([6, 1]);
});

test("пустой массив", () => {
  expect(findSumPairs([], 5)).toEqual([]);
});
```

## hints.md

Каждая подсказка — `## Подсказка N`. Генератор оборачивает элементы массива
`hints`, поэтому в самом массиве **не пиши** заголовки `##`.

## Тип задачи (только Pattern 1 — Function Export)

Пользователь реализует и экспортирует одну функцию. Тесты проверяют её.
Это единственный поддерживаемый паттерн в автогенерации.
