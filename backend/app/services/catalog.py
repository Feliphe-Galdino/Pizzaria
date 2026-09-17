"""Leitura e escrita do cardápio: categorias, produtos, tamanhos e adicionais."""
from ..database import get_db, row, rows, transaction
from ..errors import ApiError, ValidationError
from ..validation import Validator, slugify

ALLOWED_TAGS = {"vegetariano", "picante", "novo", "mais-pedido", "sem-lactose"}
URL_PATTERN = r"(https://|/)[^\s\"'<>]{1,500}"


def _int_item(value):
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError({"_": "Use um ID numérico."})
    return value


def _tag_item(value):
    if value not in ALLOWED_TAGS:
        raise ValidationError({"_": f"Etiquetas permitidas: {', '.join(sorted(ALLOWED_TAGS))}."})
    return value


# ---------- serialização ----------

def _product_out(p: dict, sizes: list[dict]) -> dict:
    return {
        "id": p["id"],
        "category_id": p["category_id"],
        "name": p["name"],
        "slug": p["slug"],
        "description": p["description"],
        "ingredients": p["ingredients"],
        "art": p["art"],
        "image_url": p["image_url"],
        "tags": [t for t in p["tags"].split(",") if t],
        "available": bool(p["available"]),
        "position": p["position"],
        "sizes": [
            {"id": s["id"], "label": s["label"], "detail": s["detail"], "price_cents": s["price_cents"]}
            for s in sizes
        ],
        "price_from_cents": min((s["price_cents"] for s in sizes), default=0),
    }


def _sizes_by_product(product_ids: list[int]) -> dict[int, list[dict]]:
    if not product_ids:
        return {}
    marks = ",".join("?" * len(product_ids))
    result: dict[int, list[dict]] = {pid: [] for pid in product_ids}
    for s in rows(get_db().execute(
        f"SELECT * FROM product_sizes WHERE product_id IN ({marks}) ORDER BY position, price_cents", product_ids
    )):
        result[s["product_id"]].append(s)
    return result


def _addons_with_categories(only_available: bool) -> list[dict]:
    db = get_db()
    where = "WHERE available = 1" if only_available else ""
    addons = rows(db.execute(f"SELECT * FROM addons {where} ORDER BY exclusive_group, position, name"))
    links = rows(db.execute("SELECT * FROM addon_categories"))
    for a in addons:
        a["available"] = bool(a["available"])
        a["category_ids"] = [l["category_id"] for l in links if l["addon_id"] == a["id"]]
    return addons


# ---------- leitura pública ----------

def public_menu() -> dict:
    db = get_db()
    categories = rows(db.execute(
        "SELECT id, name, slug, description FROM categories WHERE active = 1 ORDER BY position, name"
    ))
    products = rows(db.execute(
        """SELECT p.* FROM products p JOIN categories c ON c.id = p.category_id
           WHERE c.active = 1 ORDER BY p.position, p.name"""
    ))
    sizes = _sizes_by_product([p["id"] for p in products])
    addons = _addons_with_categories(only_available=True)
    for c in categories:
        c["products"] = [_product_out(p, sizes[p["id"]]) for p in products
                         if p["category_id"] == c["id"] and sizes[p["id"]]]
        c["addons"] = [
            {k: a[k] for k in ("id", "name", "price_cents", "exclusive_group")}
            for a in addons if c["id"] in a["category_ids"]
        ]
    return {"categories": [c for c in categories if c["products"]]}


def product_by_slug(slug: str) -> dict:
    p = row(get_db().execute(
        """SELECT p.* FROM products p JOIN categories c ON c.id = p.category_id
           WHERE p.slug = ? AND c.active = 1""", (slug,)
    ))
    if not p:
        raise ApiError("Produto não encontrado.", 404, "not_found")
    return _product_out(p, _sizes_by_product([p["id"]])[p["id"]])


# ---------- administração: categorias ----------

def list_categories() -> list[dict]:
    items = rows(get_db().execute(
        """SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
           FROM categories c ORDER BY position, name"""
    ))
    for c in items:
        c["active"] = bool(c["active"])
    return items


def _validate_category(data, partial=False):
    return (Validator(data, partial)
            .str("name", min_len=2, max_len=60)
            .str("description", required=False, max_len=240, default="")
            .int("position", required=False, min_value=0, max_value=9999, default=0)
            .bool("active", default=True)
            .done())


