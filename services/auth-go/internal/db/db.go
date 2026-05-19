// Package db owns the pgxpool connection lifecycle.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// New opens a pooled connection. connection_limit defaults to 5 (auth
// is read-heavy with bursty login traffic; pgBouncer at the edge will
// raise this once Phase 6 ships).
func New(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse pool config: %w", err)
	}
	cfg.MaxConns = 5
	cfg.MinConns = 1
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute

	connectCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(connectCtx, cfg)
	if err != nil {
		return nil, fmt.Errorf("new pool: %w", err)
	}
	if err := pool.Ping(connectCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	if err := EnsureRefreshTokenTable(connectCtx, pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ensure RefreshToken: %w", err)
	}
	if err := EnsureLockoutTables(connectCtx, pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ensure lockout tables: %w", err)
	}
	if err := EnsureCredentialFlowTables(connectCtx, pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ensure credential flow tables: %w", err)
	}
	return pool, nil
}

// EnsureLockoutTables creates the LoginAttempt + AccountLockout tables
// used by the per-account brute-force lockout policy. Idempotent.
func EnsureLockoutTables(ctx context.Context, pool *pgxpool.Pool) error {
	const ddl = `
CREATE TABLE IF NOT EXISTS "LoginAttempt" (
    id          BIGSERIAL   PRIMARY KEY,
    identifier  TEXT        NOT NULL,
    "userId"    TEXT,
    success     BOOLEAN     NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "LoginAttempt_identifier_createdAt_idx"
    ON "LoginAttempt" (identifier, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "LoginAttempt_userId_createdAt_idx"
    ON "LoginAttempt" ("userId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "AccountLockout" (
    identifier    TEXT        PRIMARY KEY,
    "lockedUntil" TIMESTAMPTZ NOT NULL,
    reason        TEXT        NOT NULL DEFAULT 'too_many_failed_logins',
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "AccountLockout_lockedUntil_idx"
    ON "AccountLockout" ("lockedUntil");
`
	_, err := pool.Exec(ctx, ddl)
	return err
}

// EnsureCredentialFlowTables creates the password-reset + email-verification
// token tables and adds the User."emailVerified" column. Idempotent.
func EnsureCredentialFlowTables(ctx context.Context, pool *pgxpool.Pool) error {
	const ddl = `
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "tokenHash" TEXT        PRIMARY KEY,
    "userId"    TEXT        NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt"    TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx"
    ON "PasswordResetToken" ("userId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx"
    ON "PasswordResetToken" ("expiresAt");

CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
    "tokenHash" TEXT        PRIMARY KEY,
    "userId"    TEXT        NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "usedAt"    TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_idx"
    ON "EmailVerificationToken" ("userId");
`
	_, err := pool.Exec(ctx, ddl)
	return err
}

// EnsureAuditLogTable creates the AuditLog table used to record
// security-relevant events on a user's account. Idempotent.
func EnsureAuditLogTable(ctx context.Context, pool *pgxpool.Pool) error {
	const ddl = `
CREATE TABLE IF NOT EXISTS "AuditLog" (
    id          BIGSERIAL   PRIMARY KEY,
    "userId"    TEXT,
    action      TEXT        NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    metadata    JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx"
    ON "AuditLog" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx"
    ON "AuditLog" (action, "createdAt" DESC);
`
	_, err := pool.Exec(ctx, ddl)
	return err
}

// EnsureRefreshTokenTable creates the RefreshToken table and indexes
// when missing. Idempotent — safe to call on every boot.
func EnsureRefreshTokenTable(ctx context.Context, pool *pgxpool.Pool) error {
	const ddl = `
CREATE TABLE IF NOT EXISTS "RefreshToken" (
    "tokenHash"   TEXT        PRIMARY KEY,
    "userId"      TEXT        NOT NULL,
    "expiresAt"   TIMESTAMPTZ NOT NULL,
    "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "revokedAt"   TIMESTAMPTZ NULL,
    "rotatedFrom" TEXT        NULL
);
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx"    ON "RefreshToken" ("userId");
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken" ("expiresAt");
`
	_, err := pool.Exec(ctx, ddl)
	return err
}
