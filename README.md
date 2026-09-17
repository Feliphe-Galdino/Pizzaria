# Romera & Romera Pizzaria

Site com cardápio, pedidos online e painel administrativo para a pizzaria que nasce da padaria Romera & Romera.

- **Site:** cardápio com busca e categorias, detalhe do produto (tamanho, borda, adicionais, observação), carrinho, checkout (entrega ou retirada, Pix, cartão ou dinheiro com troco), confirmação com código e acompanhamento do pedido.
- **Painel (`/admin`):** pedidos em tempo quase real (atualiza a cada 20 s), mudança de status, resumo do dia, cadastro de produtos, preços por tamanho, disponibilidade, categorias e adicionais.

## Como rodar

Requisito: Python 3.11 ou superior.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # edite SECRET_KEY e ADMIN_PASSWORD
python run.py
```

- Site: http://localhost:5000
- Painel: http://localhost:5000/admin (e-mail e senha definidos no `.env`)

Na primeira execução o banco SQLite é criado em `backend/instance/` com o cardápio de exemplo e o administrador.

Outros comandos:

```bash
flask --app run create-admin                  # cria admin ou redefine senha
python -m unittest discover -s tests          # testes da API
gunicorn -w 2 -b 0.0.0.0:8000 "app:create_app()"   # produção
```

## Estrutura

```
backend/
  run.py                  servidor de desenvolvimento
  .env.example            variáveis de ambiente (copie para .env)
  app/
    __init__.py           fábrica da aplicação: API em /api, site na raiz
    config.py             configuração lida do ambiente
    schema.sql            tabelas
    database.py           conexão SQLite e transações
    validation.py         validador de dados com mensagens em português
    errors.py             erros padronizados em JSON
    security.py           JWT, limite de tentativas, cabeçalhos de segurança
    seed.py               cardápio inicial e comando create-admin
    data/store.json       endereço, horários, contatos e redes sociais
    routes/               public.py, auth.py, admin.py (só HTTP)
    services/             catalog.py, orders.py, store.py (regras de negócio)
  tests/test_api.py
frontend/
  index.html  admin.html
  assets/                 logo, marca, ornamentos, friso, foto da fachada
  css/                    tokens.css, base.css, components.css, site.css, admin.css
  js/core/                api, carrinho, formatação, rótulos, UI (toast, diálogos)
  js/components/          card, detalhe do produto, carrinho/checkout, loja, ilustrações
  js/admin/               sessão, pedidos, catálogo
```

## Decisões de arquitetura

- **Flask + SQLite + JavaScript sem build.** Menos peças para instalar e hospedar, carregamento rápido (sem framework no navegador) e fácil de manter. O código SQL fica isolado em `services/`, então migrar para PostgreSQL é trocar `database.py` e ajustar poucas consultas.
- **Preços calculados só no servidor.** O navegador envia apenas IDs e quantidades; o backend confere disponibilidade, se o adicional vale para aquela categoria e a regra de uma borda por pizza. O pedido guarda cópia de nome e preço, então editar o cardápio não altera pedidos antigos.
- **Valores em centavos (inteiros)** para evitar erro de arredondamento.
- **Bordas como "grupo exclusivo".** Qualquer adicional com o mesmo grupo vira escolha única (serve também para "Massa", "Ponto" etc.) sem mudar código.
- **Pedidos fora do horário são aceitos** com aviso claro ao cliente. Se preferir bloquear, a verificação já existe em `services/store.py` (`open_status`).
- **Confirmação pelo WhatsApp** após o pedido, porque é o canal que o cliente já usa. O pedido fica salvo no painel de qualquer forma.
- **Detalhe do produto com URL própria** (`/#/produto/margherita`), para compartilhar um sabor.
- **Ilustrações vetoriais geradas no navegador** para cada produto: leves, na paleta da marca e únicas. Ao cadastrar uma foto (`image_url`), ela substitui a ilustração. Recomendo fotos reais em WebP, 1200 px, em `frontend/assets/fotos/`.
- **Horários e contatos em `data/store.json`** porque mudam raramente; editar esse arquivo e reiniciar é suficiente.

## Segurança

- Senhas com hash (scrypt, via Werkzeug); login com JWT de duração limitada, guardado em `sessionStorage`.
- Limite de 5 tentativas de login e 10 pedidos a cada poucos minutos por IP (em memória; com vários servidores, use Redis).
- Validação de todos os dados de entrada, SQL parametrizado, tamanho máximo de requisição.
- Content-Security-Policy sem scripts ou estilos inline, `X-Frame-Options`, `nosniff`, `Referrer-Policy`.
- Todo texto vindo da API é escapado antes de ir para o HTML.
- Consulta pública de pedido exige código e telefone.
- Em produção (`APP_ENV=production`) o app não inicia sem `SECRET_KEY` e senha de admin definidas. Use HTTPS e, atrás de proxy, configure `ProxyFix`.

## Antes de publicar

1. Editar `backend/app/data/store.json` (endereço real, telefone, redes, horários, área de entrega).
2. Definir `WHATSAPP_NUMBER`, `DELIVERY_FEE_CENTS` e `MIN_ORDER_CENTS` no `.env`.
3. Revisar preços e sabores no painel.
4. Converter os textos da logo em curvas (Illustrator ou Inkscape) para uso em impressão; nos SVGs do site a fonte Cinzel é carregada do Google Fonts.
