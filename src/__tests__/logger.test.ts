import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "@/lib/logger";

describe("logger", () => {
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  afterEach(() => {
    stdoutSpy.mockClear();
    stderrSpy.mockClear();
    delete process.env.LOG_LEVEL;
  });

  it("emits info to stdout as JSON with the right shape", () => {
    process.env.LOG_LEVEL = "debug";
    logger.info("hello", { requestId: "abc" });
    expect(stdoutSpy).toHaveBeenCalledOnce();
    const line = stdoutSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hello");
    expect(parsed.requestId).toBe("abc");
    expect(parsed.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("emits error to stderr", () => {
    process.env.LOG_LEVEL = "debug";
    logger.error("boom");
    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("respects LOG_LEVEL threshold (warn drops debug+info)", () => {
    process.env.LOG_LEVEL = "warn";
    logger.debug("x");
    logger.info("y");
    logger.warn("z");
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const line = stdoutSpy.mock.calls[0]![0] as string;
    expect(JSON.parse(line).level).toBe("warn");
  });

  it("with() returns a child logger that injects the bound fields", () => {
    process.env.LOG_LEVEL = "debug";
    const child = logger.with({ requestId: "r-1" });
    child.info("hi");
    const line = stdoutSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.requestId).toBe("r-1");
    expect(parsed.msg).toBe("hi");
  });

  it("with().info merges per-call fields over bound fields", () => {
    process.env.LOG_LEVEL = "debug";
    const child = logger.with({ requestId: "r-1", scope: "outer" });
    child.warn("clash", { scope: "inner" });
    const line = stdoutSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.scope).toBe("inner");
    expect(parsed.requestId).toBe("r-1");
  });
});
