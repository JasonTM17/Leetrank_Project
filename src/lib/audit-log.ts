import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export type AuditAction =
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.logout"
  | "auth.password.change"
  | "auth.password.reset"
  | "auth.account.locked"
  | "auth.session.revoke"
  | "admin.user.create"
  | "admin.user.update"
  | "admin.user.delete"
  | "admin.role.change"
  | "admin.problem.publish"
  | "admin.problem.unpublish"
  | "admin.contest.create"
  | "admin.contest.update"
  | "api-key.create"
  | "api-key.revoke";

export interface AuditEvent {
  actorId?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: event.actorId ?? null,
        action: event.action,
        targetType: event.targetType ?? null,
        targetId: event.targetId ?? null,
        metadata: event.metadata ? (event.metadata as object) : undefined,
        ip: event.ip ?? null,
        userAgent: event.userAgent ?? null,
      },
    });
  } catch (err) {
    logger.error("audit-log.write_failed", { err, event: event.action });
  }
}
