package auth

import (
	"testing"
	"time"
)

// Rate limiter is private but exposed here as a unit since it's the
// load-bearing piece for the login brute-force defence. Pure-CPU tests,
// no DB.

func TestRateLimiter_AllowsFirstFiveAttempts(t *testing.T) {
	rl := newRateLimiter()
	for i := 0; i < rateLimitMax; i++ {
		ok, retry := rl.allow("user@test")
		if !ok {
			t.Fatalf("attempt %d unexpectedly blocked", i+1)
		}
		if retry != 0 {
			t.Fatalf("attempt %d returned non-zero retry %d", i+1, retry)
		}
	}
}

func TestRateLimiter_BlocksSixthAttempt(t *testing.T) {
	rl := newRateLimiter()
	key := "user@test"
	for i := 0; i < rateLimitMax; i++ {
		_, _ = rl.allow(key)
	}
	ok, retry := rl.allow(key)
	if ok {
		t.Fatal("expected sixth attempt to be blocked")
	}
	if retry <= 0 {
		t.Fatalf("expected positive retry seconds, got %d", retry)
	}
}

func TestRateLimiter_KeysAreIsolated(t *testing.T) {
	rl := newRateLimiter()
	for i := 0; i < rateLimitMax; i++ {
		_, _ = rl.allow("alpha")
	}
	ok, _ := rl.allow("alpha")
	if ok {
		t.Fatal("alpha should be blocked after burst")
	}
	ok, _ = rl.allow("beta")
	if !ok {
		t.Fatal("beta should be unaffected by alpha's window")
	}
}

func TestRateLimiter_WindowResetsAfterExpiry(t *testing.T) {
	rl := newRateLimiter()
	key := "user@test"
	for i := 0; i < rateLimitMax; i++ {
		_, _ = rl.allow(key)
	}
	// Force-expire the window in-place.
	rl.mu.Lock()
	rl.entries[key].windowEnd = time.Now().Add(-time.Second)
	rl.mu.Unlock()

	ok, retry := rl.allow(key)
	if !ok {
		t.Fatal("expected allow after window expiry")
	}
	if retry != 0 {
		t.Fatalf("expected retry=0 after reset, got %d", retry)
	}
}

func TestEmailRegex(t *testing.T) {
	cases := []struct {
		in    string
		valid bool
	}{
		{"user@example.com", true},
		{"a.b+c@sub.example.org", true},
		{"plainaddress", false},
		{"@nodomain.com", false},
		{"no-at-symbol.com", false},
		{"user@host", false}, // need a dot in domain
		{"", false},
		{"user @example.com", false}, // space rejected
	}
	for _, c := range cases {
		got := emailRe.MatchString(c.in)
		if got != c.valid {
			t.Errorf("emailRe(%q) = %v, want %v", c.in, got, c.valid)
		}
	}
}

func TestUsernameRegex(t *testing.T) {
	cases := []struct {
		in    string
		valid bool
	}{
		{"abc", true},
		{"a_b_c_1", true},
		{"user_123", true},
		{"AB", false},          // too short
		{"ab", false},          // too short (3 min)
		{"User", false},        // uppercase rejected
		{"with-dash", false},   // dash not allowed
		{"with.dot", false},    // dot not allowed
		{"with space", false},  // space rejected
		{"abcdefghijklmnopqrstuvwxyz0123", true}, // 30 chars
		{"abcdefghijklmnopqrstuvwxyz01234", false}, // 31 chars exceeds max
		{"", false},
	}
	for _, c := range cases {
		got := usernameRe.MatchString(c.in)
		if got != c.valid {
			t.Errorf("usernameRe(%q) = %v, want %v", c.in, got, c.valid)
		}
	}
}
