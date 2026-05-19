// Graceful drain helpers: broadcast a server_shutdown event to every
// connected client and wait for them to disconnect, force-closing
// stragglers after a deadline.
package hub

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"nhooyr.io/websocket"
)

// BroadcastShutdown sends a server_shutdown notice on every client's
// send channel. It is best-effort: if a client's buffer is full the
// message is dropped (the client will still receive a 1001 close
// frame in Drain). Returns the number of clients notified.
func (h *Hub) BroadcastShutdown(reason string) int {
	body, _ := json.Marshal(map[string]any{
		"type":   "server_shutdown",
		"reason": reason,
	})
	h.mu.RLock()
	clients := make([]*Client, 0, len(h.clients))
	for c := range h.clients {
		clients = append(clients, c)
	}
	h.mu.RUnlock()
	for _, c := range clients {
		select {
		case c.send <- Message{Channel: "_system", Payload: body}:
		default:
		}
	}
	return len(clients)
}

// Drain waits up to `timeout` for the connection count to fall to
// zero. If clients are still connected when the deadline elapses it
// closes them with code 1001 (going away) and returns the number of
// clients force-closed. Calling Drain in parallel is unsupported.
func (h *Hub) Drain(ctx context.Context, timeout time.Duration) int {
	deadline := time.Now().Add(timeout)
	t := time.NewTicker(50 * time.Millisecond)
	defer t.Stop()
	for {
		h.mu.RLock()
		n := len(h.clients)
		h.mu.RUnlock()
		if n == 0 {
			return 0
		}
		if time.Now().After(deadline) {
			return h.forceClose("server shutting down")
		}
		select {
		case <-ctx.Done():
			return h.forceClose("server shutting down")
		case <-t.C:
		}
	}
}

func (h *Hub) forceClose(reason string) int {
	h.mu.RLock()
	clients := make([]*Client, 0, len(h.clients))
	for c := range h.clients {
		clients = append(clients, c)
	}
	h.mu.RUnlock()
	var wg sync.WaitGroup
	for _, c := range clients {
		if c.conn == nil {
			continue
		}
		wg.Add(1)
		go func(cl *Client) {
			defer wg.Done()
			_ = cl.conn.Close(websocket.StatusGoingAway, reason)
		}(c)
	}
	wg.Wait()
	return len(clients)
}
