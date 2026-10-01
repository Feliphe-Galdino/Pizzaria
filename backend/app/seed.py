"""Dados iniciais do cardápio e criação do administrador."""
import click
from flask import current_app
from werkzeug.security import generate_password_hash

from .database import get_db, transaction
from .services.catalog import COMBO_CATEGORY
from .validation import slugify

P = "Broto", "4 fatias"
M = "Média", "6 fatias"
G = "Grande", "8 fatias"


def _pizza(broto, media, grande):
    return [(P[0], P[1], broto), (M[0], M[1], media), (G[0], G[1], grande)]


CATEGORIES = [
    ("Clássicas", "classicas", "As receitas que todo mundo pede, com a massa de fermentação lenta da padaria."),
    ("Especiais da casa", "especiais", "Criações Romera, pensadas no balcão e testadas na família."),
    ("Doces", "doces", "Para fechar a noite do jeito que a padaria sempre fez: com um doce."),
    ("Entradas do forno", "entradas", "Pães de fermentação natural que vieram direto da padaria."),
    ("Bebidas", "bebidas", "Geladas, para acompanhar."),
]

# (categoria, nome, descrição, ingredientes, arte, etiquetas, tamanhos)
PRODUCTS = [
    ("classicas", "Margherita", "Simples do jeito certo: tomate italiano, muçarela e manjericão fresco colhido no dia.",
     "Molho de tomate, muçarela, tomate, manjericão, azeite", "margherita", "vegetariano,mais-pedido", _pizza(3490, 4990, 6490)),
    ("classicas", "Calabresa", "Calabresa fatiada fina com cebola e azeitonas pretas, no ponto de dourar.",
     "Molho de tomate, muçarela, calabresa, cebola, azeitona preta, orégano", "calabresa", "mais-pedido", _pizza(3490, 4990, 6490)),
    ("classicas", "Portuguesa", "Presunto, ovos, ervilha e cebola em uma cobertura generosa.",
     "Molho de tomate, muçarela, presunto, ovo, ervilha, cebola, azeitona", "portuguesa", "", _pizza(3690, 5390, 6990)),
    ("classicas", "Quatro queijos", "Muçarela, provolone, parmesão e gorgonzola derretidos juntos.",
     "Molho de tomate, muçarela, provolone, parmesão, gorgonzola", "quatro-queijos", "vegetariano", _pizza(3890, 5590, 7290)),
    ("classicas", "Frango com catupiry", "Frango desfiado temperado na casa com Catupiry original.",
     "Molho de tomate, muçarela, frango desfiado, Catupiry, milho", "frango", "", _pizza(3690, 5390, 6990)),
    ("especiais", "Romera", "Nossa assinatura: linguiça artesanal, cebola roxa caramelizada, mel e alecrim sobre a massa da padaria.",
     "Molho de tomate, muçarela, linguiça artesanal, cebola roxa caramelizada, mel, alecrim", "romera", "mais-pedido", _pizza(4290, 6190, 7990)),
    ("especiais", "Pepperoni com mel picante", "Pepperoni que curva no forno, finalizado com mel de pimenta.",
     "Molho de tomate, muçarela, pepperoni, mel com pimenta calabresa", "pepperoni", "picante,novo", _pizza(4190, 5990, 7790)),
    ("especiais", "Burrata e pesto", "Burrata inteira aberta na hora, pesto de manjericão e tomate-cereja assado.",
     "Muçarela, burrata, pesto de manjericão, tomate-cereja, rúcula", "burrata", "vegetariano,novo", _pizza(4590, 6590, 8490)),
    ("especiais", "Parma e rúcula", "Presunto de Parma, rúcula e lascas de parmesão depois do forno.",
     "Molho de tomate, muçarela, presunto de Parma, rúcula, parmesão", "parma", "", _pizza(4590, 6590, 8490)),
    ("doces", "Chocolate com morango", "Chocolate ao leite derretido com morangos frescos.",
     "Chocolate ao leite, morango", "chocolate-morango", "mais-pedido", _pizza(3490, 4790, 5990)),
    ("doces", "Banana com canela", "A receita da cuca da padaria virou pizza: banana, açúcar e canela.",
     "Muçarela, banana, açúcar, canela, leite condensado", "banana", "", _pizza(3290, 4490, 5690)),
    ("doces", "Romeu e Julieta", "Goiabada cremosa com queijo minas derretido.",
     "Queijo minas, goiabada cascão", "romeu-julieta", "", _pizza(3290, 4490, 5690)),
    ("entradas", "Pão de alho da casa", "Filão da padaria recheado com creme de alho e queijo, assado no forno de pizza.",
     "Pão de fermentação natural, creme de alho, muçarela, salsinha", "pao-alho", "vegetariano",
     [("Porção", "6 pedaços", 2490)]),
    ("entradas", "Focaccia de alecrim", "Focaccia alta e aerada com azeite, alecrim e flor de sal.",
     "Farinha, fermento natural, azeite, alecrim, flor de sal", "focaccia", "vegetariano,sem-lactose",
     [("Meia", "serve 2", 1990), ("Inteira", "serve 4", 3490)]),
    ("bebidas", "Refrigerante", "Coca-Cola, Guaraná ou soda limonada. Informe o sabor nas observações.",
     "", "lata", "", [("Lata", "350 ml", 700), ("Garrafa", "2 L", 1600)]),
    ("bebidas", "Suco natural", "Laranja ou limão espremidos na hora.", "", "suco", "sem-lactose",
     [("Copo", "500 ml", 1200)]),
    ("bebidas", "Água mineral", "Com ou sem gás.", "", "agua", "", [("Garrafa", "500 ml", 500)]),
]

