"""Cálculo e registro de pedidos. Os preços SEMPRE são recalculados no servidor."""
import json
import re
import secrets

from flask import current_app

from ..database import get_db, row, rows, transaction
from ..errors import ApiError, ValidationError
from ..validation import Validator

STATUSES = ["received", "preparing", "ready", "out_for_delivery", "completed", "canceled"]
PHONE_RE = r"\(?\d{2}\)?\s?9?\d{4}-?\d{4}"
MAX_QTY_PER_ITEM = 20
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _validate_item(raw):
    return (Validator(raw)
            .int("product_id", min_value=1)
            .int("size_id", min_value=1)
            .int("quantity", min_value=1, max_value=MAX_QTY_PER_ITEM)
            .list("addon_ids", _addon_id, required=False, max_len=10)
            .str("notes", required=False, max_len=140, default="")
            .done())


def _addon_id(value):
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError({"_": "Adicional inválido."})
    return value


def _validate_address(raw):
    return (Validator(raw)
            .str("street", min_len=3, max_len=120)
            .str("number", min_len=1, max_len=12)
            .str("district", min_len=2, max_len=60)
            .str("complement", required=False, max_len=60, default="")
            .str("reference", required=False, max_len=100, default="")
            .done())


def validate_order(data) -> dict:
    v = (Validator(data)
         .str("customer_name", min_len=2, max_len=80)
         .str("phone", pattern=PHONE_RE, max_len=20, message="Informe um telefone com DDD, ex.: (11) 91234-5678.")
         .choice("fulfillment", ["delivery", "pickup"])
         .choice("payment_method", ["pix", "card", "cash"])
         .int("change_for_cents", required=False, min_value=0, max_value=100_000)
         .str("notes", required=False, max_len=240, default="")
         .list("items", _validate_item, min_len=1, max_len=30)
         .done())
    if v["fulfillment"] == "delivery":
        try:
            v["address"] = _validate_address(data.get("address"))
        except ValidationError as exc:
            raise ValidationError({f"address.{k}" if k != "_" else "address": m for k, m in exc.fields.items()})
    else:
        v["address"] = None
    v["phone_digits"] = re.sub(r"\D", "", v["phone"])
    return v


def price_items(items: list[dict]) -> tuple[list[dict], int]:
    """Confere disponibilidade e aplicabilidade e devolve linhas com preços do banco."""
    db = get_db()
    lines, subtotal = [], 0
    for idx, item in enumerate(items):
        product = row(db.execute(
            """SELECT p.* FROM products p JOIN categories c ON c.id = p.category_id
               WHERE p.id = ? AND c.active = 1""", (item["product_id"],)))
        if not product:
            raise ApiError("Um dos produtos do carrinho não existe mais. Revise o carrinho.", 409, "product_missing")
        if not product["available"]:
            raise ApiError(f"{product['name']} acabou de ficar indisponível. Remova do carrinho para continuar.",
                           409, "product_unavailable")
        size = row(db.execute("SELECT * FROM product_sizes WHERE id = ? AND product_id = ?",
                              (item["size_id"], product["id"])))
        if not size:
            raise ValidationError({f"items[{idx}].size_id": "Tamanho inválido para este produto."})

        addon_ids = list(dict.fromkeys(item.get("addon_ids") or []))
        addons = []
        if addon_ids:
            marks = ",".join("?" * len(addon_ids))
            addons = rows(db.execute(
                f"""SELECT a.* FROM addons a JOIN addon_categories ac ON ac.addon_id = a.id
                    WHERE a.id IN ({marks}) AND ac.category_id = ? AND a.available = 1""",
                [*addon_ids, product["category_id"]]))
            if len(addons) != len(addon_ids):
                raise ValidationError({f"items[{idx}].addon_ids": "Algum adicional não está disponível para este produto."})
            groups = [a["exclusive_group"] for a in addons if a["exclusive_group"]]
            if len(groups) != len(set(groups)):
                raise ValidationError({f"items[{idx}].addon_ids": "Escolha só uma opção por grupo (ex.: uma borda)."})

        unit = size["price_cents"] + sum(a["price_cents"] for a in addons)
        line_total = unit * item["quantity"]
        subtotal += line_total
        lines.append({
            "product_id": product["id"],
            "product_name": product["name"],
            "size_label": size["label"],
            "unit_price_cents": unit,
            "quantity": item["quantity"],
            "addons": [{"id": a["id"], "name": a["name"], "price_cents": a["price_cents"]} for a in addons],
            "notes": item.get("notes", ""),
            "line_total_cents": line_total,
        })
    return lines, subtotal


def quote(data) -> dict:
    """Prévia de valores sem salvar (usada pelo carrinho para confirmar preços)."""
    v = Validator(data).choice("fulfillment", ["delivery", "pickup"]).list("items", _validate_item, min_len=1, max_len=30).done()
    lines, subtotal = price_items(v["items"])
    fee = current_app.config["DELIVERY_FEE_CENTS"] if v["fulfillment"] == "delivery" else 0
    return {"items": lines, "subtotal_cents": subtotal, "delivery_fee_cents": fee, "total_cents": subtotal + fee,
            "min_order_cents": current_app.config["MIN_ORDER_CENTS"]}


