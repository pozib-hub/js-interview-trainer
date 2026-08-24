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
