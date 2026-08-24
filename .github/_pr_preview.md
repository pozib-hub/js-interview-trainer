## Сгенерированная задача: `algorithms/027-fizz-buzz`

**Заголовок:** FizzBuzz (FooBar)  
**Категория:** `algorithms` · **Сложность:** `easy`  
**Теги:** `algorithms`, `fizz-buzz`, `loops`, `modulo`



Сгенерировано AI из соответствующего Issue. Проверьте корректность перед merge.

<details><summary>meta.json</summary>

```json
{
  "title": "FizzBuzz (FooBar)",
  "difficulty": "easy",
  "tags": [
    "algorithms",
    "fizz-buzz",
    "loops",
    "modulo"
  ],
  "language": "typescript",
  "exports": [
    "fizzBuzz"
  ]
}
```
</details>
<details><summary>condition.md</summary>

```md
# FizzBuzz (FooBar)

Реализуйте функцию `fizzBuzz(n)`, которая возвращает массив строк для чисел от 1 до `n` (включительно) по правилам:

- Если число делится на 3 и на 5 (то есть на 15) — добавить `'FooBar'`
- Иначе если делится на 3 — добавить `'Foo'`
- Иначе если делится на 5 — добавить `'Bar'`
- Иначе — добавить строковое представление числа

Функция должна вернуть массив результатов, а не выводить в консоль.

## Примеры

fizzBuzz(15) => ['1', '2', 'Foo', '4', 'Bar', 'Foo', '7', '8', 'Foo', 'Bar', '11', 'Foo', '13', '14', 'FooBar']

## Ограничения
- 1 ≤ n ≤ 1000
```
</details>
<details><summary>solution.ts</summary>

```ts
export function fizzBuzz(n: number): string[] {
  const result: string[] = [];
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) {
      result.push('FooBar');
    } else if (i % 3 === 0) {
      result.push('Foo');
    } else if (i % 5 === 0) {
      result.push('Bar');
    } else {
      result.push(String(i));
    }
  }
  return result;
}
```
</details>
<details><summary>tests/test.ts</summary>

```ts
import { test, expect } from "vitest";
import { fizzBuzz } from "../solution";

test("базовый случай n=15", () => {
  expect(fizzBuzz(15)).toEqual([
    '1', '2', 'Foo', '4', 'Bar', 'Foo', '7', '8', 'Foo', 'Bar',
    '11', 'Foo', '13', '14', 'FooBar'
  ]);
});

test("n=1", () => {
  expect(fizzBuzz(1)).toEqual(['1']);
});

test("n=3", () => {
  expect(fizzBuzz(3)).toEqual(['1', '2', 'Foo']);
});

test("n=5", () => {
  expect(fizzBuzz(5)).toEqual(['1', '2', 'Foo', '4', 'Bar']);
});

test("делится на 15", () => {
  expect(fizzBuzz(30)[14]).toBe('FooBar'); // 15-й элемент (индекс 14)
  expect(fizzBuzz(30)[29]).toBe('FooBar'); // 30-й элемент
});

test("возвращает строки, не числа", () => {
  const res = fizzBuzz(5);
  expect(typeof res[0]).toBe('string');
  expect(typeof res[2]).toBe('string');
});
```
</details>
<details><summary>template.ts</summary>

```ts
export function fizzBuzz(n: number): string[] {
  // TODO: реализуйте
  return undefined as any;
}
```
</details>
<details><summary>hints.md</summary>

```md
## Подсказка 1
Используйте оператор остатка от деления (%) для проверки делимости.

## Подсказка 2
Порядок проверок важен: сначала проверяйте делимость на 15, потом на 3 и 5.

## Подсказка 3
Собирайте результаты в массив и возвращайте его, вместо вывода в консоль.
```
</details>