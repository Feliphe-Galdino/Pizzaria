"""Informações da loja (endereço, horários, contatos) e status aberto/fechado."""
import json
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

from flask import current_app

WEEKDAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]


@lru_cache(maxsize=1)
def _load() -> dict:
    return json.loads((Path(__file__).parent.parent / "data" / "store.json").read_text(encoding="utf-8"))


def _minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def open_status(now: datetime | None = None) -> dict:
    """Considera horários que passam da meia-noite (ex.: 18:00 às 00:30)."""
    tz = ZoneInfo(current_app.config["TIMEZONE"])
    now = now or datetime.now(tz)
    hours = {h["weekday"]: h for h in _load()["hours"]}
    minute = now.hour * 60 + now.minute

    for offset in (0, -1):  # hoje, ou turno de ontem que atravessa a meia-noite
        day = (now.weekday() + offset) % 7
        slot = hours.get(day)
        if not slot:
            continue
        start, end = _minutes(slot["open"]), _minutes(slot["close"])
        if end <= start:
            end += 24 * 60
        current = minute + (24 * 60 if offset == -1 else 0)
        if start <= current < end:
            return {"is_open": True, "message": f"Aberto até {slot['close']}"}

    for ahead in range(0, 8):
        day_date = now + timedelta(days=ahead)
        slot = hours.get(day_date.weekday())
        if slot and (ahead > 0 or _minutes(slot["open"]) > minute):
            when = "hoje" if ahead == 0 else ("amanhã" if ahead == 1 else WEEKDAYS[day_date.weekday()].lower())
            return {"is_open": False, "message": f"Fechado. Abre {when} às {slot['open']}"}
    return {"is_open": False, "message": "Fechado no momento"}


def store_info() -> dict:
    data = dict(_load())
    cfg = current_app.config
    data["whatsapp"] = cfg["WHATSAPP_NUMBER"]
    data["support_whatsapp"] = cfg["SUPPORT_WHATSAPP_NUMBER"]
    data["delivery_fee_cents"] = cfg["DELIVERY_FEE_CENTS"]
    data["min_order_cents"] = cfg["MIN_ORDER_CENTS"]
    data["hours"] = [{**h, "label": WEEKDAYS[h["weekday"]]} for h in data["hours"]]
    data["status"] = open_status()
    data["today_weekday"] = datetime.now(ZoneInfo(cfg["TIMEZONE"])).weekday()
    return data
