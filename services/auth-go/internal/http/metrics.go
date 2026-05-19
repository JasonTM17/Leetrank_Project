package http

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Standardised RED metrics — same names across every Go service so a
// single Grafana dashboard can render the whole platform.
var (
	requestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total HTTP requests, by service/method/route/status.",
		},
		[]string{"service", "method", "route", "status"},
	)
	requestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "End-to-end HTTP latency in seconds.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"service", "method", "route", "status"},
	)
	inflightGauge = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "http_inflight_requests",
			Help: "Currently in-flight HTTP requests.",
		},
		[]string{"service"},
	)
)

func init() {
	prometheus.MustRegister(requestsTotal, requestDuration, inflightGauge)
}

// Metrics returns a chi-friendly middleware that records counter,
// histogram, and inflight metrics under the given service label.
func Metrics(service string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			inflightGauge.WithLabelValues(service).Inc()
			defer inflightGauge.WithLabelValues(service).Dec()
			next.ServeHTTP(rec, r)
			route := r.URL.Path
			if rc := chi.RouteContext(r.Context()); rc != nil && rc.RoutePattern() != "" {
				route = rc.RoutePattern()
			}
			status := strconv.Itoa(rec.status)
			requestsTotal.WithLabelValues(service, r.Method, route, status).Inc()
			requestDuration.WithLabelValues(service, r.Method, route, status).
				Observe(time.Since(start).Seconds())
		})
	}
}

// PrometheusHandler returns the /metrics handler.
func PrometheusHandler() http.HandlerFunc {
	h := promhttp.Handler()
	return func(w http.ResponseWriter, r *http.Request) {
		h.ServeHTTP(w, r)
	}
}
