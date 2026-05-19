// Drain path tests. We don't drive a real websocket — drain.go's two
// behaviours that don't need the conn (BroadcastShutdown queue
// delivery, and Drain returning when the client count hits zero) are
// exercised here. The forced-close path is covered by integration
// tests where a real websocket exists.
package hub

import (
	"context"
	"encoding/json"
	"testing"
	"time"
)

func TestBroadcastShutdownDeliversNoticeToEveryClient(t *testing.T) {
	h := New(nil, newSilentLogger())
	a := newTestClient("a", []string{"global"})
	b := newTestClient("b", []string{"verdicts:user:bob"})
	h.Add(a)
	h.Add(b)
	defer h.Remove(a)
	defer h.Remove(b)

	notified := h.BroadcastShutdown("server_shutdown")
	if notified != 2 {
		t.Fatalf("notified: got %d want 2", notified)
	}

	for _, c := range []*Client{a, b} {
		select {
		case msg := <-c.Recv():
			var body map[string]any
			if err := json.Unmarshal(msg.Payload, &body); err != nil {
				t.Fatalf("payload not json: %v", err)
			}
			if body["type"] != "server_shutdown" {
				t.Fatalf("type: got %v want server_shutdown", body["type"])
			}
		case <-time.After(500 * time.Millisecond):
			t.Fatalf("client %s did not receive shutdown notice", c.id)
		}
	}
}

func TestDrainReturnsZeroWhenAllClientsAlreadyGone(t *testing.T) {
	h := New(nil, newSilentLogger())
	// No clients added.
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	forced := h.Drain(ctx, 100*time.Millisecond)
	if forced != 0 {
		t.Fatalf("forced: got %d want 0 (no clients)", forced)
	}
}

func TestDrainExitsCleanlyWhenClientLeavesDuringWait(t *testing.T) {
	h := New(nil, newSilentLogger())
	c := newTestClient("c", []string{"global"})
	h.Add(c)

	go func() {
		// Disconnect after one tick.
		time.Sleep(80 * time.Millisecond)
		h.Remove(c)
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	forced := h.Drain(ctx, 1*time.Second)
	if forced != 0 {
		t.Fatalf("forced: got %d want 0 (client left voluntarily)", forced)
	}
}

func TestDrainReportsForcedCountWhenDeadlineExpires(t *testing.T) {
	h := New(nil, newSilentLogger())
	// Stub clients with nil conn — forceClose skips them but still
	// counts them as present, which is what we want to assert here:
	// drain hit its deadline.
	a := newTestClient("a", []string{"global"})
	b := newTestClient("b", []string{"global"})
	h.Add(a)
	h.Add(b)
	defer h.Remove(a)
	defer h.Remove(b)

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	forced := h.Drain(ctx, 80*time.Millisecond)
	if forced != 2 {
		t.Fatalf("forced: got %d want 2", forced)
	}
}