def create_category(data) -> dict:
    v = _validate_category(data)
    slug = _unique_slug("categories", v["name"])
    with transaction() as db:
        cur = db.execute(
            "INSERT INTO categories (name, slug, description, position, active) VALUES (?, ?, ?, ?, ?)",
            (v["name"], slug, v["description"], v["position"], int(v["active"])),
        )
    return _get_or_404("categories", cur.lastrowid)


def update_category(cat_id: int, data) -> dict:
    _get_or_404("categories", cat_id)
    v = _validate_category(data, partial=True)
    if "active" in v:
        v["active"] = int(v["active"])
    _update("categories", cat_id, v)
    return _get_or_404("categories", cat_id)


def delete_category(cat_id: int):
    _get_or_404("categories", cat_id)
    count = get_db().execute("SELECT COUNT(*) FROM products WHERE category_id = ?", (cat_id,)).fetchone()[0]
    if count:
        raise ApiError("Mova ou exclua os produtos desta categoria antes de excluí-la.", 409, "category_not_empty")
    with transaction() as db:
        db.execute("DELETE FROM categories WHERE id = ?", (cat_id,))


# ---------- administração: produtos ----------

def _validate_size(raw):
    return (Validator(raw)
            .str("label", min_len=1, max_len=30)
            .str("detail", required=False, max_len=40, default="")
            .int("price_cents", min_value=0, max_value=1_000_000)
            .done())


def _validate_product(data, partial=False):
    v = (Validator(data, partial)
         .int("category_id", min_value=1)
         .str("name", min_len=2, max_len=80)
         .str("description", required=False, max_len=400, default="")
         .str("ingredients", required=False, max_len=400, default="")
         .str("art", required=False, max_len=40, pattern=r"[a-z0-9-]+", default="margherita")
         .str("image_url", required=False, max_len=500, pattern=URL_PATTERN, default="",
              message="Use um endereço https:// ou um caminho iniciado por /.")
         .list("tags", _tag_item, required=False, max_len=5)
         .bool("available", default=True)
         .int("position", required=False, min_value=0, max_value=9999, default=0)
         .list("sizes", _validate_size, min_len=1, max_len=6)
         .done())
    if "tags" in v:
        v["tags"] = ",".join(v["tags"])
    if "category_id" in v:
        _get_or_404("categories", v["category_id"], "Categoria não encontrada.")
    return v


def list_products() -> list[dict]:
    products = rows(get_db().execute("SELECT * FROM products ORDER BY category_id, position, name"))
    sizes = _sizes_by_product([p["id"] for p in products])
    return [_product_out(p, sizes[p["id"]]) for p in products]


def get_product(product_id: int) -> dict:
    p = _get_or_404("products", product_id, "Produto não encontrado.")
    return _product_out(p, _sizes_by_product([product_id])[product_id])


def _save_sizes(db, product_id, sizes):
    db.execute("DELETE FROM product_sizes WHERE product_id = ?", (product_id,))
    db.executemany(
        "INSERT INTO product_sizes (product_id, label, detail, price_cents, position) VALUES (?, ?, ?, ?, ?)",
        [(product_id, s["label"], s["detail"], s["price_cents"], i) for i, s in enumerate(sizes)],
    )


def create_product(data) -> dict:
    v = _validate_product(data)
    sizes = v.pop("sizes")
    v["slug"] = _unique_slug("products", v["name"])
    v["available"] = int(v["available"])
    with transaction() as db:
        cols = ", ".join(v.keys())
        cur = db.execute(f"INSERT INTO products ({cols}) VALUES ({', '.join('?' * len(v))})", list(v.values()))
        _save_sizes(db, cur.lastrowid, sizes)
    return get_product(cur.lastrowid)


def update_product(product_id: int, data) -> dict:
    current = _get_or_404("products", product_id, "Produto não encontrado.")
    v = _validate_product(data, partial=True)
    sizes = v.pop("sizes", None)
    if "available" in v:
        v["available"] = int(v["available"])
    if "name" in v and v["name"] != current["name"]:
        v["slug"] = _unique_slug("products", v["name"], exclude_id=product_id)
    with transaction() as db:
        if v:
            _update("products", product_id, v, db=db, touch=True)
        if sizes is not None:
            _save_sizes(db, product_id, sizes)
    return get_product(product_id)


