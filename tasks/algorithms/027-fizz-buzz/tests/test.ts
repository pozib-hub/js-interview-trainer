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
