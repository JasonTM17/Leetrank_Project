// Package hub maintains websocket clients subscribed to channels and
// fans out messages from a redis pubsub.
package hub

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/JasonTM17/Leetrank_Project/services/realtime-go/internal/metrics"
	"github.com/redis/go-redis/v9"
	"nhooyr.io/websocket"
)

const (
	ClientSendBuffer = 64
	WriteWait        = 10 * time.Second
	PingInterval     = 25 * time.Second
)

// Client is one active websocket connection.
type Client struct {
	id       string
	conn     *websocket.Conn
	channels map[string]struct{}
	send     chan Message
	closed   chan struct{}
}

// Message published on a channel.
type Message struct {
	Channel string
	Payload []byte
}

type Hub struct {
	mu       sync.RWMutex
	clients  map[*Client]struct{}
	bySub    map[string]map[*Client]struct{} // channel -> clients
	rdb      *redis.Client
	logger   *slog.Logger
	pubsub   *redis.PubSub
	cancelFn context.CancelFunc
}

func New(rdb *redis.Client, logger *slog.Logger) *Hub {
	return &Hub{
		clients: make(map[*Client]struct{}),
		bySub:   make(map[string]map[*Client]struct{}),
		rdb:     rdb,
		logger:  logger,
	}
}

// Run starts the redis pubsub fanout loop.
func (h *Hub) Run(parent context.Context, channels []string) error {
	ctx, cancel := context.WithCancel(parent)
	h.cancelFn = cancel

	h.pubsub = h.rdb.PSubscribe(ctx, channels...)
	if _, err := h.pubsub.Receive(ctx); err != nil {
		return err
	}
	go h.consume(ctx)
	return nil
}

func (h *Hub) Close() {
	if h.cancelFn != nil {
		h.cancelFn()
	}
	if h.pubsub != nil {
		_ = h.pubsub.Close()
	}
}

func (h *Hub) consume(ctx context.Context) {
	ch := h.pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			h.fanout(msg.Channel, []byte(msg.Payload))
		}
	}
}

func (h *Hub) fanout(channel string, payload []byte) {
	h.mu.RLock()
	subs := h.bySub[channel]
	clients := make([]*Client, 0, len(subs))
	for c := range subs {
		clients = append(clients, c)
	}
	h.mu.RUnlock()

	m := Message{Channel: channel, Payload: payload}
	for _, c := range clients {
		select {
		case c.send <- m:
			metrics.WSMessagesOut.WithLabelValues(channel).Inc()
		default:
			metrics.WSMessagesDropped.WithLabelValues(channel).Inc()
		}
	}
}

// Add registers a client for a set of channels.
func (h *Hub) Add(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = struct{}{}
	for ch := range c.channels {
		if _, ok := h.bySub[ch]; !ok {
			h.bySub[ch] = make(map[*Client]struct{})
		}
		h.bySub[ch][c] = struct{}{}
	}
	metrics.WSConnections.Set(float64(len(h.clients)))
}

// Remove unregisters a client.
func (h *Hub) Remove(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, c)
	for ch := range c.channels {
		if subs, ok := h.bySub[ch]; ok {
			delete(subs, c)
			if len(subs) == 0 {
				delete(h.bySub, ch)
			}
		}
	}
	metrics.WSConnections.Set(float64(len(h.clients)))
}

// Subscribe adds a channel to an existing client.
func (h *Hub) Subscribe(c *Client, ch string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	c.channels[ch] = struct{}{}
	if _, ok := h.bySub[ch]; !ok {
		h.bySub[ch] = make(map[*Client]struct{})
	}
	h.bySub[ch][c] = struct{}{}
}

// Unsubscribe removes a channel from a client.
func (h *Hub) Unsubscribe(c *Client, ch string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(c.channels, ch)
	if subs, ok := h.bySub[ch]; ok {
		delete(subs, c)
		if len(subs) == 0 {
			delete(h.bySub, ch)
		}
	}
}

func NewClient(id string, conn *websocket.Conn, initial []string) *Client {
	channels := make(map[string]struct{}, len(initial))
	for _, c := range initial {
		channels[c] = struct{}{}
	}
	return &Client{
		id:       id,
		conn:     conn,
		channels: channels,
		send:     make(chan Message, ClientSendBuffer),
		closed:   make(chan struct{}),
	}
}

func (c *Client) ID() string                 { return c.id }
func (c *Client) Conn() *websocket.Conn      { return c.conn }
func (c *Client) Send() chan<- Message       { return c.send }
func (c *Client) Recv() <-chan Message       { return c.send }
func (c *Client) Channels() map[string]struct{} {
	out := make(map[string]struct{}, len(c.channels))
	for k := range c.channels {
		out[k] = struct{}{}
	}
	return out
}
