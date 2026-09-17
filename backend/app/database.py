"""Acesso ao SQLite com uma conexão por requisição."""
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from flask import current_app, g


def _connect(path: str) -> sqlite3.Connection:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = _connect(current_app.config["DATABASE_PATH"])
    return g.db


def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


@contextmanager
def transaction():
    """Agrupa várias escritas: tudo é salvo ou nada é salvo."""
    db = get_db()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise


def init_db(app):
    app.teardown_appcontext(close_db)
    with app.app_context():
        db = get_db()
        schema = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")
        db.executescript(schema)
        db.commit()


def rows(cursor) -> list[dict]:
    return [dict(r) for r in cursor.fetchall()]


def row(cursor) -> dict | None:
    r = cursor.fetchone()
    return dict(r) if r else None
