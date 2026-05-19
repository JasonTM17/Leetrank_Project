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
	}()

	go h.writeLoop(ctx, client)
	h.readLoop(ctx, client)
}

func (h *Handler) readLoop(ctx context.Context, c *hub.Client) {
	pingTicker := time.NewTicker(hub.PingInterval)
	defer pingTicker.Stop()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-pingTicker.C:
				pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
				err := c.Conn().Ping(pingCtx)
				cancel()
				if err != nil {
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
