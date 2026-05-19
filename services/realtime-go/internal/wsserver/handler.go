// Package wsserver implements the websocket upgrade and per-connection
// read/write loops.
package wsserver

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/JasonTM17/Leetrank_Project/services/realtime-go/internal/auth"
	"github.com/JasonTM17/Leetrank_Project/services/realtime-go/internal/hub"
	"github.com/JasonTM17/Leetrank_Project/services/realtime-go/internal/metrics"
	"github.com/google/uuid"
	"nhooyr.io/websocket"
)

type Handler struct {
	Hub          *hub.Hub
	Logger       *slog.Logger
	JWTSecret    string
	AllowOrigins []string
	Limiter      *hub.Limiter
	// Drain, when non-nil and closed, signals graceful shutdown:
	// new upgrades are refused with 503 and existing clients are
	// notified via the writeLoop's drain branch.
	Drain <-chan struct{}
}

type clientCommand struct {
	Action  string `json:"action"`            // subscribe | unsubscribe | ping
	Channel string `json:"channel,omitempty"` // channel name
}

type serverEvent struct {
	Type    string          `json:"type"` // event | ack | error | pong
	Channel string          `json:"channel,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
	Error   string          `json:"error,omitempty"`
}

func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	if h.Drain != nil {
		select {
		case <-h.Drain:
			metrics.HTTPRequests.WithLabelValues("/v1/realtime", "503").Inc()
			http.Error(w, "shutting down", http.StatusServiceUnavailable)
			return
		default:
		}
	}

	tokQS := r.URL.Query().Get("token")
	if tokQS == "" {
		bearer := r.Header.Get("Authorization")
		if strings.HasPrefix(bearer, "Bearer ") {
			tokQS = strings.TrimPrefix(bearer, "Bearer ")
		}
	}
	claims, err := auth.Verify(tokQS, h.JWTSecret)
	if err != nil {
		metrics.HTTPRequests.WithLabelValues("/v1/realtime", "401").Inc()
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	ip := clientIP(r)
	if h.Limiter != nil {
		ok, reason := h.Limiter.Acquire(claims.Sub, ip)
		if !ok {
			metrics.HTTPRequests.WithLabelValues("/v1/realtime", "429").Inc()
			metrics.WSRejected.WithLabelValues(reasonLabel(reason)).Inc()
			// Upgrade then close so the client receives an RFC-6455
			// 1008 (policy violation) frame rather than an HTTP 429
			// — browsers surface this through the WebSocket onclose
			// handler.
			conn, uerr := websocket.Accept(w, r, &websocket.AcceptOptions{
				OriginPatterns: h.AllowOrigins,
			})
			if uerr != nil {
				if h.Limiter != nil {
					h.Limiter.Release(claims.Sub, ip)
				}
				return
			}
			_ = conn.Close(websocket.StatusPolicyViolation, reason)
			if h.Limiter != nil {
				h.Limiter.Release(claims.Sub, ip)
			}
			return
		}
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns:  h.AllowOrigins,
		CompressionMode: websocket.CompressionContextTakeover,
	})
	if err != nil {
		metrics.HTTPRequests.WithLabelValues("/v1/realtime", "400").Inc()
		return
	}

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	conn.SetReadLimit(8 << 10) // 8 KiB

	initialChannels := []string{}
	channelsParam := r.URL.Query().Get("channels")
	if channelsParam != "" {
		for _, c := range strings.Split(channelsParam, ",") {
			c = strings.TrimSpace(c)
			if c != "" {
				initialChannels = append(initialChannels, c)
			}
		}
	}
	if len(initialChannels) == 0 {
		// Per-user verdict channel by default.
		initialChannels = []string{"verdicts:user:" + claims.Sub}
	}

	id := uuid.NewString()
	client := hub.NewClient(id, conn, initialChannels)
	h.Hub.Add(client)
	metrics.HTTPRequests.WithLabelValues("/v1/realtime", "101").Inc()

	defer func() {
		h.Hub.Remove(client)
		_ = conn.Close(websocket.StatusNormalClosure, "bye")
		if h.Limiter != nil {
			h.Limiter.Release(claims.Sub, ip)
		}
	}()

	go h.writeLoop(ctx, client)
	h.readLoop(ctx, client)
}

func (h *Handler) readLoop(ctx context.Context, c *hub.Client) {
	pingTicker := time.NewTicker(hub.PingInterval)
	defer pingTicker.Stop()

	// Ping loop: every PingInterval send a ping that must complete its
	// round-trip (Pong) within PongWait. nhooyr.io/websocket's Ping()
	// blocks until the pong arrives or its context expires; on timeout
	// we cancel the parent context so the read loop unblocks and the
	// connection drops cleanly.
	pingCtx, pingCancel := context.WithCancel(ctx)
	defer pingCancel()
	go func() {
		for {
			select {
			case <-pingCtx.Done():
				return
			case <-pingTicker.C:
				deadlineCtx, cancel := context.WithTimeout(pingCtx, hub.PongWait)
				err := c.Conn().Ping(deadlineCtx)
				cancel()
				if err != nil {
					h.Logger.Debug("ws ping/pong miss",
						"err", err.Error(),
						"client", c.ID())
					_ = c.Conn().Close(websocket.StatusPolicyViolation, "pong timeout")
					return
				}
			}
		}
	}()

	for {
		_, data, err := c.Conn().Read(ctx)
		if err != nil {
			var ce websocket.CloseError
			if !errors.As(err, &ce) {
				h.Logger.Debug("ws read err", "err", err.Error(), "client", c.ID())
			}
			return
		}
		var cmd clientCommand
		if err := json.Unmarshal(data, &cmd); err != nil {
			h.writeJSON(ctx, c, serverEvent{Type: "error", Error: "invalid json"})
			continue
		}
		switch cmd.Action {
		case "subscribe":
			if cmd.Channel == "" || !channelAllowed(cmd.Channel) {
				h.writeJSON(ctx, c, serverEvent{Type: "error", Error: "bad channel"})
				continue
			}
			h.Hub.Subscribe(c, cmd.Channel)
			h.writeJSON(ctx, c, serverEvent{Type: "ack", Channel: cmd.Channel})
		case "unsubscribe":
			if cmd.Channel == "" {
				continue
			}
			h.Hub.Unsubscribe(c, cmd.Channel)
			h.writeJSON(ctx, c, serverEvent{Type: "ack", Channel: cmd.Channel})
		case "ping":
			h.writeJSON(ctx, c, serverEvent{Type: "pong"})
		default:
			h.writeJSON(ctx, c, serverEvent{Type: "error", Error: "unknown action"})
		}
	}
}

func (h *Handler) writeLoop(ctx context.Context, c *hub.Client) {
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-c.Recv():
			ev := serverEvent{
				Type:    "event",
				Channel: msg.Channel,
				Payload: json.RawMessage(msg.Payload),
			}
			h.writeJSON(ctx, c, ev)
		}
	}
}

func (h *Handler) writeJSON(ctx context.Context, c *hub.Client, ev serverEvent) {
	body, err := json.Marshal(ev)
	if err != nil {
		return
	}
	wctx, cancel := context.WithTimeout(ctx, hub.WriteWait)
	defer cancel()
	_ = c.Conn().Write(wctx, websocket.MessageText, body)
}

// channelAllowed enforces per-channel naming convention to keep clients
// from subscribing to arbitrary keys.
func channelAllowed(name string) bool {
	if len(name) > 128 {
		return false
	}
	prefixes := []string{
		"verdicts:user:",
		"contests:",
		"problems:",
		"global",
	}
	for _, p := range prefixes {
		if name == p || strings.HasPrefix(name, p) {
			return true
		}
	}
	return false
}

// clientIP returns the best-effort source address. We honour
// X-Forwarded-For when set (front proxy must be trusted by deployment)
// and otherwise fall back to RemoteAddr stripped of its port.
func clientIP(r *http.Request) string {
	if xf := r.Header.Get("X-Forwarded-For"); xf != "" {
		// First entry is the original client per RFC 7239 convention.
		if i := strings.Index(xf, ","); i > 0 {
			return strings.TrimSpace(xf[:i])
		}
		return strings.TrimSpace(xf)
	}
	addr := r.RemoteAddr
	if i := strings.LastIndex(addr, ":"); i > 0 {
		return addr[:i]
	}
	return addr
}

// reasonLabel maps the limiter's free-form rejection string to a small
// fixed cardinality label suitable for prometheus.
func reasonLabel(reason string) string {
	switch {
	case strings.Contains(reason, "per-user"):
		return "per_user"
	case strings.Contains(reason, "per-ip"):
		return "per_ip"
	default:
		return "other"
	}
}
