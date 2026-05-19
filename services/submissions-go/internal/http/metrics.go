package http

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	requestCounter = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "leetrank_submissions_requests_total",
			Help: "Total HTTP requests handled by leetrank-submissions-go.",
		},
		[]string{"method", "status"},
	)
	requestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "leetrank_submissions_request_duration_seconds",
			Help:    "Request latency in seconds.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method"},
	)
)

func init() {
	prometheus.MustRegister(requestCounter, requestDuration)
}

// Metrics increments the Prometheus counters per request.
func Metrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		requestCounter.WithLabelValues(r.Method, strconv.Itoa(rec.status)).Inc()
		requestDuration.WithLabelValues(r.Method).Observe(time.Since(start).Seconds())
	})
}

// PrometheusHandler returns the /metrics handler.
func PrometheusHandler() http.HandlerFunc {
	h := promhttp.Handler()
	return func(w http.ResponseWriter, r *http.Request) {
		h.ServeHTTP(w, r)
	}
}
