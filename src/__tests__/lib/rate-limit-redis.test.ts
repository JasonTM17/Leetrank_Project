import { describe, it, expect, beforeEach, vi } from "vitest";

// We mock ioredis at the module level. The rate-limit module imports it
// dynamically via `await import("ioredis")`, so vi.mock intercepts that.
const pipelineMock = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  pexpire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

const onMock = vi.fn();
const RedisCtorMock = vi.fn().mockImplementation(() => ({
  pipeline: () => pipelineMock,
  on: onMock,
}));

vi.mock("ioredis", () => ({
  default: RedisCtorMock,
}));

describe("rateLimitAsync (redis-backed)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    pipelineMock.zremrangebyscore.mockReturnThis();
    pipelineMock.zadd.mockReturnThis();
    pipelineMock.zcard.mockReturnThis();
    pipelineMock.pexpire.mockReturnThis();
    process.env.REDIS_URL = "redis://localhost:6379/0";
    const mod = await import("@/lib/rate-limit");
    mod._resetRateLimitInternals();
  });

  it("calls the redis pipeline with the expected commands", async () => {
    pipelineMock.exec.mockResolvedValueOnce([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 1],
    ]);

    const { rateLimitAsync } = await import("@/lib/rate-limit");
    const result = await rateLimitAsync("user:42", 5, 60_000);

    expect(RedisCtorMock).toHaveBeenCalledWith("redis://localhost:6379/0");
    expect(pipelineMock.zremrangebyscore).toHaveBeenCalledTimes(1);
    expect(pipelineMock.zremrangebyscore).toHaveBeenCalledWith(
      "rl:user:42",
      0,
      expect.any(Number)
    );
    expect(pipelineMock.zadd).toHaveBeenCalledTimes(1);
    expect(pipelineMock.zcard).toHaveBeenCalledWith("rl:user:42");
    expect(pipelineMock.pexpire).toHaveBeenCalledWith("rl:user:42", 60_000);
    expect(pipelineMock.exec).toHaveBeenCalledTimes(1);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("denies when the sorted-set cardinality exceeds the max", async () => {
    pipelineMock.exec.mockResolvedValueOnce([
      [null, 0],
      [null, 1],
      [null, 6],
      [null, 1],
    ]);

    const { rateLimitAsync } = await import("@/lib/rate-limit");
    const result = await rateLimitAsync("user:42", 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("falls back to in-memory when redis throws", async () => {
    pipelineMock.exec.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const { rateLimitAsync } = await import("@/lib/rate-limit");
    const result = await rateLimitAsync("user:fallback", 3, 60_000);
    // In-memory path returns allowed=true on first call.
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("falls back to in-memory when REDIS_URL is unset", async () => {
    delete process.env.REDIS_URL;
    const mod = await import("@/lib/rate-limit");
    mod._resetRateLimitInternals();
    const result = await mod.rateLimitAsync("nokey", 2, 60_000);
    expect(result.allowed).toBe(true);
    // Pipeline never called since redis client wasn't constructed.
    expect(pipelineMock.exec).not.toHaveBeenCalled();
  });

  it("falls back to in-memory when redis pipeline returns malformed result", async () => {
    pipelineMock.exec.mockResolvedValueOnce(null);

    const { rateLimitAsync } = await import("@/lib/rate-limit");
    const result = await rateLimitAsync("malformed", 2, 60_000);
    expect(result.allowed).toBe(true);
  });
});
