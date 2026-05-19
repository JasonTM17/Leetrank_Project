// Tests for hub fan-out behaviour.
//
// We don't drive a real redis pubsub here — that's covered in the
// integration suite. Instead we register a client directly and call
// the unexported `fanout` helper to assert the channel-routed delivery
// path works end-to-end at the hub layer.
//
// CI is the source of truth (no Go toolchain in the agent sandbox).
package hub

import (
	"log/slog"
	"os"
	"testing"
	"time"
)

// newTestClient returns a Client with a nil websocket.Conn — fanout
// never touches the conn, only the send channel.
func newTestClient(id string, channels []string) *Client {
	return NewClient(id, nil, channels)
}

func newSilentLogger() *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
}

// TestFanoutDeliversToSubscribedClient — register a client subscribed
// to "global", call fanout, expect the payload on its recv channel.
func TestFanoutDeliversToSubscribedClient(t *testing.T) {
	h := New(nil, newSilentLogger())

	c := newTestClient("c1", []string{"global"})
	h.Add(c)
	defer h.Remove(c)

	want := []byte(`{"hello":"world"}`)
	h.fanout("global", want)

	select {
	case msg := <-c.Recv():
		if msg.Channel != "global" {
			t.Fatalf("channel: got %q want %q", msg.Channel, "global")
		}
		if string(msg.Payload) != string(want) {
			t.Fatalf("payload: got %q want %q", msg.Payload, want)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("client did not receive fanout message within 500ms")
	}
}

// TestFanoutSkipsUnsubscribedClient — a client subscribed only to
// "verdicts:user:a" must not receive a message published on "global".
func TestFanoutSkipsUnsubscribedClient(t *testing.T) {
	h := New(nil, newSilentLogger())

	c := newTestClient("c1", []string{"verdicts:user:a"})
	h.Add(c)
	defer h.Remove(c)

	h.fanout("global", []byte("nope"))

	select {
	case msg := <-c.Recv():
		t.Fatalf("unsubscribed client received: %+v", msg)
	case <-time.After(50 * time.Millisecond):
		// Expected: nothing.
	}
}

// TestSubscribeAddsRoutingEntry — Subscribe should make a previously
// unsubscribed channel deliverable to the client.
func TestSubscribeAddsRoutingEntry(t *testing.T) {
	h := New(nil, newSilentLogger())

	c := newTestClient("c1", []string{})
	h.Add(c)
	defer h.Remove(c)

	h.Subscribe(c, "contests:weekly-1")
	h.fanout("contests:weekly-1", []byte(`{"event":"start"}`))

	select {
	case msg := <-c.Recv():
		if msg.Channel != "contests:weekly-1" {
			t.Fatalf("channel: got %q want %q", msg.Channel, "contests:weekly-1")
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatal("did not receive after Subscribe")
	}
}

// TestUnsubscribeRemovesRouting — after Unsubscribe, fanout must not
// deliver to the client even if previously subscribed.
func TestUnsubscribeRemovesRouting(t *testing.T) {
	h := New(nil, newSilentLogger())

	c := newTestClient("c1", []string{"global"})
	h.Add(c)
	defer h.Remove(c)

	h.Unsubscribe(c, "global")
	h.fanout("global", []byte("after-unsub"))

	select {
	case msg := <-c.Recv():
		t.Fatalf("got message after Unsubscribe: %+v", msg)
	case <-time.After(50 * time.Millisecond):
		// Expected.
	}
}

// TestFanoutDropsWhenBufferFull — when a client's send buffer is full
// the message is dropped (not blocking). We fill the buffer then
// fanout once more and expect no panic / no deadlock.
func TestFanoutDropsWhenBufferFull(t *testing.T) {
	h := New(nil, newSilentLogger())

	c := newTestClient("c1", []string{"global"})
	h.Add(c)
	defer h.Remove(c)

	// Fill the buffer (capacity ClientSendBuffer).
	for i := 0; i < ClientSendBuffer; i++ {
		c.send <- Message{Channel: "global", Payload: []byte("x")}
	}

	done := make(chan struct{})
	go func() {
		h.fanout("global", []byte("overflow"))
		close(done)
	}()

	select {
	case <-done:
		// Expected: the default branch in fanout drops.
	case <-time.After(500 * time.Millisecond):
		t.Fatal("fanout blocked when send buffer was full")
	}
}
