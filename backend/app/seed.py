"""Dados iniciais do cardápio e criação do administrador."""
import click
from flask import current_app
from werkzeug.security import generate_password_hash

from .database import get_db, transaction

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


def seed_menu():
    with transaction() as db:
        cat_ids = {}
        for pos, (name, slug, desc) in enumerate(CATEGORIES):
            cur = db.execute("INSERT INTO categories (name, slug, description, position) VALUES (?, ?, ?, ?)",
                             (name, slug, desc, pos))
            cat_ids[slug] = cur.lastrowid
        from .validation import slugify
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


def ensure_admin(email: str, password: str):
    with transaction() as db:
        db.execute(
            """INSERT INTO users (email, password_hash) VALUES (?, ?)
               ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash""",
            (email.lower().strip(), generate_password_hash(password)))


def seed_if_empty():
    db = get_db()
    if not db.execute("SELECT 1 FROM categories LIMIT 1").fetchone():
        seed_menu()
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
