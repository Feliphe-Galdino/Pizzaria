PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    position    INTEGER NOT NULL DEFAULT 0,
    active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    ingredients TEXT NOT NULL DEFAULT '',
    art         TEXT NOT NULL DEFAULT 'margherita',  -- ilustração padrão quando não há foto
    image_url   TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '',            -- separadas por vírgula
    available   INTEGER NOT NULL DEFAULT 1,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_sizes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    detail      TEXT NOT NULL DEFAULT '',            -- ex.: "8 fatias"
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS addons (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
    exclusive_group TEXT NOT NULL DEFAULT '',        -- ex.: "Borda" = só uma opção do grupo
    available       INTEGER NOT NULL DEFAULT 1,
    position        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS addon_categories (
    addon_id    INTEGER NOT NULL REFERENCES addons(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (addon_id, category_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    code               TEXT NOT NULL UNIQUE,
    customer_name      TEXT NOT NULL,
    phone              TEXT NOT NULL,
    fulfillment        TEXT NOT NULL CHECK (fulfillment IN ('delivery', 'pickup')),
    address            TEXT NOT NULL DEFAULT '',     -- JSON
    payment_method     TEXT NOT NULL CHECK (payment_method IN ('pix', 'card', 'cash')),
    change_for_cents   INTEGER,
    notes              TEXT NOT NULL DEFAULT '',
    subtotal_cents     INTEGER NOT NULL,
    delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
    total_cents        INTEGER NOT NULL,
    status             TEXT NOT NULL DEFAULT 'received'
                       CHECK (status IN ('received', 'preparing', 'ready', 'out_for_delivery', 'completed', 'canceled')),
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id       INTEGER REFERENCES products(id) ON DELETE SET NULL,
    product_name     TEXT NOT NULL,      -- cópia: o pedido não muda se o produto for editado
    size_label       TEXT NOT NULL,
    unit_price_cents INTEGER NOT NULL,   -- tamanho + adicionais
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    addons           TEXT NOT NULL DEFAULT '[]',
    notes            TEXT NOT NULL DEFAULT '',
    line_total_cents INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
