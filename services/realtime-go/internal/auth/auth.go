// Package auth verifies HS256 JWTs.
package auth

import (
	"errors"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	Sub      string `json:"sub"`
	Username string `json:"username,omitempty"`
	Role     string `json:"role,omitempty"`
	jwt.RegisteredClaims
}

func Verify(token string, secret string) (*Claims, error) {
	if token == "" {
		return nil, errors.New("empty token")
	}
	claims := &Claims{}
	t, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	}, jwt.WithLeeway(30))
	if err != nil || !t.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
