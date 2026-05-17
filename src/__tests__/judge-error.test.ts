import { describe, it, expect } from "vitest";
import { JudgeUnavailableError } from "@/services/judge";

describe("JudgeUnavailableError", () => {
  it("is constructible with a string cause and includes it in message", () => {
    const err = new JudgeUnavailableError("ECONNREFUSED");
    expect(err.message).toContain("ECONNREFUSED");
    expect(err.name).toBe("JudgeUnavailableError");
  });

  it("is constructible with an Error cause", () => {
    const root = new Error("network down");
    const err = new JudgeUnavailableError(root);
    expect(err.message).toContain("network down");
  });

  it("is an instance of Error", () => {
    const err = new JudgeUnavailableError("x");
    expect(err).toBeInstanceOf(Error);
  });

  it("survives instanceof across the same module", () => {
    const err = new JudgeUnavailableError("x");
    expect(err instanceof JudgeUnavailableError).toBe(true);
  });
});
