import { test, expectTypeOf } from "vitest";
import type { PartialWithRequired, User, UserWithRequiredName } from "../solution";

test("PartialWithRequired делает указанные поля обязательными", () => {
  type T = { a?: string; b: number };
  type R = PartialWithRequired<T, "a">;
  expectTypeOf<R>().toEqualTypeOf<{ b: number; a: string }>();
});

test("UserWithRequiredName требует name", () => {
  const valid: UserWithRequiredName = { name: "John", age: 30, email: "a@b.c" };
  expectTypeOf(valid).toMatchObjectType<{ name: string; age: number; email: string }>();
});

test("User.name опционален", () => {
  const u: User = { age: 30, email: "a@b.c" };
  expectTypeOf(u).toMatchObjectType<{ age: number; email: string }>();
});
