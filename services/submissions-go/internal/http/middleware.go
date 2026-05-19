// Package http holds the chi-friendly middleware shared by every endpoint:
// request-id propagation, structured zerolog access logs, panic recovery,
// per-request timeout, and helpers used by the metrics and tracing
// middleware.
package http

import (
	"context"
	"encoding/json"
	"net/http"
	"runtime/debug"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type ctxKey string

const requestIDKey ctxKey = "request_id"

// RequestID generates a per-request UUID and propagates it via X-Request-ID.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			id = uuid.NewString()
		}
		w.Header().Set("X-Request-ID", id)
		ctx := context.WithValue(r.Context(), requestIDKey, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequestIDFrom pulls the request id out of a request-scoped context.
func RequestIDFrom(ctx context.Context) string {
	if v, ok := ctx.Value(requestIDKey).(string); ok {
		return v
	}
	return ""
}

// AccessLog emits one structured zerolog line per request.
func AccessLog(logger zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)
			route := r.URL.Path
			if rc := chi.RouteContext(r.Context()); rc != nil && rc.RoutePattern() != "" {
				route = rc.RoutePattern()
			}
			logger.Info().
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Str("route", route).
				Int("status", rec.status).
				Int64("duration_ms", time.Since(start).Milliseconds()).
				Str("request_id", RequestIDFrom(r.Context())).
				Str("remote", clientIP(r)).
				Msg("http_request")
		})
	}
}

// Recover catches handler panics, logs the stack, and returns a 500.
func Recover(logger zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					logger.Error().
						Interface("err", rec).
						Bytes("stack", debug.Stack()).
						Str("request_id", RequestIDFrom(r.Context())).
						Msg("panic")
					JSON(w, http.StatusInternalServerError, map[string]string{"error": "Internal server error"})
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// Timeout wraps the request context with a deadline.
func Timeout(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), d)
			defer cancel()
			done := make(chan struct{})
			go func() {
				next.ServeHTTP(w, r.WithContext(ctx))
				close(done)
			}()
			select {
			case <-done:
				return
			case <-ctx.Done():
				if ctx.Err() == context.DeadlineExceeded {
					JSON(w, http.StatusGatewayTimeout, map[string]string{"error": "Request timed out"})
				}
			}
		})
	}
}

// JSON writes a JSON response with proper Content-Length / Content-Type.
func JSON(w http.ResponseWriter, status int, body any) {
	buf, err := json.Marshal(body)
	if err != nil {
		http.Error(w, "encode failure", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(buf)))
	w.WriteHeader(status)
	_, _ = w.Write(buf)
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Status() int { return s.status }

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		for i := 0; i < len(xff); i++ {
			if xff[i] == ',' {
				return xff[:i]
			}
		}
		return xff
	}
	return r.RemoteAddr
}
