/**
 * Estado do carrinho no navegador. Preços aqui são só para exibição:
 * o servidor recalcula tudo ao receber o pedido.
 */
const STORAGE_KEY = "romera:cart:v1";
const listeners = new Set();
let items = load();

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((i) => i && i.key && i.quantity > 0) : [];
  } catch {
    return [];
  }
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* modo privado: segue só em memória */ }
  listeners.forEach((fn) => fn(snapshot()));
}

const lineKey = (i) => [i.product_id, i.size_id, [...i.addon_ids].sort().join("."), i.notes.trim().toLowerCase()].join("|");

export function snapshot() {
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const subtotal = items.reduce((n, i) => n + i.unit_cents * i.quantity, 0);
  return { items: items.map((i) => ({ ...i })), count, subtotal };
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(snapshot());
  return () => listeners.delete(fn);
}

export function add(line) {
  const entry = { ...line, notes: line.notes || "", addon_ids: line.addon_ids || [] };
  entry.key = lineKey(entry);
  const existing = items.find((i) => i.key === entry.key);
  if (existing) existing.quantity = Math.min(20, existing.quantity + entry.quantity);
  else items.push(entry);
  persist();
}

export function setQuantity(key, quantity) {
  items = quantity <= 0 ? items.filter((i) => i.key !== key) : items.map((i) => (i.key === key ? { ...i, quantity: Math.min(20, quantity) } : i));
  persist();
}

export function remove(key) { setQuantity(key, 0); }

export function clear() { items = []; persist(); }

/** Atualiza preços com o que o servidor calculou (evita surpresa no total). */
export function syncPrices(serverLines) {
  items = items.map((i, idx) => (serverLines[idx] ? { ...i, unit_cents: serverLines[idx].unit_price_cents } : i));
  persist();
}

export const toOrderItems = () => items.map(({ product_id, size_id, quantity, addon_ids, notes }) => ({ product_id, size_id, quantity, addon_ids, notes }));