MENU_VERSION = 2  # suba ao criar uma nova migração em seed_if_empty

COMBOS_CATEGORY = ("Combos", COMBO_CATEGORY,
                   "Pão de alho, focaccia e pizza grande juntos, por um preço menor do que pedir cada item separado.")

# (nome, descrição, itens inclusos separados por ";", arte, etiquetas, categoria da pizza, preço)
# A pizza à escolha vira as opções de "tamanho" do combo (sabor no label, tamanho da pizza
# no detail), então carrinho, pedido e painel tratam o combo como qualquer outro produto.
COMBOS = [
    ("Combo Clássico",
     "Pão de alho, focaccia e a pizza clássica que você preferir. O jeito mais em conta de pedir para 3 ou 4 pessoas.",
     "Pão de alho da casa (6 pedaços); Focaccia de alecrim (meia, serve 2); Pizza clássica grande à escolha (8 fatias)",
     "combo-classico", "", "classicas", 8990),
    ("Combo Especial",
     "Uma pizza especial da casa com pão de alho e focaccia para abrir a noite. Para quando a ocasião pede algo a mais.",
     "Pão de alho da casa (6 pedaços); Focaccia de alecrim (meia, serve 2); Pizza especial da casa grande à escolha (8 fatias)",
     "combo-especial", "premium", "especiais", 10990),
]

# (nome, preço, grupo exclusivo, categorias)
ADDONS = [
    ("Borda de Catupiry", 1200, "Borda", ["classicas", "especiais"]),
    ("Borda de cheddar", 1200, "Borda", ["classicas", "especiais"]),
    ("Borda de chocolate", 1000, "Borda", ["doces"]),
    ("Queijo extra", 800, "", ["classicas", "especiais"]),
    ("Bacon", 900, "", ["classicas", "especiais"]),
    ("Azeitonas", 500, "", ["classicas", "especiais"]),
    ("Leite Ninho", 700, "", ["doces"]),
    ("Gelo e limão", 0, "", ["bebidas"]),
]


