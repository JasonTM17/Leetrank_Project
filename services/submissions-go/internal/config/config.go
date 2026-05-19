// Package config holds the runtime configuration loaded from environment
// variables. Fail fast on missing required values so a misconfigured
// container exits with a clear error instead of crashing on first request.
package config

import (
	"errors"
	"os"
)

type Config struct {
	DatabaseURL string
	Port        string
	JWTSecret   string
	CORSOrigins string
	LogLevel    string
}

const defaultPort = "4012"

func Load() (*Config, error) {
	cfg := &Config{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		Port:        envOr("SUBMISSIONS_PORT", defaultPort),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		CORSOrigins: os.Getenv("CORS_ALLOWED_ORIGINS"),
		LogLevel:    envOr("LOG_LEVEL", "info"),
	}

	var errs []error
	if cfg.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL is required"))
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