def create_order(data) -> dict:
    v = validate_order(data)
    lines, subtotal = price_items(v["items"])
    cfg = current_app.config
    if subtotal < cfg["MIN_ORDER_CENTS"]:
        raise ApiError(f"O pedido mínimo é de R$ {cfg['MIN_ORDER_CENTS'] / 100:.2f}.".replace(".", ","), 422, "min_order")
    fee = cfg["DELIVERY_FEE_CENTS"] if v["fulfillment"] == "delivery" else 0
    total = subtotal + fee

    change_for = v.get("change_for_cents") if v["payment_method"] == "cash" else None
    if change_for is not None and change_for < total:
        raise ValidationError({"change_for_cents": "O valor para troco precisa ser maior que o total."})

    with transaction() as db:
        code = _new_code(db)
        cur = db.execute(
            """INSERT INTO orders (code, customer_name, phone, fulfillment, address, payment_method,
                   change_for_cents, notes, subtotal_cents, delivery_fee_cents, total_cents)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (code, v["customer_name"], v["phone_digits"], v["fulfillment"],
             json.dumps(v["address"], ensure_ascii=False) if v["address"] else "",
             v["payment_method"], change_for, v["notes"], subtotal, fee, total))
        db.executemany(
            """INSERT INTO order_items (order_id, product_id, product_name, size_label, unit_price_cents,
                   quantity, addons, notes, line_total_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [(cur.lastrowid, l["product_id"], l["product_name"], l["size_label"], l["unit_price_cents"],
              l["quantity"], json.dumps(l["addons"], ensure_ascii=False), l["notes"], l["line_total_cents"])
             for l in lines])
    return get_order(cur.lastrowid)


def _new_code(db) -> str:
    while True:
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(5))
        if not db.execute("SELECT 1 FROM orders WHERE code = ?", (code,)).fetchone():
            return code


def _order_out(order: dict, items: list[dict]) -> dict:
    order["address"] = json.loads(order["address"]) if order["address"] else None
    for it in items:
        it["addons"] = json.loads(it["addons"])
        it.pop("order_id", None)
    order["items"] = items
    return order


def get_order(order_id: int) -> dict:
    db = get_db()
    order = row(db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)))
    if not order:
        raise ApiError("Pedido não encontrado.", 404, "not_found")
    return _order_out(order, rows(db.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,))))


def track_order(code: str, phone: str) -> dict:
    """Consulta pública: exige código + telefone para não expor pedidos alheios."""
    digits = re.sub(r"\D", "", phone or "")
    order = row(get_db().execute("SELECT id, phone FROM orders WHERE code = ?", (code.upper(),)))
    if not order or not digits or order["phone"] != digits:
        raise ApiError("Não encontramos um pedido com esse código e telefone.", 404, "not_found")
    full = get_order(order["id"])
    return {k: full[k] for k in ("code", "status", "fulfillment", "total_cents", "created_at", "updated_at", "items")}


def list_orders(status: str | None, limit: int = 100) -> list[dict]:
    db = get_db()
    if status and status not in STATUSES:
        raise ValidationError({"status": "Status inválido."})
    query = "SELECT * FROM orders" + (" WHERE status = ?" if status else "") + " ORDER BY created_at DESC, id DESC LIMIT ?"
    orders = rows(db.execute(query, (status, limit) if status else (limit,)))
    if not orders:
        return []
    marks = ",".join("?" * len(orders))
    items = rows(db.execute(f"SELECT * FROM order_items WHERE order_id IN ({marks})", [o["id"] for o in orders]))
    grouped: dict[int, list[dict]] = {o["id"]: [] for o in orders}
    for it in items:
        grouped[it["order_id"]].append(it)
    return [_order_out(o, grouped[o["id"]]) for o in orders]


def update_status(order_id: int, data) -> dict:
    v = Validator(data).choice("status", STATUSES).done()
    get_order(order_id)
    with transaction() as db:
        db.execute("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?", (v["status"], order_id))
    return get_order(order_id)


def summary() -> dict:
    tz_offset = "-3 hours"  # dia comercial no fuso de Brasília
    r = get_db().execute(
        f"""SELECT COUNT(*) AS orders,
                   COALESCE(SUM(CASE WHEN status != 'canceled' THEN total_cents END), 0) AS revenue_cents,
                   SUM(CASE WHEN status IN ('received', 'preparing') THEN 1 ELSE 0 END) AS in_progress
            FROM orders WHERE date(created_at, '{tz_offset}') = date('now', '{tz_offset}')"""
    ).fetchone()
    return {"orders_today": r["orders"], "revenue_today_cents": r["revenue_cents"], "in_progress": r["in_progress"] or 0}
