// Package config loads env-driven settings for realtime-go.
package config

import (
	"errors"
	"os"
	"strings"
)

type Config struct {
	Port        string
	RedisURL    string
	JWTSecret   string
	AllowOrigin []string
}

func Load() (*Config, error) {
	port := os.Getenv("REALTIME_PORT")
	if port == "" {
		port = "4017"
	}
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}
	jwt := os.Getenv("JWT_SECRET")
	if jwt == "" {
		return nil, errors.New("JWT_SECRET is required")
	}
	originsRaw := os.Getenv("CORS_ALLOWED_ORIGINS")
	if originsRaw == "" {
		originsRaw = "http://localhost:3000"
	}
	origins := []string{}
	for _, o := range strings.Split(originsRaw, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			origins = append(origins, o)
		}
	}
	return &Config{
		Port:        port,
		RedisURL:    redisURL,
		JWTSecret:   jwt,
		AllowOrigin: origins,
	}, nil
}
