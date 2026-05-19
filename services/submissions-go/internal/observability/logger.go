// Package observability wires the cross-cutting telemetry plumbing
// shared by every Go service: zerolog for structured logging, the
// OpenTelemetry SDK for distributed tracing, and the otelhttp
// middleware for incoming-span propagation.
package observability

import (
	"context"
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"go.opentelemetry.io/otel/trace"
)

// NewLogger returns a service-tagged zerolog logger. JSON in
// production; pretty (color) when LOG_PRETTY=1.
func NewLogger(service, level string, pretty bool) zerolog.Logger {
	zerolog.TimeFieldFormat = time.RFC3339Nano
	lvl := parseLevel(level)
	zerolog.SetGlobalLevel(lvl)

	var out = zerolog.New(os.Stdout)
	if pretty {
		out = zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339})
	}
	return out.With().
		Timestamp().
		Str("service", service).
		Logger().
		Level(lvl)
}

func parseLevel(s string) zerolog.Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "trace":
		return zerolog.TraceLevel
	case "debug":
		return zerolog.DebugLevel
	case "warn", "warning":
		return zerolog.WarnLevel
	case "error":
		return zerolog.ErrorLevel
	case "fatal":
		return zerolog.FatalLevel
	case "panic":
		return zerolog.PanicLevel
	default:
		return zerolog.InfoLevel
	}
}

// WithRequestID returns a child logger annotated with the request id.
func WithRequestID(parent zerolog.Logger, requestID string) zerolog.Logger {
	if requestID == "" {
		return parent
	}
	return parent.With().Str("request_id", requestID).Logger()
}

// LoggerFromContext returns a logger annotated with the trace id when
// a span is active.
func LoggerFromContext(ctx context.Context, parent zerolog.Logger) zerolog.Logger {
	tid := TraceIDFromContext(ctx)
	if tid == "" {
		return parent
	}
	return parent.With().Str("trace_id", tid).Logger()
}

// TraceIDFromContext returns the active trace id (hex) or "" if no
// span is active.
func TraceIDFromContext(ctx context.Context) string {
	span := trace.SpanFromContext(ctx)
	if !span.SpanContext().IsValid() {
		return ""
	}
	return span.SpanContext().TraceID().String()
}
