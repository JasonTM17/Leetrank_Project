package auth

import (
	"context"
	"testing"
	"time"
)

// Pure-CPU tests for the persistent account-lockout policy helpers.
// DB-touching paths are exercised in test/integration/lockout_test.go.

func TestLockoutStatus_RetryAfterSeconds(t *testing.T) {
	now := time.Date(2026, 5, 19, 12, 0, 0, 0, time.UTC)

	cases := []struct {
		name string
		s    lockoutStatus
		want int
	}{
		{
			name: "unlocked returns 0",
			s:    lockoutStatus{},
			want: 0,
		},
		{
			name: "locked far in future returns positive",
			s:    lockoutStatus{locked: true, lockedUntil: now.Add(15 * time.Minute)},
			want: 900,
		},
		{
			name: "locked but already past returns 1 (floor)",
			s:    lockoutStatus{locked: true, lockedUntil: now.Add(-time.Second)},
			want: 1,
		},
		{
			name: "locked sub-second future returns 1 (floor)",
			s:    lockoutStatus{locked: true, lockedUntil: now.Add(500 * time.Millisecond)},
			want: 1,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := c.s.retryAfterSeconds(now); got != c.want {
				t.Errorf("retryAfterSeconds=%d, want %d", got, c.want)
			}
		})
	}
}

func TestLockoutConstants_AreSane(t *testing.T) {
	if lockoutThreshold != 10 {
		t.Errorf("lockoutThreshold drifted: %d", lockoutThreshold)
	}
	if lockoutWindow != time.Hour {
		t.Errorf("lockoutWindow drifted: %v", lockoutWindow)
	}
	if lockoutDuration != 15*time.Minute {
		t.Errorf("lockoutDuration drifted: %v", lockoutDuration)
	}
}

// Sanity check the DB helpers handle a nil pool gracefully (the pool
// is nil in pure-CPU tests and we lean on this in handler.go to skip
// audit/lockout writes when there's no DB).
func TestLockoutHelpers_NilPool(t *testing.T) {
	ctx := context.Background()
	t.Run("isLocked returns zero status", func(t *testing.T) {
		s, err := isLocked(ctx, nil, "anyone")
		if err != nil {
			t.Errorf("unexpected err: %v", err)
		}
		if s.locked {
			t.Error("expected unlocked status from nil pool")
		}
	})
	t.Run("recordLoginAttempt is a no-op", func(t *testing.T) {
		if err := recordLoginAttempt(ctx, nil, "id", "uid", "ip", "ua", false); err != nil {
			t.Errorf("unexpected err: %v", err)
		}
	})
	t.Run("recentFailureCount returns 0", func(t *testing.T) {
		n, err := recentFailureCount(ctx, nil, "anyone")
		if err != nil {
			t.Errorf("unexpected err: %v", err)
		}
		if n != 0 {
			t.Errorf("count=%d, want 0", n)
		}
	})
	t.Run("clearLockout is a no-op", func(t *testing.T) {
		if err := clearLockout(ctx, nil, "anyone"); err != nil {
			t.Errorf("unexpected err: %v", err)
		}
	})
}
