"""Optional JWT verification helper (HS256)."""

from __future__ import annotations

from typing import Optional

from jose import JWTError, jwt


def verify_hs256(token: str, secret: str) -> Optional[dict]:
    try:
        return jwt.decode(token, secret, algorithms=["HS256"], options={"verify_aud": False})
    except JWTError:
        return None
