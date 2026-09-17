from flask import Blueprint, jsonify, request

from ..security import require_admin
from ..services import catalog, orders

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


@bp.before_request
def _protect():
    """Todas as rotas deste blueprint exigem login de administrador."""
    if request.method == "OPTIONS":
        return None
    return require_admin(lambda: None)()


def _body():
    return request.get_json(silent=True)


# Categorias
@bp.get("/categories")
def categories():
    return jsonify(catalog.list_categories())


@bp.post("/categories")
def create_category():
    return catalog.create_category(_body()), 201


@bp.put("/categories/<int:cat_id>")
def update_category(cat_id):
    return catalog.update_category(cat_id, _body())


@bp.delete("/categories/<int:cat_id>")
def delete_category(cat_id):
    catalog.delete_category(cat_id)
    return "", 204


# Produtos
@bp.get("/products")
def products():
    return jsonify(catalog.list_products())


@bp.get("/products/<int:product_id>")
def product(product_id):
    return catalog.get_product(product_id)


@bp.post("/products")
def create_product():
    return catalog.create_product(_body()), 201


@bp.put("/products/<int:product_id>")
def update_product(product_id):
    return catalog.update_product(product_id, _body())


@bp.patch("/products/<int:product_id>/availability")
def availability(product_id):
    return catalog.set_availability(product_id, _body())


@bp.delete("/products/<int:product_id>")
def delete_product(product_id):
    catalog.delete_product(product_id)
    return "", 204


# Adicionais
@bp.get("/addons")
def addons():
    return jsonify(catalog.list_addons())


@bp.post("/addons")
def create_addon():
    return catalog.create_addon(_body()), 201


@bp.put("/addons/<int:addon_id>")
def update_addon(addon_id):
    return catalog.update_addon(addon_id, _body())


@bp.delete("/addons/<int:addon_id>")
def delete_addon(addon_id):
    catalog.delete_addon(addon_id)
    return "", 204


# Pedidos
@bp.get("/orders")
def list_orders():
    limit = min(max(request.args.get("limit", 100, type=int), 1), 300)
    return jsonify(orders.list_orders(request.args.get("status") or None, limit))


@bp.get("/orders/<int:order_id>")
def get_order(order_id):
    return orders.get_order(order_id)


@bp.patch("/orders/<int:order_id>/status")
def order_status(order_id):
    return orders.update_status(order_id, _body())


@bp.get("/summary")
def summary():
    return orders.summary()
