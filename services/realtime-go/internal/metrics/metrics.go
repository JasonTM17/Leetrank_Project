// Package metrics holds Prometheus metrics for realtime-go.
package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	WSConnections = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "realtime_ws_connections",
		Help: "Open websocket connections",
	})
	WSMessagesOut = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "realtime_ws_messages_out_total",
		Help: "Messages fanned out to websocket clients",
	}, []string{"channel"})
	WSMessagesDropped = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "realtime_ws_messages_dropped_total",
		Help: "Messages dropped because client send buffer full",
	}, []string{"channel"})
	HTTPRequests = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "realtime_http_requests_total",
		Help: "HTTP requests",
	}, []string{"route", "status"})
)
