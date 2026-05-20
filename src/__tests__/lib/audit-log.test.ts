import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreate = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

const mockLoggerError = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

import { recordAuditEvent, AuditEvent } from "@/lib/audit-log";

describe("recordAuditEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes a full audit event to the database", async () => {
    mockCreate.mockResolvedValueOnce({ id: "clx_test" });

    const event: AuditEvent = {
      actorId: "user_123",
      action: "auth.login.success",
      targetType: "user",
      targetId: "user_123",
      metadata: { provider: "credentials" },
      ip: "127.0.0.1",
      userAgent: "Mozilla/5.0",
    };

    await recordAuditEvent(event);

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        actorId: "user_123",
        action: "auth.login.success",
        targetType: "user",
        targetId: "user_123",
        metadata: { provider: "credentials" },
        ip: "127.0.0.1",
        userAgent: "Mozilla/5.0",
      },
    });
  });

  it("handles null/undefined optional fields", async () => {
    mockCreate.mockResolvedValueOnce({ id: "clx_test2" });

    const event: AuditEvent = {
      action: "auth.login.failure",
    };

    await recordAuditEvent(event);

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        actorId: null,
        action: "auth.login.failure",
        targetType: null,
        targetId: null,
        metadata: undefined,
        ip: null,
        userAgent: null,
      },
    });
  });

  it("logs error and does not throw on DB failure", async () => {
    const dbError = new Error("connection refused");
    mockCreate.mockRejectedValueOnce(dbError);

    const event: AuditEvent = {
      actorId: "user_456",
      action: "admin.user.delete",
      targetType: "user",
      targetId: "user_789",
    };

    // Should not throw
    await expect(recordAuditEvent(event)).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith(
      { err: dbError, event: "admin.user.delete" },
      "audit-log.write_failed"
    );
  });
});
