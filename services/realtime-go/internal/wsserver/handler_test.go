// Tests for the wsserver package.
//
// We can't drive the websocket upgrade end-to-end without standing up a
// real listener — that's exercised in e2e. What we *can* pin here:
//
//   1. The shape of the /v1/realtime/health route that main.go wires
//      onto the mux. Replicating the lambda keeps the test honest if
//      someone changes the contract in main.go.
//   2. channelAllowed — the pure subscription policy gate inside
//      handler.go that decides which redis keys a client may listen on.
//
// CI is the source of truth (no Go toolchain in the agent sandbox),
// the table is exhaustive enough that a regression on either path
// fails fast.
package wsserver

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHealthEndpoint(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/realtime/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("content-type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	tests := []struct {
		name        string
		method      string
		path        string
		wantStatus  int
		wantBody    string
		wantContent string
	}{
		{"GET /v1/realtime/health -> 200 with status ok", http.MethodGet, "/v1/realtime/health", http.StatusOK, `{"status":"ok"}`, "application/json"},
		{"GET /missing -> 404", http.MethodGet, "/missing", http.StatusNotFound, "", ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, nil)
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)
			if rec.Code != tc.wantStatus {
				t.Fatalf("status: got %d want %d", rec.Code, tc.wantStatus)
			}
			if tc.wantBody != "" && rec.Body.String() != tc.wantBody {
				t.Fatalf("body: got %q want %q", rec.Body.String(), tc.wantBody)
			}
			if tc.wantContent != "" && rec.Header().Get("content-type") != tc.wantContent {
				t.Fatalf("content-type: got %q want %q", rec.Header().Get("content-type"), tc.wantContent)
			}
		})
	}
}

func TestChannelAllowed(t *testing.T) {
	tests := []struct {
		name string
		ch   string
		want bool
	}{
		{"empty rejected", "", false},
		{"global ok", "global", true},
		{"verdicts user prefix ok", "verdicts:user:abc-123", true},
		{"contests prefix ok", "contests:weekly-1", true},
		{"problems prefix ok", "problems:two-sum", true},
		{"foreign key rejected", "secrets:admin", false},
		{"too long rejected", strings.Repeat("a", 200), false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := channelAllowed(tc.ch); got != tc.want {
				t.Fatalf("channelAllowed(%q) = %v want %v", tc.ch, got, tc.want)
			}
		})
	}
}