def _seed_menu(db):
    cat_ids = {}
    for pos, (name, slug, desc) in enumerate(CATEGORIES):
        cur = db.execute("INSERT INTO categories (name, slug, description, position) VALUES (?, ?, ?, ?)",
                         (name, slug, desc, pos))
        cat_ids[slug] = cur.lastrowid
    for pos, (cat, name, desc, ingr, art, tags, sizes) in enumerate(PRODUCTS):
        cur = db.execute(
            """INSERT INTO products (category_id, name, slug, description, ingredients, art, tags, position)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (cat_ids[cat], name, slugify(name), desc, ingr, art, tags, pos))
        db.executemany(
            "INSERT INTO product_sizes (product_id, label, detail, price_cents, position) VALUES (?, ?, ?, ?, ?)",
            [(cur.lastrowid, label, detail, price, i) for i, (label, detail, price) in enumerate(sizes)])
    for pos, (name, price, group, cats) in enumerate(ADDONS):
        cur = db.execute("INSERT INTO addons (name, price_cents, exclusive_group, position) VALUES (?, ?, ?, ?)",
                         (name, price, group, pos))
        db.executemany("INSERT INTO addon_categories (addon_id, category_id) VALUES (?, ?)",
                       [(cur.lastrowid, cat_ids[c]) for c in cats])


def _insert_combos(db):
    """Cria a categoria Combos no topo do cardápio, com os sabores atuais de cada categoria de pizza."""
    name, slug, desc = COMBOS_CATEGORY
    if db.execute("SELECT 1 FROM categories WHERE slug = ?", (slug,)).fetchone():
        return
    db.execute("UPDATE categories SET position = position + 1")
    cat_id = db.execute("INSERT INTO categories (name, slug, description, position) VALUES (?, ?, ?, 0)",
                        (name, slug, desc)).lastrowid
    for pos, (pname, pdesc, items, art, tags, pizza_cat, price) in enumerate(COMBOS):
        flavors = [r[0] for r in db.execute(
            """SELECT p.name FROM products p JOIN categories c ON c.id = p.category_id
               WHERE c.slug = ? ORDER BY p.position, p.name""", (pizza_cat,))]
        pslug = slugify(pname)
        if not flavors or db.execute("SELECT 1 FROM products WHERE slug = ?", (pslug,)).fetchone():
            continue
        pid = db.execute(
            """INSERT INTO products (category_id, name, slug, description, ingredients, art, tags, position)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (cat_id, pname, pslug, pdesc, items, art, tags, pos)).lastrowid
        db.executemany(
            "INSERT INTO product_sizes (product_id, label, detail, price_cents, position) VALUES (?, ?, ?, ?, ?)",
            [(pid, flavor, G[0], price, i) for i, flavor in enumerate(flavors)])


def ensure_admin(email: str, password: str):
    with transaction() as db:
        db.execute(
            """INSERT INTO users (email, password_hash) VALUES (?, ?)
               ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash""",
            (email.lower().strip(), generate_password_hash(password)))


def seed_if_empty():
    db = get_db()
    # IMMEDIATE trava a escrita já no início: com vários workers do gunicorn subindo juntos,
    # o segundo espera o primeiro terminar e encontra tudo pronto, em vez de duplicar dados.
    db.execute("BEGIN IMMEDIATE")
    try:
        if not db.execute("SELECT 1 FROM categories LIMIT 1").fetchone():
            _seed_menu(db)
        # user_version marca migrações de cardápio já aplicadas, para bancos criados antes delas.
        # Cada uma roda uma vez só: se o administrador apagar os combos depois, eles não voltam.
        version = db.execute("PRAGMA user_version").fetchone()[0]
        if version < 1:
            _insert_combos(db)
        if version < 2:
            # O estilo do cartão do combo passou a ser escolhido no painel (etiqueta "premium").
            db.execute("UPDATE products SET tags = 'premium' WHERE slug = 'combo-especial' AND tags = ''")
        if version < MENU_VERSION:
            db.execute(f"PRAGMA user_version = {MENU_VERSION}")
        db.commit()
    except Exception:
        db.rollback()
        raise
    cfg = current_app.config
    if cfg["ADMIN_EMAIL"] and cfg["ADMIN_PASSWORD"] and not db.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        ensure_admin(cfg["ADMIN_EMAIL"], cfg["ADMIN_PASSWORD"])


def register_commands(app):
    @app.cli.command("create-admin")
    @click.option("--email", prompt=True)
    @click.password_option()
    def create_admin(email, password):
        """Cria um administrador ou redefine a senha de um existente."""
        if len(password) < 10:
            raise click.BadParameter("Use uma senha com pelo menos 10 caracteres.")
        ensure_admin(email, password)
        click.echo(f"Administrador {email} pronto.")
