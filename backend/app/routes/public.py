from flask import Blueprint, jsonify, request

from ..security import client_ip, order_limiter
from ..services import catalog, orders, store

bp = Blueprint("public", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    return {"status": "ok"}


@bp.get("/store")
def get_store():
    return store.store_info()


@bp.get("/menu")
def get_menu():
    return catalog.public_menu()


@bp.get("/products/<slug>")
def get_product(slug):
    return catalog.product_by_slug(slug)


@bp.post("/orders/quote")
def quote_order():
    return orders.quote(request.get_json(silent=True))


@bp.post("/orders")
def create_order():
    order_limiter.check(client_ip())
    order = orders.create_order(request.get_json(silent=True))
    public = {k: order[k] for k in ("code", "status", "fulfillment", "subtotal_cents",
                                    "delivery_fee_cents", "total_cents", "items", "created_at")}
    return jsonify(public), 201


@bp.get("/orders/<code>")
def track(code):
    return orders.track_order(code, request.args.get("phone", ""))
