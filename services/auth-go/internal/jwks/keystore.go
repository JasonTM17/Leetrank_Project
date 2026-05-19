// Package jwks owns the Ed25519 signing keypair, JWT issuance/verification,
// JWKS export, and the refresh-token rotation store.
//
// Phase 3.1.7: replaces the symmetric HS256 stub with EdDSA (Ed25519).
//
//   - The keypair is loaded from JWT_PRIVATE_KEY_PEM (PKCS#8 PEM) when
//     present, otherwise generated at boot. A SHA-256 of the public key
//     becomes the kid so callers can pick the right key from the JWKS.
//   - Access tokens are signed with EdDSA and live 15 minutes; refresh
//     tokens are random 256-bit values stored hashed in the RefreshToken
//     table and live 30 days.
//   - GET /.well-known/jwks.json exposes the public key as a JWK set so
//     other services can verify access tokens without sharing a secret.
package jwks

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// AccessTTL is the lifetime of an access token.
	AccessTTL = 15 * time.Minute
	// RefreshTTL is the lifetime of a refresh token.
	RefreshTTL = 30 * 24 * time.Hour
	// Issuer is the constant `iss` claim on every token.
	Issuer = "leetrank-auth"
)

// KeyStore signs and verifies tokens, exports the JWKS, and persists
// refresh tokens in Postgres.
type KeyStore struct {
	priv    ed25519.PrivateKey
	pub     ed25519.PublicKey
	kid     string
	signer  jose.Signer
	jwksRaw []byte
	pool    *pgxpool.Pool
}

// New builds a KeyStore. If pemEnv is non-empty it must be a PKCS#8
// Ed25519 private key in PEM form; otherwise a fresh keypair is
// generated. pool is used by the refresh-token rotation table; pass
// nil if you only need sign/verify.
func New(pemEnv string, pool *pgxpool.Pool) (*KeyStore, error) {
	priv, err := loadOrGenerate(pemEnv)
	if err != nil {
		return nil, err
	}
	pub := priv.Public().(ed25519.PublicKey)
	kid := keyID(pub)

	signer, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.EdDSA, Key: jose.JSONWebKey{
			Key:       priv,
			KeyID:     kid,
			Algorithm: string(jose.EdDSA),
			Use:       "sig",
		}},
		(&jose.SignerOptions{}).WithType("JWT"),
	)
	if err != nil {
		return nil, fmt.Errorf("jwks: build signer: %w", err)
	}

	jwksRaw, err := buildJWKS(pub, kid)
	if err != nil {
		return nil, err
	}

	return &KeyStore{
		priv:    priv,
		pub:     pub,
		kid:     kid,
		signer:  signer,
		jwksRaw: jwksRaw,
		pool:    pool,
	}, nil
}

func loadOrGenerate(pemEnv string) (ed25519.PrivateKey, error) {
	if pemEnv == "" {
		_, priv, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			return nil, fmt.Errorf("jwks: generate ed25519: %w", err)
		}
		return priv, nil
	}
	block, _ := pem.Decode([]byte(pemEnv))
	if block == nil {
		return nil, errors.New("jwks: JWT_PRIVATE_KEY_PEM is not valid PEM")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("jwks: parse PKCS#8: %w", err)
	}
	priv, ok := parsed.(ed25519.PrivateKey)
	if !ok {
		return nil, errors.New("jwks: JWT_PRIVATE_KEY_PEM is not Ed25519")
	}
	return priv, nil
}

// keyID returns the first 8 bytes of SHA-256(pubkey) as base64url.
func keyID(pub ed25519.PublicKey) string {
	sum := sha256.Sum256(pub)
	return base64.RawURLEncoding.EncodeToString(sum[:8])
}

// buildJWKS serialises the public key as an RFC 8037 OKP/Ed25519 JWK set.
func buildJWKS(pub ed25519.PublicKey, kid string) ([]byte, error) {
	x := base64.RawURLEncoding.EncodeToString(pub)
	jwk := map[string]string{
		"kty": "OKP",
		"crv": "Ed25519",
		"alg": "EdDSA",
		"use": "sig",
		"kid": kid,
		"x":   x,
	}
	return json.Marshal(map[string]any{"keys": []any{jwk}})
}

// Claims is the access-token payload — standard JWT claims plus role.
type Claims struct {
	jwt.Claims
	Role string `json:"role"`
}

// Sign issues an Ed25519-signed access token.
func (k *KeyStore) Sign(sub, role, audience string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		Claims: jwt.Claims{
			Subject:  sub,
			Audience: jwt.Audience{audience},
			Issuer:   Issuer,
			IssuedAt: jwt.NewNumericDate(now),
			Expiry:   jwt.NewNumericDate(now.Add(ttl)),
			ID:       newJTI(),
		},
		Role: role,
	}
	return jwt.Signed(k.signer).Claims(claims).Serialize()
}

// Verify validates an Ed25519-signed access token.
func (k *KeyStore) Verify(token, expectedAudience string) (*Claims, error) {
	parsed, err := jwt.ParseSigned(token, []jose.SignatureAlgorithm{jose.EdDSA})
	if err != nil {
		return nil, err
	}
	out := &Claims{}
	if err := parsed.Claims(k.pub, out); err != nil {
		return nil, err
	}
	exp := jwt.Expected{
		Issuer:      Issuer,
		AnyAudience: jwt.Audience{expectedAudience},
		Time:        time.Now(),
	}
	if err := out.Claims.Validate(exp); err != nil {
		return nil, err
	}
	return out, nil
}

