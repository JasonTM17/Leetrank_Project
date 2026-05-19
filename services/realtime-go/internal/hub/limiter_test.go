// Tests for the connection limiter — caps must trip exactly at the
// configured threshold and Release must restore quota.
package hub

import (
	"sync"
	"testing"
)

func TestLimiterPerSubjectCap(t *testing.T) {
	l := NewLimiter(3, 100)
	for i := 0; i < 3; i++ {
		ok, _ := l.Acquire("alice", "1.1.1.1")
		if !ok {
			t.Fatalf("connection %d should be allowed", i)
		}
	}
	ok, reason := l.Acquire("alice", "1.1.1.1")
	if ok {
		t.Fatal("4th connection from same subject must be rejected")
	}
	if reason == "" {
		t.Fatal("rejection must include a reason")
	}
}

func TestLimiterPerIPCap(t *testing.T) {
	l := NewLimiter(100, 4)
	for i := 0; i < 4; i++ {
		ok, _ := l.Acquire("", "9.9.9.9")
		if !ok {
			t.Fatalf("ip slot %d should be free", i)
		}
	}
	ok, _ := l.Acquire("", "9.9.9.9")
	if ok {
		t.Fatal("5th connection from same ip must be rejected")
	}
}

func TestLimiterReleaseRestoresQuota(t *testing.T) {
	l := NewLimiter(2, 2)
	_, _ = l.Acquire("bob", "2.2.2.2")
	_, _ = l.Acquire("bob", "2.2.2.2")
	if ok, _ := l.Acquire("bob", "2.2.2.2"); ok {
		t.Fatal("expected to be at cap")
	}
	l.Release("bob", "2.2.2.2")
	if ok, _ := l.Acquire("bob", "2.2.2.2"); !ok {
		t.Fatal("Release should free a slot")
	}
}

func TestLimiterDefaultsAppliedForNonPositive(t *testing.T) {
	l := NewLimiter(0, -1)
	sub, ip := l.Caps()
	if sub != DefaultPerSubject {
		t.Fatalf("perSubject default: got %d want %d", sub, DefaultPerSubject)
	}
	if ip != DefaultPerIP {
		t.Fatalf("perIP default: got %d want %d", ip, DefaultPerIP)
	}
}

func TestLimiterEmptyKeysSkipChecks(t *testing.T) {
	l := NewLimiter(1, 1)
	if ok, _ := l.Acquire("", ""); !ok {
		t.Fatal("empty subject + empty ip should always pass")
	}
	if ok, _ := l.Acquire("", ""); !ok {
		t.Fatal("repeated empty acquire should still pass — nothing to count")
	}
}

func TestLimiterIsConcurrencySafe(t *testing.T) {
	l := NewLimiter(50, 1000)
	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = l.Acquire("alice", "")
		}()
	}
	wg.Wait()
	subs, _ := l.Snapshot()
	if subs["alice"] != 50 {
		t.Fatalf("after 50 acquires expected 50, got %d", subs["alice"])
	}
	if ok, _ := l.Acquire("alice", ""); ok {
		t.Fatal("51st must be over the cap")
	}
}
