## Сгенерированная задача: `algorithms/027-foobar`

**Заголовок:** FooBar (FizzBuzz)  
**Категория:** `algorithms` · **Сложность:** `easy`  
**Теги:** `algorithms`, `math`



Сгенерировано AI из соответствующего Issue. Проверьте корректность перед merge.

<details><summary>meta.json</summary>

```json
{
  "title": "FooBar (FizzBuzz)",
  "difficulty": "easy",
  "tags": [
    "algorithms",
    "math"
  ],
  "language": "typescript",
  "exports": [
    "foobar"
  ]
}
```
</details>
<details><summary>condition.md</summary>

```md
# FooBar (FizzBuzz)

Дано число `n`. Верни строку `'FooBar'`, если `n` делится на 15, `'Foo'`, если `n` делится на 3, `'Bar'`, если `n` делится на 5, иначе верни само число `n`.

Примеры:
- `foobar(15)` → `'FooBar'`
- `foobar(3)` → `'Foo'`
- `foobar(5)` → `'Bar'`
- `foobar(1)` → `1`
- `foobar(7)` → `7`

## Примеры

foobar(15) → 'FooBar'

foobar(3) → 'Foo'

foobar(5) → 'Bar'

foobar(1) → 1

foobar(7) → 7
```
</details>
<details><summary>solution.ts</summary>

```ts
export function foobar(n: number): string | number {
  if (n % 15 === 0) return 'FooBar';
  if (n % 3 === 0) return 'Foo';
  if (n % 5 === 0) return 'Bar';
  return n;
}
```
</details>
<details><summary>tests/test.ts</summary>

```ts
import { test, expect } from "vitest";
import { foobar } from "../solution";

test("возвращает FooBar для чисел, делящихся на 15", () => {
  expect(foobar(15)).toBe("FooBar");
  expect(foobar(30)).toBe("FooBar");
});
test("возвращает Foo для чисел, делящихся на 3", () => {
  expect(foobar(3)).toBe("Foo");
  expect(foobar(6)).toBe("Foo");
});
test("возвращает Bar для чисел, делящихся на 5", () => {
  expect(foobar(5)).toBe("Bar");
  expect(foobar(10)).toBe("Bar");
});
test("возвращает число для остальных", () => {
  expect(foobar(1)).toBe(1);
  expect(foobar(2)).toBe(2);
  expect(foobar(7)).toBe(7);
});
```
</details>
<details><summary>template.ts</summary>

```ts
export function foobar(n: number): string | number {
  // TODO: реализуйте
  return undefined as any;
}
```
</details>
<details><summary>hints.md</summary>

```md
## Подсказка 1
Сначала проверяй делимость на 15, затем на 3, затем на 5 — порядок важен, иначе 15 будет пойман раньше.

## Подсказка 2
Учти крайние случаи: n = 0 (делится на всё), n = 1 (ни на что не делится).
```
</details>