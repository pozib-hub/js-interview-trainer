import { test, expectTypeOf } from "vitest";
import type { Arr } from "../solution";

test("Arr принимает числа", () => {
  expectTypeOf<number>().toExtend<Arr extends (infer U)[] ? U : never>();
});

test("arr — валидный Arr", () => {
  const nested: number[] = [1, 2, 3];
  expectTypeOf(nested).toExtend<Arr>();
});

test("Arr поддерживает вложенность", () => {
  const nested: (number | number[])[] = [1, [2, 3]];
  expectTypeOf(nested).toExtend<Arr>();
});
