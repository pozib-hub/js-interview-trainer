# AGENTS.md

Это файл инструкций для ИИ-агентов (opencode, и др.), работающих в репозитории.
**Прочитай его целиком перед любыми изменениями в `tasks/`.**

## Что это за проект

**Interview Trainer** — локальный тренажёр для подготовки к JS/TS/React-собеседованиям.
Пользователь пишет решение в редакторе (Monaco), нажимает «Запустить тесты»,
и backend прогоняет код против тестов задачи (vitest), возвращая отчёт.

- **Стек:** Next.js 15 (App Router) · React 19 · TypeScript 5 · Vitest 2 · Monaco
- **Рантайм тестов:** Node.js с `--experimental-strip-types`
- **Задачи хранятся как файлы** в `tasks/<тема>/<NNN-slug>/` (не в БД)

## Критически важное правило

**Существующий код — source of truth.**

Перед добавлением или изменением задачи **обязательно** прочитай:

```
docs/TASK_AUTHORING.md
```

Там описаны все правила, паттерны и реальные примеры.

**Никогда не придумывай новый формат задачи.** Всегда находи похожую существующую
задачу и копируй её паттерн.

## Команды

```bash
npm run dev          # dev-сервер на http://localhost:3000
npm run typecheck    # tsc --noEmit (должно быть 0 ошибок)
npm run lint         # ESLint
npm run build        # production-сборка Next.js
```

### Проверить задачу через API

```bash
# Список всех задач
curl http://localhost:3000/api/tasks

# Получить содержимое задачи
curl "http://localhost:3000/api/task/algorithms/014-find-sum-pairs"

# Прогнать код против тестов
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{"taskId":"algorithms/014-find-sum-pairs","code":"<код решения>"}'
```

### Прогнать все задачи

```bash
node scripts/test-all.mjs
```

## Быстрый чек-лист

1. Прочитай `docs/TASK_AUTHORING.md`
2. Найди похожие существующие задачи
3. Повтори их паттерн
4. Проверь: `npm run typecheck`, прогони тесты через API
5. Убедись, что задача появляется в `GET /api/tasks`
