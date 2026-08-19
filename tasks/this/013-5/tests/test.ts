import { test, expect } from "vitest";
import { getResult } from "../solution";

test("результат", () => {
  expect(getResult()).toEqual(["ответ", "[ ' is friend', ' is brother', ' is student' ]"]);
});
