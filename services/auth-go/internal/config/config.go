// Package config holds the runtime configuration loaded from environment
// variables. Fail fast on missing required values so a misconfigured
// container exits with a clear error instead of crashing on first
// request.
package config

import (
	"errors"
	"fmt"
	"os"
)

type Config struct {
	DatabaseURL      string
	Port             string
	JWTSecret        string // legacy HS256 fallback (unused once Ed25519 lands)
	JWTPrivateKeyPEM string // PKCS#8 Ed25519 PEM; empty triggers boot-time generation
	CORSOrigins      string
	LogLevel         string
	LogPretty        bool
	OTLPEndpoint     string
}

const (
	minSecretLen = 16
	defaultPort  = "4011"
)

func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		Port:             envOr("AUTH_PORT", defaultPort),
		JWTSecret:        os.Getenv("JWT_SECRET"),
		JWTPrivateKeyPEM: os.Getenv("JWT_PRIVATE_KEY_PEM"),
		CORSOrigins:      os.Getenv("CORS_ALLOWED_ORIGINS"),
		LogLevel:         envOr("LOG_LEVEL", "info"),
		LogPretty:        os.Getenv("LOG_PRETTY") == "1",
		OTLPEndpoint:     os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"),
	}

	var errs []error
	if cfg.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL is required"))
	}
	// JWT_SECRET is legacy — only validated when set. Ed25519 takes
	// over signing automatically.
	if cfg.JWTSecret != "" && len(cfg.JWTSecret) < minSecretLen {
		errs = append(errs, fmt.Errorf("JWT_SECRET must be %d+ characters when set", minSecretLen))
	}
	if len(errs) > 0 {
		return nil, errors.Join(errs...)
	}
	return cfg, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
