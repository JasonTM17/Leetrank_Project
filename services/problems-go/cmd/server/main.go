// Package main boots the leetrank-problems-go HTTP server.
//
// Mirrors services/auth-go/cmd/server/main.go: env validation, structured
// slog, request-id + access log middleware, /healthz + /readyz + /metrics
// + /v1/problems/* + /v1/leaderboard/* + /v1/stats. Graceful shutdown on
// SIGINT/SIGTERM with a 15s drain.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/JasonTM17/Leetrank_Project/services/problems-go/internal/config"
	"github.com/JasonTM17/Leetrank_Project/services/problems-go/internal/db"
	httpx "github.com/JasonTM17/Leetrank_Project/services/problems-go/internal/http"
	"github.com/JasonTM17/Leetrank_Project/services/problems-go/internal/problems"
	"github.com/JasonTM17/Leetrank_Project/services/problems-go/internal/version"
	"github.com/go-chi/chi/v5"
)

func main() {
	healthcheck := flag.Bool("healthcheck", false, "Probe local /healthz and exit (used by docker HEALTHCHECK on distroless).")
	flag.Parse()

	if *healthcheck {
		port := os.Getenv("PROBLEMS_PORT")
		if port == "" {
			port = "4013"
		}
		client := http.Client{Timeout: 3 * time.Second}
		resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%s/healthz", port))
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg, err := config.Load()
	if err != nil {
		logger.Error("config: load failed", "err", err)
		os.Exit(1)
	}

	pool, err := db.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		logger.Error("db: connect failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()

	h := problems.New(pool)

	r := chi.NewRouter()
	r.Use(httpx.RequestID)
	r.Use(httpx.AccessLog(logger))
	r.Use(httpx.Recover(logger))
	r.Use(httpx.Timeout(15 * time.Second))
	r.Use(httpx.Metrics)

	r.Get("/", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]string{
			"service": "leetrank-problems-go",
			"version": version.Version,
		})
	})
	r.Get("/healthz", httpx.Liveness)
	r.Get("/readyz", httpx.Readiness(pool))
	r.Get("/metrics", httpx.PrometheusHandler())
	r.Mount("/v1/problems", h.Router())
	r.Mount("/v1/leaderboard", h.LeaderboardRouter())
	r.Get("/v1/stats", h.Stats)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		logger.Info("leetrank-problems-go started", "port", cfg.Port, "version", version.Version)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("http: serve failed", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	logger.Info("shutdown: drain begin")
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("shutdown: forced", "err", err)
	}
	logger.Info("shutdown: complete")
}
