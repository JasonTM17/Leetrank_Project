package observability

import (
	"context"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
)

// InitTracer wires the OpenTelemetry SDK against an OTLP collector.
func InitTracer(ctx context.Context, service, endpoint, version string) (func(context.Context) error, error) {
	if strings.TrimSpace(endpoint) == "" {
		otel.SetTracerProvider(sdktrace.NewTracerProvider())
		otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
			propagation.TraceContext{}, propagation.Baggage{}))
		return func(context.Context) error { return nil }, nil
	}
	exporter, err := buildExporter(ctx, endpoint)
	if err != nil {
		return nil, err
	}
	res, err := resource.Merge(resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceNameKey.String(service),
			semconv.ServiceVersionKey.String(version),
			attribute.String("deployment.environment", deploymentEnv()),
		),
	)
	if err != nil {
		return nil, err
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter,
			sdktrace.WithMaxExportBatchSize(256),
			sdktrace.WithBatchTimeout(2*time.Second)),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.ParentBased(sdktrace.AlwaysSample())),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{}, propagation.Baggage{}))
	return tp.Shutdown, nil
}

func buildExporter(ctx context.Context, endpoint string) (sdktrace.SpanExporter, error) {
	switch {
	case strings.HasPrefix(endpoint, "http://"):
		host := strings.TrimPrefix(endpoint, "http://")
		return otlptrace.New(ctx, otlptracehttp.NewClient(
			otlptracehttp.WithEndpoint(host),
			otlptracehttp.WithInsecure(),
		))
	case strings.HasPrefix(endpoint, "https://"):
		host := strings.TrimPrefix(endpoint, "https://")
		return otlptrace.New(ctx, otlptracehttp.NewClient(otlptracehttp.WithEndpoint(host)))
	case strings.HasPrefix(endpoint, "grpc://"):
		host := strings.TrimPrefix(endpoint, "grpc://")
		return otlptrace.New(ctx, otlptracegrpc.NewClient(
			otlptracegrpc.WithEndpoint(host),
			otlptracegrpc.WithInsecure(),
		))
	case endpoint == "":
		return nil, errors.New("observability: empty OTLP endpoint")
	default:
		return otlptrace.New(ctx, otlptracegrpc.NewClient(
			otlptracegrpc.WithEndpoint(endpoint),
			otlptracegrpc.WithInsecure(),
		))
	}
}

// OtelMiddleware wraps the next handler in otelhttp's per-request span.
func OtelMiddleware(service string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return otelhttp.NewHandler(next, service,
			otelhttp.WithSpanNameFormatter(func(_ string, r *http.Request) string {
				return r.Method + " " + r.URL.Path
			}),
		)
	}
}

func deploymentEnv() string {
	if v := strings.TrimSpace(os.Getenv("DEPLOY_ENV")); v != "" {
		return v
	}
	if v := strings.TrimSpace(os.Getenv("NODE_ENV")); v != "" {
		return v
	}
	return "development"
}
