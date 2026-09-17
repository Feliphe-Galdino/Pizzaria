"""Configuração centralizada, lida de variáveis de ambiente (.env)."""
import os
import secrets
import warnings
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        raise RuntimeError(f"Variável {name} precisa ser um número inteiro.")


class Config:
    ENV = os.getenv("APP_ENV", "development")
    IS_PRODUCTION = ENV == "production"

    SECRET_KEY = os.getenv("SECRET_KEY", "")
    DATABASE_PATH = str(BASE_DIR / os.getenv("DATABASE_PATH", "instance/romera.db"))
    FRONTEND_DIR = str(BASE_DIR.parent / "frontend")

    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
    JWT_EXPIRES_MINUTES = _int("JWT_EXPIRES_MINUTES", 480)

    DELIVERY_FEE_CENTS = _int("DELIVERY_FEE_CENTS", 800)
    MIN_ORDER_CENTS = _int("MIN_ORDER_CENTS", 3000)
    WHATSAPP_NUMBER = os.getenv("WHATSAPP_NUMBER", "")
    TIMEZONE = os.getenv("STORE_TIMEZONE", "America/Sao_Paulo")

    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

    # Limita o tamanho do corpo das requisições (proteção contra payloads abusivos)
    MAX_CONTENT_LENGTH = 64 * 1024
    JSON_SORT_KEYS = False

    @classmethod
    def validate(cls):
        if not cls.SECRET_KEY or cls.SECRET_KEY.startswith("troque"):
            if cls.IS_PRODUCTION:
                raise RuntimeError("Defina SECRET_KEY no .env antes de rodar em produção.")
            warnings.warn("SECRET_KEY não definida: usando chave temporária (tokens expiram ao reiniciar).")
            cls.SECRET_KEY = secrets.token_urlsafe(48)
        if cls.IS_PRODUCTION and (not cls.ADMIN_PASSWORD or cls.ADMIN_PASSWORD.startswith("troque")):
            raise RuntimeError("Defina ADMIN_PASSWORD forte no .env antes de rodar em produção.")
