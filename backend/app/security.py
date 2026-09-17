"""Autenticação do administrador, limites de tentativa e cabeçalhos de segurança."""
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from functools import wraps
from threading import Lock

import jwt
from flask import current_app, g, request

from .errors import ApiError


def create_token(user_id: int, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=current_app.config["JWT_EXPIRES_MINUTES"]),
    }
    return jwt.encode(payload, current_app.config["SECRET_KEY"], algorithm="HS256")


def require_admin(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise ApiError("Faça login para continuar.", 401, "unauthorized")
        try:
            payload = jwt.decode(header[7:], current_app.config["SECRET_KEY"], algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            raise ApiError("Sua sessão expirou. Entre novamente.", 401, "token_expired")
        except jwt.InvalidTokenError:
            raise ApiError("Sessão inválida. Entre novamente.", 401, "invalid_token")
        g.admin = {"id": int(payload["sub"]), "email": payload.get("email")}
        return view(*args, **kwargs)
    return wrapper


class RateLimiter:
    """Janela deslizante em memória. Para vários servidores, troque por Redis."""

    def __init__(self, limit: int, window_seconds: int):
        self.limit, self.window = limit, window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str):
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                raise ApiError("Muitas tentativas. Aguarde alguns minutos e tente de novo.", 429, "rate_limited")
            hits.append(now)


login_limiter = RateLimiter(limit=5, window_seconds=300)
order_limiter = RateLimiter(limit=10, window_seconds=600)


def client_ip() -> str:
    # Atrás de proxy reverso, configure ProxyFix para que remote_addr seja confiável.
    return request.remote_addr or "unknown"


CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "img-src 'self' data: https:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)


def register_security(app):
    @app.after_request
    def _headers(resp):
        resp.headers.setdefault("Content-Security-Policy", CSP)
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        resp.headers.setdefault("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
        if request.path.startswith("/api/"):
            resp.headers.setdefault("Cache-Control", "no-store")
        origin = request.headers.get("Origin")
        if origin and origin in app.config["CORS_ORIGINS"]:
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Vary"] = "Origin"
            resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        return resp
