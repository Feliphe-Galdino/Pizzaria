import { api } from "./core/api.js";
import * as cart from "./core/cart.js";
import { esc, formatMoney, icon, plural } from "./core/format.js";
import { ORDER_STATUS } from "./core/labels.js";
import { toast } from "./core/ui.js";
import { initCart, openCart, setStore } from "./components/cart-drawer.js";
import { pizzaSVG } from "./components/pizza-art.js";
import { productCard } from "./components/product-card.js";
import { openProductSheet } from "./components/product-sheet.js";
import { renderStore } from "./components/store-info.js";

const menuEl = document.querySelector("[data-menu]");
const navEl = document.querySelector("[data-category-nav]");
const PRODUCT_HASH = /^#\/produto\/([a-z0-9-]+)$/;

let menu = { categories: [] };
let openedByClick = false;

const normalize = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function findProduct(slug) {
  for (const category of menu.categories) {
    const product = category.products.find((p) => p.slug === slug);
    if (product) return { product, category };
  }
  return null;
}

/* ---------- Cardápio ---------- */
function renderMenu() {
  menuEl.setAttribute("aria-busy", "false");
  if (!menu.categories.length) {
    menuEl.innerHTML = `<div class="menu-empty"><h3>Cardápio em preparação</h3><p>Volte em instantes ou fale com a gente pelo WhatsApp.</p></div>`;
    return;
  }
  navEl.innerHTML = menu.categories.map((c, i) =>
    `<li><a class="chip" href="#cat-${esc(c.slug)}" data-chip="${esc(c.slug)}" ${i === 0 ? 'aria-current="true"' : ""}>${esc(c.name)}</a></li>`).join("");

  menuEl.innerHTML = menu.categories.map((c) => `
    <section class="menu-category" id="cat-${esc(c.slug)}" aria-labelledby="cat-title-${esc(c.slug)}" data-category="${esc(c.slug)}">
      <div class="menu-category__head"><h3 id="cat-title-${esc(c.slug)}">${esc(c.name)}</h3></div>
      ${c.description ? `<p class="menu-category__desc">${esc(c.description)}</p>` : ""}
      <ul class="product-grid">${c.products.map((p) => `<li>${productCard(p)}</li>`).join("")}</ul>
    </section>`).join("") +
    `<div class="menu-empty" data-no-results hidden>${icon("search")}<h3>Nada encontrado</h3><p>Tente outro sabor ou ingrediente, como “calabresa” ou “chocolate”.</p><button class="btn btn--ghost btn--sm" type="button" data-clear-search>Limpar busca</button></div>`;

  observeCategories();
}

function observeCategories() {
  const chips = new Map([...navEl.querySelectorAll("[data-chip]")].map((a) => [a.dataset.chip, a]));
  // Centraliza o chip só na lista horizontal (scrollLeft). Usar chip.scrollIntoView()
  // aqui também tentava realinhar o eixo vertical da página, e como o chip fica
  // dentro de um nav "sticky" isso trava/pula a rolagem ao descer pelo cardápio.
  const centerChip = (chip) => {
    const target = chip.offsetLeft - (navEl.clientWidth - chip.clientWidth) / 2;
    navEl.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  };
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    const chip = chips.get(visible.target.dataset.category);
    if (!chip) return;
    chips.forEach((c) => c.removeAttribute("aria-current"));
    chip.setAttribute("aria-current", "true");
    centerChip(chip);
  }, { rootMargin: "-35% 0px -55% 0px" });
  menuEl.querySelectorAll("[data-category]").forEach((s) => observer.observe(s));
}

function applySearch(term) {
  const q = normalize(term.trim());
  let total = 0;
  menuEl.querySelectorAll("[data-category]").forEach((section) => {
    let shown = 0;
    section.querySelectorAll(".product-card").forEach((card) => {
      const match = !q || normalize(card.dataset.search).includes(q);
      card.parentElement.hidden = !match;
      shown += match;
    });
    section.hidden = shown === 0;
    total += shown;
  });
  const empty = menuEl.querySelector("[data-no-results]");
  if (empty) empty.hidden = total > 0;
}

/* ---------- Detalhe do produto via URL (#/produto/slug) ---------- */
function openFromHash() {
  const match = location.hash.match(PRODUCT_HASH);
  const sheet = document.getElementById("product-sheet");
  if (!match) { if (sheet.open) sheet.close(); return; }
  const found = findProduct(match[1]);
  if (!found) { toast("Esse produto não está mais no cardápio", { type: "error" }); return; }
  openProductSheet(found.product, found.category, {
    onClose: () => {
      if (!PRODUCT_HASH.test(location.hash)) return;
      if (openedByClick) history.back();
      else history.replaceState(null, "", `${location.pathname}#cardapio`);
      openedByClick = false;
    },
  });
}