def set_availability(product_id: int, data) -> dict:
    v = Validator(data).bool("available", required=True).done()
    _get_or_404("products", product_id, "Produto não encontrado.")
    _update("products", product_id, {"available": int(v["available"])}, touch=True)
    return get_product(product_id)


def delete_product(product_id: int):
    _get_or_404("products", product_id, "Produto não encontrado.")
    with transaction() as db:
        db.execute("DELETE FROM products WHERE id = ?", (product_id,))


# ---------- administração: adicionais ----------

def list_addons() -> list[dict]:
    return _addons_with_categories(only_available=False)


def _validate_addon(data, partial=False):
    return (Validator(data, partial)
            .str("name", min_len=2, max_len=60)
            .int("price_cents", min_value=0, max_value=100_000)
            .str("exclusive_group", required=False, max_len=30, default="")
            .bool("available", default=True)
            .int("position", required=False, min_value=0, max_value=9999, default=0)
            .list("category_ids", _int_item,
                required=False, max_len=50)
            .done())


def _save_addon_categories(db, addon_id, category_ids):
    db.execute("DELETE FROM addon_categories WHERE addon_id = ?", (addon_id,))
    existing = {r[0] for r in db.execute("SELECT id FROM categories").fetchall()}
    db.executemany(
        "INSERT INTO addon_categories (addon_id, category_id) VALUES (?, ?)",
        [(addon_id, cid) for cid in set(category_ids) if cid in existing],
    )


def create_addon(data) -> dict:
    v = _validate_addon(data)
    cats = v.pop("category_ids") or []
    v["available"] = int(v["available"])
    with transaction() as db:
        cur = db.execute(
            "INSERT INTO addons (name, price_cents, exclusive_group, available, position) VALUES (?, ?, ?, ?, ?)",
            (v["name"], v["price_cents"], v["exclusive_group"], v["available"], v["position"]),
        )
        _save_addon_categories(db, cur.lastrowid, cats)
    return _addon(cur.lastrowid)


def update_addon(addon_id: int, data) -> dict:
    _get_or_404("addons", addon_id, "Adicional não encontrado.")
    v = _validate_addon(data, partial=True)
    cats = v.pop("category_ids", None)
    if "available" in v:
        v["available"] = int(v["available"])
    with transaction() as db:
        if v:
            _update("addons", addon_id, v, db=db)
        if cats is not None:
            _save_addon_categories(db, addon_id, cats)
    return _addon(addon_id)


def delete_addon(addon_id: int):
    _get_or_404("addons", addon_id, "Adicional não encontrado.")
    with transaction() as db:
        db.execute("DELETE FROM addons WHERE id = ?", (addon_id,))


def _addon(addon_id):
    return next(a for a in _addons_with_categories(False) if a["id"] == addon_id)


# ---------- utilitários ----------

_TABLES = {"categories", "products", "addons"}


def _get_or_404(table: str, item_id: int, message="Item não encontrado.") -> dict:
    assert table in _TABLES
    item = row(get_db().execute(f"SELECT * FROM {table} WHERE id = ?", (item_id,)))
    if not item:
        raise ApiError(message, 404, "not_found")
    return item


def _update(table: str, item_id: int, values: dict, db=None, touch=False):
    assert table in _TABLES and all(k.isidentifier() for k in values)
    if not values:
        return
    sets = ", ".join(f"{k} = ?" for k in values)
    if touch:
        sets += ", updated_at = datetime('now')"
    if db is None:
        with transaction() as db:
            db.execute(f"UPDATE {table} SET {sets} WHERE id = ?", [*values.values(), item_id])
    else:
        db.execute(f"UPDATE {table} SET {sets} WHERE id = ?", [*values.values(), item_id])


def _unique_slug(table: str, name: str, exclude_id: int | None = None) -> str:
    assert table in _TABLES
    base = slugify(name) or "item"
    slug, n = base, 2
    while get_db().execute(
        f"SELECT 1 FROM {table} WHERE slug = ? AND id != ?", (slug, exclude_id or 0)
    ).fetchone():
        slug, n = f"{base}-{n}", n + 1
    return slug
