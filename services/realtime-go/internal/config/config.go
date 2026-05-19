// Package config loads env-driven settings for realtime-go.
package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port              string
	RedisURL          string
	JWTSecret         string
	AllowOrigin       []string
	MaxConnsPerUser   int
	MaxConnsPerIP     int
	ShutdownDrainSecs int
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
		Port:              port,
		RedisURL:          redisURL,
		JWTSecret:         jwt,
		AllowOrigin:       origins,
		MaxConnsPerUser:   atoiOrDefault(os.Getenv("REALTIME_MAX_CONNS_PER_USER"), 5),
		MaxConnsPerIP:     atoiOrDefault(os.Getenv("REALTIME_MAX_CONNS_PER_IP"), 50),
		ShutdownDrainSecs: atoiOrDefault(os.Getenv("REALTIME_SHUTDOWN_DRAIN_SECS"), 10),
	}, nil
}

func atoiOrDefault(s string, def int) int {
	if s == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil || v <= 0 {
		return def
	}
	return v
}
