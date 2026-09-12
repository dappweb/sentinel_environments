"""Server-side verification of Privy access tokens.

The frontend's authenticated flag is never trusted as authorization. Production
must provide the issuer, JWKS URL, and audience explicitly through the host
environment before this dependency is mounted on user-data routes.
"""

from __future__ import annotations

import os
import time
from typing import Any

import requests
from fastapi import HTTPException, Request
from jose import JWTError, jwt

_jwks_cache: dict[str, Any] = {"expires_at": 0.0, "keys": []}


def _setting(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise HTTPException(status_code=503, detail=f"{name} is not configured")
    return value


def _jwks() -> list[dict[str, Any]]:
    now = time.time()
    if _jwks_cache["expires_at"] > now:
        return _jwks_cache["keys"]
    url = _setting("PRIVY_JWKS_URL")
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        keys = response.json().get("keys", [])
    except (requests.RequestException, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Privy key service unavailable") from exc
    if not isinstance(keys, list) or not keys:
        raise HTTPException(status_code=503, detail="Privy key set is empty")
    _jwks_cache.update({"expires_at": now + 300, "keys": keys})
    return keys


def verify_privy_token(token: str) -> dict[str, Any]:
    issuer = _setting("PRIVY_ISSUER")
    audience = _setting("PRIVY_APP_ID")
    try:
        header = jwt.get_unverified_header(token)
        key = next((item for item in _jwks() if item.get("kid") == header.get("kid")), None)
        if key is None:
            raise HTTPException(status_code=401, detail="Unknown Privy signing key")
        claims = jwt.decode(token, key, algorithms=["RS256"], audience=audience, issuer=issuer)
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid Privy access token") from exc
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject.strip():
        raise HTTPException(status_code=401, detail="Privy token has no subject")
    return claims


async def require_privy_user(request: Request) -> dict[str, Any]:
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Bearer token required")
    return verify_privy_token(token)
