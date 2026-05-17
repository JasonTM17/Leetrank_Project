package main

import (
	"context"
	"errors"
	"sync"
	"time"
)

// Concurrency budgets, all overridable via env vars in main.go.
type concurrencyConfig struct {
	GlobalMax  int           // hard cap across the whole judge
	PerIPMax   int           // cap per remote IP
	QueueWait  time.Duration // how long a request will block waiting for a slot
}

var defaultConcurrency = concurrencyConfig{
	GlobalMax: 16,
	PerIPMax:  4,
	QueueWait: 10 * time.Second,
}

// errJudgeBusy is returned to the caller when no slot is available within QueueWait.
var errJudgeBusy = errors.New("judge is busy; please retry shortly")

// scheduler bounds how many executions run concurrently.
//
// We use weighted semaphores instead of a fixed worker pool because runtime
// for an execution is bounded but unpredictable (depends on user code, not
// queue position) and a pool would force serial dispatch even when slots
// are free.
type scheduler struct {
	cfg    concurrencyConfig
	global chan struct{}

	mu      sync.Mutex
	perIP   map[string]chan struct{}
	inflightByIP map[string]int

	// telemetry — read by /health, /metrics
	totalAccepted int64
	totalRejected int64
	currentInUse  int64
}

func newScheduler(cfg concurrencyConfig) *scheduler {
	return &scheduler{
		cfg:          cfg,
		global:       make(chan struct{}, cfg.GlobalMax),
		perIP:        make(map[string]chan struct{}),
		inflightByIP: make(map[string]int),
	}
}

func (s *scheduler) ipSlot(ip string) chan struct{} {
	s.mu.Lock()
	defer s.mu.Unlock()
	slot, ok := s.perIP[ip]
	if !ok {
		slot = make(chan struct{}, s.cfg.PerIPMax)
		s.perIP[ip] = slot
	}
	return slot
}

// Acquire blocks until both a global and a per-IP slot are available, or
// until the QueueWait deadline elapses (in which case errJudgeBusy is
// returned). The returned release function MUST be called exactly once.
func (s *scheduler) Acquire(ctx context.Context, ip string) (release func(), err error) {
	deadline := time.NewTimer(s.cfg.QueueWait)
	defer deadline.Stop()

	ipSlot := s.ipSlot(ip)

	// 1) Per-IP slot first — cheap to release if global ends up failing.
	select {
	case ipSlot <- struct{}{}:
	case <-deadline.C:
		s.recordReject()
		return nil, errJudgeBusy
	case <-ctx.Done():
		s.recordReject()
		return nil, ctx.Err()
	}

	// 2) Global slot.
	select {
	case s.global <- struct{}{}:
	case <-deadline.C:
		<-ipSlot
		s.recordReject()
		return nil, errJudgeBusy
	case <-ctx.Done():
		<-ipSlot
		s.recordReject()
		return nil, ctx.Err()
	}

	s.mu.Lock()
	s.inflightByIP[ip]++
	s.totalAccepted++
	s.currentInUse++
	s.mu.Unlock()

	released := false
	return func() {
		if released {
			return
		}
		released = true
		<-s.global
		<-ipSlot
		s.mu.Lock()
		s.inflightByIP[ip]--
		if s.inflightByIP[ip] <= 0 {
			delete(s.inflightByIP, ip)
		}
		s.currentInUse--
		s.mu.Unlock()
	}, nil
}

func (s *scheduler) recordReject() {
	s.mu.Lock()
	s.totalRejected++
	s.mu.Unlock()
}

// snapshot returns a point-in-time view of scheduler load for /health.
func (s *scheduler) snapshot() schedulerSnapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	return schedulerSnapshot{
		GlobalMax:     s.cfg.GlobalMax,
		PerIPMax:      s.cfg.PerIPMax,
		InUse:         s.currentInUse,
		TotalAccepted: s.totalAccepted,
		TotalRejected: s.totalRejected,
		ActiveIPs:     len(s.inflightByIP),
	}
}

type schedulerSnapshot struct {
	GlobalMax     int   `json:"globalMax"`
	PerIPMax      int   `json:"perIpMax"`
	InUse         int64 `json:"inUse"`
	TotalAccepted int64 `json:"totalAccepted"`
	TotalRejected int64 `json:"totalRejected"`
	ActiveIPs     int   `json:"activeIps"`
}
