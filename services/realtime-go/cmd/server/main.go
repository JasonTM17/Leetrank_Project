// Package main boots realtime-go: HTTP + websocket fan-out from redis pubsub.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/JasonTM17/Leetrank_Project/services/realtime-go/internal/config"
	"github.com/JasonTM17/Leetrank_Project/services/realtime-go/internal/hub"
	"github.com/JasonTM17/Leetrank_Project/services/realtime-go/internal/metrics"
	"github.com/JasonTM17/Leetrank_Project/services/realtime-go/internal/version"
	"github.com/JasonTM17/Leetrank_Project/services/realtime-go/internal/wsserver"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
)

func main() {
	healthcheck := flag.Bool("healthcheck", false, "probe local /healthz and exit (used by docker HEALTHCHECK on distroless)")
	flag.Parse()

	if *healthcheck {
		port := os.Getenv("REALTIME_PORT")
		if port == "" {
			port = "4017"
		}
		conn, err := net.DialTimeout("tcp", "127.0.0.1:"+port, 2*time.Second)
		if err != nil {
			os.Exit(1)
		}
		_ = conn.Close()
		client := http.Client{Timeout: 3 * time.Second}
		resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%s/v1/realtime/health", port))
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

	rOpts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		logger.Error("redis: parse url", "err", err)
		os.Exit(1)
	}
	rdb := redis.NewClient(rOpts)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		logger.Error("redis: ping failed", "err", err)
		os.Exit(1)
	}

	h := hub.New(rdb, logger)
	if err := h.Run(context.Background(), []string{"verdicts:*", "contests:*", "problems:*", "global"}); err != nil {
		logger.Error("hub: subscribe failed", "err", err)
		os.Exit(1)
	}
	defer h.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"service": "leetrank-realtime-go",
			"version": version.Version,
		})
	})
	mux.HandleFunc("/v1/realtime/health", func(w http.ResponseWriter, _ *http.Request) {
		metrics.HTTPRequests.WithLabelValues("/v1/realtime/health", "200").Inc()
		w.Header().Set("content-type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("/v1/realtime/readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := rdb.Ping(ctx).Err(); err != nil {
			metrics.HTTPRequests.WithLabelValues("/v1/realtime/readyz", "503").Inc()
			http.Error(w, `{"status":"unready"}`, http.StatusServiceUnavailable)
			return
		}
		metrics.HTTPRequests.WithLabelValues("/v1/realtime/readyz", "200").Inc()
		w.Header().Set("content-type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ready"}`))
	})
	mux.Handle("/v1/realtime/metrics", promhttp.Handler())

	wsh := &wsserver.Handler{
		Hub:          h,
		Logger:       logger,
		JWTSecret:    cfg.JWTSecret,
		AllowOrigins: cfg.AllowOrigin,
	}
	mux.HandleFunc("/v1/realtime", wsh.ServeWS)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		logger.Info("leetrank-realtime-go started", "port", cfg.Port, "version", version.Version)
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
	_ = rdb.Close()
	logger.Info("shutdown: complete")
}
