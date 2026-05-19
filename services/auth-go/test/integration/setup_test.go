//go:build integration

// Package integration_test runs end-to-end tests against a real
// Postgres + auth-go process. Postgres is spun up via testcontainers
// so the test is hermetic on any CI box with Docker.
//
// Run with:  go test -tags=integration ./test/integration/...
package integration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/auth"
	authdb "github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/db"
	"github.com/JasonTM17/Leetrank_Project/services/auth-go/internal/jwks"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

// withPostgres boots an ephemeral Postgres 16 container and returns a
// pool wired to it. The schema is created by hand (the auth handler
// only needs the User and RefreshToken tables).
func withPostgres(t *testing.T) *pgxpool.Pool {
	t.Helper()
	ctx := context.Background()

	req := testcontainers.ContainerRequest{
		Image:        "public.ecr.aws/docker/library/postgres:16-alpine",
		ExposedPorts: []string{"5432/tcp"},
		Env: map[string]string{
			"POSTGRES_PASSWORD": "test",
			"POSTGRES_USER":     "test",
			"POSTGRES_DB":       "test",
		},
		WaitingFor: wait.ForListeningPort("5432/tcp").WithStartupTimeout(60 * time.Second),
	}
	pg, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		t.Skipf("testcontainers unavailable in this environment: %v", err)
	}
	t.Cleanup(func() { _ = pg.Terminate(ctx) })

	host, _ := pg.Host(ctx)
	port, _ := pg.MappedPort(ctx, "5432")
	dsn := fmt.Sprintf("postgres://test:test@%s:%s/test?sslmode=disable", host, port.Port())
	_ = os.Setenv("DATABASE_URL", dsn)

	pool, err := authdb.New(ctx, dsn)
	if err != nil {
		t.Fatalf("authdb.New: %v", err)
	}
	t.Cleanup(pool.Close)

	if _, err := pool.Exec(ctx, userTable); err != nil {
		t.Fatalf("create User: %v", err)
	}
	return pool
}

const userTable = `
CREATE TABLE IF NOT EXISTS "User" (
    id          TEXT        PRIMARY KEY,
    email       TEXT        NOT NULL UNIQUE,
    username    TEXT        NOT NULL UNIQUE,
    password    TEXT        NOT NULL,
    role        TEXT        NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

// buildServer wires the auth router on top of a freshly-generated
// Ed25519 keystore so each test gets a clean signing key.
func buildServer(t *testing.T, pool *pgxpool.Pool) (http.Handler, *jwks.KeyStore) {
	t.Helper()
	ks, err := jwks.New("", pool)
	if err != nil {
		t.Fatalf("jwks.New: %v", err)
	}
	r := chi.NewRouter()
	r.Mount("/v1/auth", auth.Router(pool, ks))
	r.Get("/.well-known/jwks.json", ks.JWKSHandler)
	return r, ks
}

// post is a tiny HTTP helper for POST + JSON.
func post(t *testing.T, srv *httptest.Server, path string, body any, cookies ...*http.Cookie) *http.Response {
	t.Helper()
	buf, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, srv.URL+path, bytes.NewReader(buf))
	req.Header.Set("Content-Type", "application/json")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("POST %s: %v", path, err)
	}
	return resp
}

// get is the GET equivalent.
func get(t *testing.T, srv *httptest.Server, path string, cookies ...*http.Cookie) *http.Response {
	t.Helper()
	req, _ := http.NewRequest(http.MethodGet, srv.URL+path, nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	resp, err := srv.Client().Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", path, err)
	}
	return resp
}
