import { test, expect } from "vitest";
import { getResult } from "../solution";

test("результат", () => {
  expect(getResult()).toEqual(["function", "undefined", "undefined", undefined, 7, 8]);
});
