// Package main boots the leetrank-submissions-go HTTP server.
//
// Mirrors services/auth-go/cmd/server/main.go: env validation, structured
// slog, request-id + access log middleware, /healthz + /readyz + /metrics
// + /v1/submissions/*. Graceful shutdown on SIGINT/SIGTERM with a 15s drain.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/JasonTM17/Leetrank_Project/services/submissions-go/internal/config"
	"github.com/JasonTM17/Leetrank_Project/services/submissions-go/internal/db"
	httpx "github.com/JasonTM17/Leetrank_Project/services/submissions-go/internal/http"
	"github.com/JasonTM17/Leetrank_Project/services/submissions-go/internal/observability"
	"github.com/JasonTM17/Leetrank_Project/services/submissions-go/internal/queue"
	"github.com/JasonTM17/Leetrank_Project/services/submissions-go/internal/submissions"
	"github.com/JasonTM17/Leetrank_Project/services/submissions-go/internal/version"
	"github.com/go-chi/chi/v5"
)

func main() {
	healthcheck := flag.Bool("healthcheck", false, "Probe local /healthz and exit (used by docker HEALTHCHECK on distroless).")
	flag.Parse()

	if *healthcheck {
		port := os.Getenv("SUBMISSIONS_PORT")
		if port == "" {
			port = "4012"
		}
		client := http.Client{Timeout: 3 * time.Second}
		resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%s/healthz", port))
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}

	logger := observability.NewLogger("leetrank-submissions-go", os.Getenv("LOG_LEVEL"), os.Getenv("LOG_PRETTY") == "1")

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

	shutdownTracer, err := observability.InitTracer(context.Background(), "leetrank-submissions-go", cfg.OTLPEndpoint, version.Version)
	if err != nil {
		logger.Warn().Err(err).Msg("otel: tracer disabled")
	}
	defer func() {
		if shutdownTracer != nil {
			_ = shutdownTracer(context.Background())
		}
	}()

	h := submissions.New(pool)

	r := chi.NewRouter()
	r.Use(httpx.RequestID)
	r.Use(httpx.AccessLog(logger))
	r.Use(httpx.Recover(logger))
	r.Use(httpx.Timeout(15 * time.Second))
	r.Use(httpx.Metrics("submissions-go"))
	r.Use(observability.OtelMiddleware("leetrank-submissions-go"))

	r.Get("/", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{
			"service": "leetrank-submissions-go",
			"version": version.Version,
		})
	})
	// Readiness flag flipped to false on SIGTERM so load balancers stop
	// sending new traffic during the lameDuckDelay drain window (ADR 0029).
	var ready atomic.Bool
	ready.Store(true)
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if !ready.Load() {
			http.Error(w, "draining", http.StatusServiceUnavailable)
			return
		}
		httpx.Liveness(w, r)
	})
	r.Get("/readyz", httpx.Readiness(pool))
	r.Get("/metrics", httpx.PrometheusHandler())
	r.Mount("/v1/submissions", h.Router())

	// Background sweeper: refreshes the queue-depth gauge and moves
	// 'judging' rows older than 60s to status='failed' with reason
	// 'judge_timeout'. Stops when sweeperCtx is cancelled below.
	sweeperCtx, sweeperCancel := context.WithCancel(context.Background())
	defer sweeperCancel()
	sweeper := queue.New(pool, logger)
	go sweeper.Run(sweeperCtx)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		logger.Info().Str("port", cfg.Port).Str("version", version.Version).Msg("leetrank-submissions-go started")
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error().Err(err).Msg("http: serve failed")
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	// lameDuckDelay: flip readiness false, then sleep so upstream LBs/Caddy
	// stop routing traffic before we tear down in-flight handlers (ADR 0029).
	const lameDuckDelay = 3 * time.Second
	ready.Store(false)
	logger.Info().Dur("delay", lameDuckDelay).Msg("shutdown: lame-duck drain")
	time.Sleep(lameDuckDelay)

	logger.Info().Msg("shutdown: drain begin")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error().Err(err).Msg("shutdown: forced")
	}
	logger.Info().Msg("shutdown: complete")
}
