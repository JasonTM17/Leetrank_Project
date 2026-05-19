// Package jwks owns the signing keypair and JWKS export.
//
// The current implementation derives an HMAC key from JWT_SECRET so the
// Go service signs and verifies the same tokens as the TS apps/auth.
// Phase 3.1.5 swaps this for an Ed25519 keypair persisted to disk and
// rotated via a two-slot keychain (per ADR 0013).
package jwks

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
)

type KeyStore struct {
	signer  jose.Signer
	secret  []byte
	jwksRaw []byte
}

func New(secret string) (*KeyStore, error) {
	key := []byte(secret)
	signer, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.HS256, Key: key},
		(&jose.SignerOptions{}).WithType("JWT"),
	)
	if err != nil {
		return nil, err
	}
	// Symmetric secret: an empty JWKS is the correct public answer.
	// Phase 3.1.5 will populate this with the Ed25519 public key.
	jwksRaw, _ := json.Marshal(map[string]any{"keys": []any{}})
	return &KeyStore{signer: signer, secret: key, jwksRaw: jwksRaw}, nil
}

type Claims struct {
	jwt.Claims
	Role string `json:"role"`
}

func (k *KeyStore) Sign(sub, role, audience string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		Claims: jwt.Claims{
			Subject:  sub,
			Audience: jwt.Audience{audience},
			Issuer:   "leetrank-auth",
			IssuedAt: jwt.NewNumericDate(now),
			Expiry:   jwt.NewNumericDate(now.Add(ttl)),
		},
		Role: role,
	}
	return jwt.Signed(k.signer).Claims(claims).Serialize()
}

func (k *KeyStore) Verify(token, expectedAudience string) (*Claims, error) {
	parsed, err := jwt.ParseSigned(token, []jose.SignatureAlgorithm{jose.HS256})
	if err != nil {
		return nil, err
	}
	out := &Claims{}
	if err := parsed.Claims(k.secret, out); err != nil {
		return nil, err
	}
	exp := jwt.Expected{Issuer: "leetrank-auth", AnyAudience: jwt.Audience{expectedAudience}}
	if err := out.Claims.Validate(exp); err != nil {
		return nil, err
	}
	return out, nil
}

func (k *KeyStore) JWKSHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(k.jwksRaw)
}
