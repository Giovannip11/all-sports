import time
from collections import defaultdict

from fastapi import HTTPException, Request

# In-memory sliding window — fine for a single dev/small-deployment process.
# A multi-instance deployment would need a shared store (e.g. Redis) instead.
_hits: dict[str, list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(
    request: Request, bucket: str, max_requests: int, window_seconds: int
) -> None:
    key = f"{_client_ip(request)}:{bucket}"
    now = time.monotonic()
    cutoff = now - window_seconds

    hits = _hits[key]
    while hits and hits[0] < cutoff:
        hits.pop(0)

    if len(hits) >= max_requests:
        raise HTTPException(
            status_code=429, detail="Muitas tentativas. Tente novamente em alguns minutos."
        )
    hits.append(now)


def rate_limit_login(request: Request) -> None:
    enforce_rate_limit(request, "login", max_requests=10, window_seconds=300)


def rate_limit_signup(request: Request) -> None:
    enforce_rate_limit(request, "signup", max_requests=5, window_seconds=600)


def rate_limit_password_reset(request: Request) -> None:
    enforce_rate_limit(request, "password-reset", max_requests=5, window_seconds=600)
