// Connection-count limiter — per-JWT-subject and per-client-IP caps.
//
// Used by wsserver to refuse extra concurrent websocket connections from
// the same authenticated user (default 5) or from the same source IP
// (default 50). Counters are released when ServeWS's defer fires, so a
// crashed handler or upgrade failure cannot leak quota.
package hub

import (
	"sync"
)

// Default caps applied when NewLimiter is called with non-positive values.
const (
	DefaultPerSubject = 5
	DefaultPerIP      = 50
)

// Limiter is a goroutine-safe in-memory counter for the realtime
// websocket Accept path. It is not distributed — multi-replica deploys
// run one limiter per pod and rely on the per-IP cap to bound the
// blast radius.
type Limiter struct {
	mu         sync.Mutex
	bySub      map[string]int
	byIP       map[string]int
	perSubject int
	perIP      int
}

// NewLimiter returns a Limiter capping subject and IP concurrency. A
// non-positive cap is replaced with the default. Caps may be raised at
// startup via env (REALTIME_MAX_CONNS_PER_USER / _PER_IP) but are not
// hot-reloaded.
func NewLimiter(perSubject, perIP int) *Limiter {
	if perSubject <= 0 {
		perSubject = DefaultPerSubject
	}
	if perIP <= 0 {
		perIP = DefaultPerIP
	}
	return &Limiter{
		bySub:      make(map[string]int),
		byIP:       make(map[string]int),
		perSubject: perSubject,
		perIP:      perIP,
	}
}

// Acquire reserves quota for the (subject, ip) pair. On overflow it
// returns ok=false plus a reason string suitable for a websocket close
// frame ("policy violation: per-user limit"). The caller MUST invoke
// Release in the same handler when the connection ends.
//
// Empty subject or empty ip skip that side of the check; this keeps
// pre-auth diagnostics and tests simple.
func (l *Limiter) Acquire(subject, ip string) (bool, string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if subject != "" && l.bySub[subject] >= l.perSubject {
		return false, "policy violation: per-user limit"
	}
	if ip != "" && l.byIP[ip] >= l.perIP {
		return false, "policy violation: per-ip limit"
	}
	if subject != "" {
		l.bySub[subject]++
	}
	if ip != "" {
		l.byIP[ip]++
	}
	return true, ""
}

// Release decrements counters. Idempotent at zero (defensive — the
// handler always pairs Acquire/Release but mismatch here must not
// panic in production).
func (l *Limiter) Release(subject, ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if subject != "" {
		if l.bySub[subject] > 0 {
			l.bySub[subject]--
		}
		if l.bySub[subject] == 0 {
			delete(l.bySub, subject)
		}
	}
	if ip != "" {
		if l.byIP[ip] > 0 {
			l.byIP[ip]--
		}
		if l.byIP[ip] == 0 {
			delete(l.byIP, ip)
		}
	}
}

// Snapshot returns the current per-subject and per-ip totals — exposed
// for tests and the /v1/realtime/metrics admin path. Returned maps are
// copies, safe for the caller to mutate.
func (l *Limiter) Snapshot() (map[string]int, map[string]int) {
	l.mu.Lock()
	defer l.mu.Unlock()
	subs := make(map[string]int, len(l.bySub))
	ips := make(map[string]int, len(l.byIP))
	for k, v := range l.bySub {
		subs[k] = v
	}
	for k, v := range l.byIP {
		ips[k] = v
	}
	return subs, ips
}

// Caps returns the configured maxima.
func (l *Limiter) Caps() (perSubject, perIP int) {
	return l.perSubject, l.perIP
}
