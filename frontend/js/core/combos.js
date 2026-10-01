/**
 * Regras dos combos, usadas pelo site e pelo painel.
 * Um combo é um produto da categoria "combos": os itens fixos ficam em `ingredients`
 * (separados por ";") e cada pizza que o cliente pode escolher é uma opção de tamanho,
 * com o nome do sabor em `label` e o tamanho da pizza em `detail` (ex.: "Grande").
 */
export const COMBO_CATEGORY = "combos";
/** Etiqueta interna (não vira selo) que dá ao combo o cartão especial, em lousa e dourado. */
export const PREMIUM_TAG = "premium";

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text, word) => new RegExp(`(^|[^a-z0-9])${escapeRe(word)}([^a-z0-9]|$)`).test(text);

export const comboItems = (combo) => (combo.ingredients || "").split(";").map((s) => s.trim()).filter(Boolean);

/** Preço avulso de um item fixo que começa com o nome de um produto do cardápio; null se não for um produto. */
export function itemPrice(line, products) {
  const text = norm(line);
  const product = products
    .filter((p) => text.startsWith(norm(p.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (!product) return null;
  const size = product.sizes.find((s) => hasWord(text, norm(s.label)));
  return size ? size.price_cents : product.price_from_cents;
}

/** Produto do cardápio que corresponde a uma opção de pizza do combo. */
export const flavorProduct = (option, products) => products.find((p) => norm(p.name) === norm(option.label));

/**
 * Quanto o combo economiza frente a pedir tudo separado, pelo sabor que economiza menos.
 * Itens fixos que não são produtos do cardápio não entram na conta, então a economia
 * calculada nunca é maior que a real. `products` não deve incluir os próprios combos.
 */
export function comboSavings(combo, products) {
  const sides = comboItems(combo).reduce((n, line) => n + (itemPrice(line, products) ?? 0), 0);
  const options = combo.sizes.map((option) => {
    const pizza = flavorProduct(option, products);
    if (!pizza) return null;
    const size = option.detail
      ? pizza.sizes.find((s) => s.label === option.detail)
      : pizza.sizes.reduce((a, b) => (b.price_cents > a.price_cents ? b : a));
    if (!size) return null;
    const separate = sides + size.price_cents;
    return { separate, save: separate - option.price_cents };
  });
  if (!options.length || options.includes(null)) return null;
  const least = options.reduce((a, b) => (b.save < a.save ? b : a));
  return { ...least, varies: options.some((o) => o.save !== least.save) };
}