function showProduct(slug) {
  openedByClick = true;
  history.pushState(null, "", `#/produto/${slug}`);
  openFromHash();
}

function quickAdd(slug) {
  const found = findProduct(slug);
  if (!found || !found.product.available) return;
  const { product, category } = found;
  // Itens simples (um tamanho, sem adicionais) entram direto no pedido.
  if (product.sizes.length === 1 && !category.addons.length) {
    const size = product.sizes[0];
    cart.add({ product_id: product.id, slug, name: product.name, art: product.art, image_url: product.image_url,
      size_id: size.id, size_label: size.label, addon_ids: [], addon_names: [], unit_cents: size.price_cents, quantity: 1, notes: "" });
    toast(`Adicionado ao pedido: ${product.name}`);
  } else {
    showProduct(slug);
  }
}

/* ---------- Contador do carrinho ---------- */
function bindCartIndicators() {
  let previous = cart.snapshot().count;
  cart.subscribe(({ count, subtotal }) => {
    document.querySelectorAll("[data-cart-count]").forEach((el) => {
      el.textContent = count;
      if (count > previous) { el.classList.remove("is-bumping"); void el.offsetWidth; el.classList.add("is-bumping"); }
    });
    document.querySelectorAll("[data-cart-total]").forEach((el) => { el.textContent = formatMoney(subtotal); });
    document.querySelectorAll(".cart-btn").forEach((b) => b.setAttribute("aria-label", `Abrir pedido, ${plural(count, "item", "itens")}`));
    const bar = document.querySelector("[data-cart-bar]");
    bar.classList.toggle("is-visible", count > 0);
    bar.querySelector("button").tabIndex = count > 0 ? 0 : -1;
    previous = count;
  });
}

/* ---------- Acompanhar pedido ---------- */
function bindTracking() {
  const form = document.querySelector("[data-track-form]");
  const result = document.querySelector("[data-track-result]");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = form.code.value.trim().toUpperCase();
    const phone = form.phone.value.trim();
    if (code.length !== 5 || phone.replace(/\D/g, "").length < 10) {
      result.textContent = "Informe o código de 5 caracteres e o telefone com DDD.";
      return;
    }
    result.textContent = "Consultando...";
    try {
      const order = await api(`/orders/${encodeURIComponent(code)}?phone=${encodeURIComponent(phone)}`);
      result.textContent = `Pedido ${order.code}: ${ORDER_STATUS[order.status]}. Total ${formatMoney(order.total_cents)}.`;
    } catch (err) {
      result.textContent = err.message;
    }
  });
}

/* ---------- Inicialização ---------- */
async function init() {
  document.querySelector("[data-year]").textContent = new Date().getFullYear();
  const heroSvg = pizzaSVG("romera", "hero");
  document.querySelector("[data-hero-pizza]").innerHTML = heroSvg;
  document.querySelector("[data-hero-slice]").innerHTML = heroSvg;

  bindCartIndicators();
  bindTracking();

  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-product-link]");
    if (link) { e.preventDefault(); return showProduct(link.dataset.productLink); }
    const quick = e.target.closest("[data-quick-add]");
    if (quick) return quickAdd(quick.dataset.quickAdd);
    if (e.target.closest("[data-open-cart]")) return openCart();
    if (e.target.closest("[data-clear-search]")) {
      const input = document.getElementById("menu-search");
      input.value = ""; applySearch(""); input.focus();
    }
  });
  document.getElementById("menu-search").addEventListener("input", (e) => applySearch(e.target.value));
  window.addEventListener("popstate", openFromHash);

  const [storeResult, menuResult] = await Promise.allSettled([api("/store"), api("/menu")]);

  if (storeResult.status === "fulfilled") {
    renderStore(storeResult.value);
    initCart(storeResult.value);
    setStore(storeResult.value);
  } else {
    initCart(null);
  }

  if (menuResult.status === "fulfilled") {
    menu = menuResult.value;
    renderMenu();
    openFromHash();
  } else {
    menuEl.setAttribute("aria-busy", "false");
    menuEl.innerHTML = `<div class="menu-empty">${icon("alert")}<h3>Não conseguimos carregar o cardápio</h3><p>${esc(menuResult.reason.message)}</p><button class="btn" type="button" data-retry>Tentar de novo</button></div>`;
    menuEl.querySelector("[data-retry]").addEventListener("click", () => location.reload());
  }
}

init();
