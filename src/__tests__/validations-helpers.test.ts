import { describe, it, expect } from "vitest";
import { firstZodError } from "@/lib/validations";

describe("firstZodError", () => {
  it("returns the first error message", () => {
    const fake = { errors: [{ message: "first" }, { message: "second" }] };
    expect(firstZodError(fake)).toBe("first");
  });

  it("falls back to a generic label on empty errors array", () => {
    const fake = { errors: [] };
    expect(firstZodError(fake)).toBe("Invalid input");
  });
});
