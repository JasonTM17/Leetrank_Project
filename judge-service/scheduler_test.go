package main

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestScheduler_AcquireRelease(t *testing.T) {
	s := newScheduler(concurrencyConfig{GlobalMax: 2, PerIPMax: 2, QueueWait: 100 * time.Millisecond})

	r1, err := s.Acquire(context.Background(), "1.1.1.1")
	if err != nil {
		t.Fatalf("first acquire: %v", err)
	}
	r2, err := s.Acquire(context.Background(), "1.1.1.1")
	if err != nil {
		t.Fatalf("second acquire: %v", err)
	}

	// Third should be rejected because both global=2 and perIP=2 are full.
	if _, err := s.Acquire(context.Background(), "1.1.1.1"); err != errJudgeBusy {
		t.Fatalf("expected errJudgeBusy, got %v", err)
	}

	r1()
	r2()

	if snap := s.snapshot(); snap.InUse != 0 {
		t.Fatalf("expected 0 in-use after release, got %d", snap.InUse)
	}
}

func TestScheduler_PerIPCapDoesNotBlockOtherIPs(t *testing.T) {
	s := newScheduler(concurrencyConfig{GlobalMax: 8, PerIPMax: 1, QueueWait: 50 * time.Millisecond})

	r1, err := s.Acquire(context.Background(), "ipA")
	if err != nil {
		t.Fatalf("acquire ipA: %v", err)
	}
	defer r1()

	if _, err := s.Acquire(context.Background(), "ipA"); err != errJudgeBusy {
		t.Fatalf("ipA should be capped, got %v", err)
	}

	r2, err := s.Acquire(context.Background(), "ipB")
	if err != nil {
		t.Fatalf("ipB should succeed, got %v", err)
	}
	defer r2()
}

func TestScheduler_ContextCancelReleasesIPSlot(t *testing.T) {
	s := newScheduler(concurrencyConfig{GlobalMax: 1, PerIPMax: 1, QueueWait: time.Second})

	hold, err := s.Acquire(context.Background(), "ip")
	if err != nil {
		t.Fatalf("hold acquire: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // immediately cancel
	if _, err := s.Acquire(ctx, "ip"); err == nil {
		t.Fatalf("expected cancellation error")
	}

	hold()

	// After release, a fresh acquire on the same IP should succeed.
	r, err := s.Acquire(context.Background(), "ip")
	if err != nil {
		t.Fatalf("post-release acquire: %v", err)
	}
	r()
}

func TestScheduler_ConcurrentLoad(t *testing.T) {
	s := newScheduler(concurrencyConfig{GlobalMax: 4, PerIPMax: 2, QueueWait: 500 * time.Millisecond})

	var accepted int64
	var rejected int64
	var wg sync.WaitGroup

	// 10 concurrent users * 4 requests each = 40 requests.
	// Global cap is 4 — most will queue and complete, but with the
	// short hold time below the system should never deadlock.
	for u := 0; u < 10; u++ {
		ip := "ip" + string(rune('A'+u))
		for k := 0; k < 4; k++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				release, err := s.Acquire(context.Background(), ip)
				if err != nil {
					atomic.AddInt64(&rejected, 1)
					return
				}
				time.Sleep(20 * time.Millisecond)
				release()
				atomic.AddInt64(&accepted, 1)
			}()
		}
	}

	wg.Wait()
	if total := accepted + rejected; total != 40 {
		t.Fatalf("expected 40 outcomes, got %d", total)
	}
	if accepted == 0 {
		t.Fatalf("expected some requests to be accepted")
	}
	if snap := s.snapshot(); snap.InUse != 0 {
		t.Fatalf("expected 0 in-use after stress test, got %d", snap.InUse)
	}
}

func TestIsSafe_Python(t *testing.T) {
	cases := []struct {
		code string
		safe bool
	}{
		{"print(sum([1,2,3]))", true},
		{"def two_sum(nums, target):\n    return []", true},
		{"import os\nos.system('ls')", false},
		{"__import__('os').system('ls')", false},
		{"eval('1+1')", false},
		{"open('/etc/passwd').read()", false},
	}
	for _, c := range cases {
		if got := isSafe(c.code, "python"); got != c.safe {
			t.Errorf("isSafe(%q, python) = %v, want %v", c.code, got, c.safe)
		}
	}
}

func TestIsSafe_JavaScript(t *testing.T) {
	cases := []struct {
		code string
		safe bool
	}{
		{"console.log([1,2,3].reduce((a,b)=>a+b))", true},
		{"function solve(a){ return a*2 }", true},
		{"require('child_process').exec('ls')", false},
		{"require(\"fs\").readFileSync('/etc/passwd')", false},
		{"process.exit(1)", false},
	}
	for _, c := range cases {
		if got := isSafe(c.code, "javascript"); got != c.safe {
			t.Errorf("isSafe(%q, javascript) = %v, want %v", c.code, got, c.safe)
		}
	}
}

func TestRateLimiter_AllowsThenBlocks(t *testing.T) {
	rl := newRateLimiter()

	// Burn through the per-window budget for one IP.
	allowed := 0
	for i := 0; i < rateLimitRequests+5; i++ {
		if rl.Allow("1.2.3.4") {
			allowed++
		}
	}
	if allowed != rateLimitRequests {
		t.Fatalf("expected exactly %d allowed, got %d", rateLimitRequests, allowed)
	}

	// A different IP should not be impacted.
	if !rl.Allow("9.9.9.9") {
		t.Fatalf("unrelated IP should still be allowed")
	}
}
