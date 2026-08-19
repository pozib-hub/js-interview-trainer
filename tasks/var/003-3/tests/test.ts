import { test, expect } from "vitest";
import { getResult } from "../solution";

test("результат", () => {
  expect(getResult()).toEqual(["ответ", "undefined", "ReferenceError: Cannot access 'b' before initialization", "// ================================", "undefined", "ReferenceError: Cannot access 'b' before initialization", "60", "SyntaxError: Identifier 'a' has already been declared"]);
});