// PublicKey exposes the verifying key for tests.
func (k *KeyStore) PublicKey() ed25519.PublicKey { return k.pub }

// KID returns the kid embedded in the JWKS.
func (k *KeyStore) KID() string { return k.kid }

// JWKSHandler serves the public key as a JWK set on /.well-known/jwks.json.
func (k *KeyStore) JWKSHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(k.jwksRaw)
}

func newJTI() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return base64.RawURLEncoding.EncodeToString(b[:])
}

// EncodePrivateKeyPEM emits the keystore's private key as PKCS#8 PEM.
func (k *KeyStore) EncodePrivateKeyPEM() (string, error) {
	der, err := x509.MarshalPKCS8PrivateKey(k.priv)
	if err != nil {
		return "", err
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})), nil
}

// ── refresh tokens ───────────────────────────────────────────────────────────

// IssueRefresh creates a fresh refresh token, persists its hash, and
// returns the plaintext value to the caller.
func (k *KeyStore) IssueRefresh(ctx context.Context, userID string) (string, time.Time, error) {
	if k.pool == nil {
		return "", time.Time{}, errors.New("jwks: refresh-token store not configured")
	}
	plain, hash, err := newRefreshToken()
	if err != nil {
		return "", time.Time{}, err
	}
	expiresAt := time.Now().UTC().Add(RefreshTTL)
	_, err = k.pool.Exec(ctx,
		`INSERT INTO "RefreshToken" ("tokenHash", "userId", "expiresAt", "createdAt")
		 VALUES ($1, $2, $3, NOW())`,
		hash, userID, expiresAt,
	)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("jwks: persist refresh: %w", err)
	}
	return plain, expiresAt, nil
}

// RotateRefresh validates and rotates a refresh token in a single tx:
// revoke the old row, insert a new one, return the new plaintext + the
// user it belongs to.
func (k *KeyStore) RotateRefresh(ctx context.Context, plain string) (newPlain, userID string, expiresAt time.Time, err error) {
	if k.pool == nil {
		return "", "", time.Time{}, errors.New("jwks: refresh-token store not configured")
	}
	hash := hashRefresh(plain)
	tx, err := k.pool.Begin(ctx)
	if err != nil {
		return "", "", time.Time{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		id        string
		expiry    time.Time
		revokedAt *time.Time
	)
	err = tx.QueryRow(ctx,
		`SELECT "userId", "expiresAt", "revokedAt"
		 FROM "RefreshToken" WHERE "tokenHash" = $1`,
		hash,
	).Scan(&id, &expiry, &revokedAt)
	if err != nil {
		return "", "", time.Time{}, errors.New("refresh token not recognised")
	}
	if revokedAt != nil {
		return "", "", time.Time{}, errors.New("refresh token already used")
	}
	if time.Now().After(expiry) {
		return "", "", time.Time{}, errors.New("refresh token expired")
	}

	if _, err := tx.Exec(ctx,
		`UPDATE "RefreshToken" SET "revokedAt" = NOW() WHERE "tokenHash" = $1`,
		hash,
	); err != nil {
		return "", "", time.Time{}, err
	}

	plainNext, hashNext, err := newRefreshToken()
	if err != nil {
		return "", "", time.Time{}, err
	}
	expiresAt = time.Now().UTC().Add(RefreshTTL)
	if _, err := tx.Exec(ctx,
		`INSERT INTO "RefreshToken" ("tokenHash", "userId", "expiresAt", "createdAt", "rotatedFrom")
		 VALUES ($1, $2, $3, NOW(), $4)`,
		hashNext, id, expiresAt, hash,
	); err != nil {
		return "", "", time.Time{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", "", time.Time{}, err
	}
	return plainNext, id, expiresAt, nil
}

// RevokeRefresh marks a single refresh token as revoked (idempotent).
func (k *KeyStore) RevokeRefresh(ctx context.Context, plain string) error {
	if k.pool == nil {
		return errors.New("jwks: refresh-token store not configured")
	}
	_, err := k.pool.Exec(ctx,
		`UPDATE "RefreshToken" SET "revokedAt" = NOW()
		 WHERE "tokenHash" = $1 AND "revokedAt" IS NULL`,
		hashRefresh(plain),
	)
	return err
}

// RevokeAllForUser revokes every active refresh token for a user.
func (k *KeyStore) RevokeAllForUser(ctx context.Context, userID string) error {
	if k.pool == nil {
		return errors.New("jwks: refresh-token store not configured")
	}
	_, err := k.pool.Exec(ctx,
		`UPDATE "RefreshToken" SET "revokedAt" = NOW()
		 WHERE "userId" = $1 AND "revokedAt" IS NULL`,
		userID,
	)
	return err
}

func newRefreshToken() (plain, hash string, err error) {
	var raw [32]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", "", err
	}
	plain = base64.RawURLEncoding.EncodeToString(raw[:])
	hash = hashRefresh(plain)
	return plain, hash, nil
}

func hashRefresh(plain string) string {
	sum := sha256.Sum256([]byte(plain))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}