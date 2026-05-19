// Package auth — account-lockout policy.
//
// Beyond the in-memory per-IP/per-account sliding-window rate limit, we
// also track failed logins in Postgres and lock an account for 15
// minutes once it accumulates 10 failures within a 1-hour window.
//
// The lockout key is the lower-cased identifier (email or username) the
// caller submitted, so attackers cannot exhaust a victim by spreading
// attempts across many IPs.
package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// lockoutThreshold is the number of failed logins per
	// lockoutWindow that triggers a lock.
	lockoutThreshold = 10
	// lockoutWindow is the rolling window the threshold is measured against.
	lockoutWindow = time.Hour
	// lockoutDuration is how long the account stays locked after tripping.
	lockoutDuration = 15 * time.Minute
)

// lockoutStatus describes the current lockout state of an identifier.
type lockoutStatus struct {
	locked      bool
	lockedUntil time.Time
}

// retryAfterSeconds returns the seconds until the lock expires.
// Always at least 1 to satisfy clients that round.
func (s lockoutStatus) retryAfterSeconds(now time.Time) int {
	if !s.locked {
		return 0
	}
	secs := int(s.lockedUntil.Sub(now).Seconds())
	if secs < 1 {
		return 1
	}
	return secs
}

// isLocked returns the lockout status for an identifier. If a lockout
// row exists but its lockedUntil has already passed, it is purged and
// the status is reported as unlocked.
func isLocked(ctx context.Context, pool *pgxpool.Pool, identifier string) (lockoutStatus, error) {
	if pool == nil {
		return lockoutStatus{}, nil
	}
	var lockedUntil time.Time
	err := pool.QueryRow(ctx,
		`SELECT "lockedUntil" FROM "AccountLockout" WHERE identifier = $1`,
		identifier,
	).Scan(&lockedUntil)
	if errors.Is(err, pgx.ErrNoRows) {
		return lockoutStatus{}, nil
	}
	if err != nil {
		return lockoutStatus{}, err
	}
	if time.Now().UTC().After(lockedUntil) {
		// Window already passed — clear the row and report unlocked.
		_, _ = pool.Exec(ctx,
			`DELETE FROM "AccountLockout" WHERE identifier = $1 AND "lockedUntil" = $2`,
			identifier, lockedUntil,
		)
		return lockoutStatus{}, nil
	}
	return lockoutStatus{locked: true, lockedUntil: lockedUntil}, nil
}

// recordLoginAttempt persists a single login attempt (success or failure).
// userID may be empty when the identifier did not match a real user.
func recordLoginAttempt(ctx context.Context, pool *pgxpool.Pool, identifier, userID, ip, userAgent string, success bool) error {
	if pool == nil {
		return nil
	}
	var userIDArg any
	if userID == "" {
		userIDArg = nil
	} else {
		userIDArg = userID
	}
	_, err := pool.Exec(ctx,
		`INSERT INTO "LoginAttempt" (identifier, "userId", success, "ipAddress", "userAgent")
		 VALUES ($1, $2, $3, $4, $5)`,
		identifier, userIDArg, success, ip, userAgent,
	)
	return err
}

// recentFailureCount returns the number of failed logins for the
// identifier within the rolling lockoutWindow.
func recentFailureCount(ctx context.Context, pool *pgxpool.Pool, identifier string) (int, error) {
	if pool == nil {
		return 0, nil
	}
	since := time.Now().UTC().Add(-lockoutWindow)
	var count int
	err := pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM "LoginAttempt"
		 WHERE identifier = $1 AND success = false AND "createdAt" >= $2`,
		identifier, since,
	).Scan(&count)
	if err != nil {
		return 0, err
	}
	return count, nil
}

// lockAccount upserts an AccountLockout row for `lockoutDuration` from now.
// Idempotent — a fresh lock extends an existing one.
func lockAccount(ctx context.Context, pool *pgxpool.Pool, identifier, reason string) (time.Time, error) {
	if pool == nil {
		return time.Time{}, nil
	}
	until := time.Now().UTC().Add(lockoutDuration)
	_, err := pool.Exec(ctx,
		`INSERT INTO "AccountLockout" (identifier, "lockedUntil", reason)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (identifier) DO UPDATE
		 SET "lockedUntil" = EXCLUDED."lockedUntil",
		     reason        = EXCLUDED.reason,
		     "updatedAt"   = NOW()`,
		identifier, until, reason,
	)
	if err != nil {
		return time.Time{}, err
	}
	return until, nil
}

// clearLockout removes an existing lockout row (called on a successful login).
func clearLockout(ctx context.Context, pool *pgxpool.Pool, identifier string) error {
	if pool == nil {
		return nil
	}
	_, err := pool.Exec(ctx,
		`DELETE FROM "AccountLockout" WHERE identifier = $1`, identifier,
	)
	return err
}
