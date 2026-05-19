// Package main boots the leetrank-auth-go HTTP server.
//
// Mirrors apps/auth/src/server.ts: env validation, structured slog,
// request-id + access log middleware, /healthz + /readyz + /metrics
// + /jwks + /v1/auth/* (501 stubs). Graceful shutdown on SIGINT/SIGTERM
// with a 15s drain.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/auth"
	"github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/config"
	"github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/db"
	httpx "github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/http"
	"github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/jwks"
	"github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/observability"
	"github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/version"
	"github.com/go-chi/chi/v5"
)

func main() {
	healthcheck := flag.Bool("healthcheck", false, "Probe local /healthz and exit (used by docker HEALTHCHECK on distroless).")
	flag.Parse()

	if *healthcheck {
		port := os.Getenv("AUTH_PORT")
		if port == "" {
			port = "4011"
		}
		client := http.Client{Timeout: 3 * time.Second}
		resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%s/healthz", port))
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}

	logger := observability.NewLogger("leetrank-auth-go", os.Getenv("LOG_LEVEL"), os.Getenv("LOG_PRETTY") == "1")

	cfg, err := config.Load()
	if err != nil {
		logger.Error().Err(err).Msg("config: load failed")
		os.Exit(1)
	}

	pool, err := db.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		logger.Error().Err(err).Msg("db: connect failed")
		os.Exit(1)
	}
	defer pool.Close()

	keystore, err := jwks.New(cfg.JWTPrivateKeyPEM, pool)
	if err != nil {
		logger.Error().Err(err).Msg("jwks: init failed")
		os.Exit(1)
	}

	shutdownTracer, err := observability.InitTracer(context.Background(), "leetrank-auth-go", cfg.OTLPEndpoint, version.Version)
	if err != nil {
		logger.Warn().Err(err).Msg("otel: tracer disabled")
	}
	defer func() {
		if shutdownTracer != nil {
			_ = shutdownTracer(context.Background())
		}
	}()

	r := chi.NewRouter()
	r.Use(httpx.RequestID)
	r.Use(httpx.AccessLog(logger))
	r.Use(httpx.Recover(logger))
	r.Use(httpx.Timeout(15 * time.Second))
	r.Use(httpx.Metrics("auth-go"))
	r.Use(observability.OtelMiddleware("leetrank-auth-go"))

	r.Get("/", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{
			"service": "leetrank-auth-go",
			"version": version.Version,
		})
	})
	r.Get("/healthz", httpx.Liveness)
	r.Get("/readyz", httpx.Readiness(pool))
	r.Get("/metrics", httpx.PrometheusHandler())
	r.Get("/jwks", keystore.JWKSHandler)
	r.Get("/.well-known/jwks.json", keystore.JWKSHandler)
	r.Mount("/v1/auth", auth.Router(pool, keystore))

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		logger.Info().Str("port", cfg.Port).Str("version", version.Version).Msg("leetrank-auth-go started")
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error().Err(err).Msg("http: serve failed")
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	logger.Info().Msg("shutdown: drain begin")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error().Err(err).Msg("shutdown: forced")
	}
	logger.Info().Msg("shutdown: complete")
}
