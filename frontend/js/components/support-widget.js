import { esc, formatMoney, icon } from "../core/format.js";
import { openDialog } from "../core/ui.js";

const dialog = () => document.getElementById("support-sheet");
const normalize = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Casa "keyword" só no início de uma palavra do texto (nunca no meio, ex.: "abre" dentro de
// "calabresa"), mas aceita prefixo de palavra maior (ex.: "reclama" casa com "reclamação").
function hasKeyword(text, keyword) {
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegex(normalize(keyword))}`).test(text);
}

// Assuntos que vão direto pro time (preço/promessa, saúde ou pedido específico):
// um bot de regras não deve tentar "adivinhar" essas respostas.
const ESCALATE_KEYWORDS = [
  "reclama", "cancelar", "cancelamento", "pedido errado", "problema", "atendente", "humano",
  "reembolso", "estorno", "demora", "atrasad", "nao chegou", "não chegou", "cobranca", "cobrança",
  "promocao", "promoção", "desconto", "cupom", "alergia", "gluten", "glúten", "vegano", "vegana",
  "contaminacao", "contaminação", "falar com alguem", "falar com alguém", "urgente",
];

const ESCALATE_MESSAGE = "Essa eu prefiro confirmar com a nossa equipe, pra não te passar informação errada. Fala com a gente no WhatsApp:";
const FALLBACK_MESSAGE = "Não tenho certeza se entendi — mas posso te colocar direto com nosso time no WhatsApp:";
const GREETING = "Oi! Eu respondo as dúvidas mais comuns sobre a Romera & Romera (horário, entrega, pagamento, endereço...). Pode perguntar!";

let faq = [];
let store = null;
let menu = { categories: [] };
let turns = [];
let loaded = false;

async function loadFaq() {
  try {
    const res = await fetch("/data/faq.json");
    faq = res.ok ? await res.json() : [];
  } catch {
    faq = [];
  }
}

function waLink(text) {
  if (!store?.whatsapp) return null;
  return `https://wa.me/${encodeURIComponent(store.whatsapp)}?text=${encodeURIComponent(text)}`;
}

function whatsappButton(question) {
  const link = waLink(`Olá! Vim do site e queria ajuda com: ${question}`);
  return link ? `<a class="btn btn--gold btn--sm chat__cta" href="${link}" target="_blank" rel="noopener">${icon("whatsapp")}Falar no WhatsApp</a>` : "";
}

function fillTokens(text) {
  const tokens = {
    horario_hoje: store?.status?.message || "",
    delivery_area: store?.delivery_area || "",
    delivery_fee: store ? formatMoney(store.delivery_fee_cents) : "",
    min_order: store ? formatMoney(store.min_order_cents) : "",
    delivery_time: store?.average_times?.delivery || "",
    pickup_time: store?.average_times?.pickup || "",
    endereco: store ? `${store.address.street}, ${store.address.district}, ${store.address.city} - ${store.address.state}` : "nosso endereço (veja mais abaixo na página)",
    area_entrega: store?.delivery_area || "",
    redes_sociais: store?.social?.instagram || store?.social?.facebook
      ? [store.social.instagram && `Instagram: ${store.social.instagram}`, store.social.facebook && `Facebook: ${store.social.facebook}`].filter(Boolean).join(" · ")
      : "Os links das nossas redes estão no rodapé do site.",
  };
  return text.replace(/\{(\w+)\}/g, (_, key) => tokens[key] ?? "");
}

function findProductMatch(text) {
  for (const category of menu.categories || []) {
    for (const product of category.products || []) {
      if (product.name.length > 2 && hasKeyword(text, product.name)) return product;
    }
  }
  return null;
}

function scoreFaq(text) {
  let best = null, bestScore = 0;
  for (const item of faq) {
    const score = item.keywords.reduce((n, k) => n + (hasKeyword(text, k) ? 1 : 0), 0);
    if (score > bestScore) { best = item; bestScore = score; }
  }
  return best;
}

function answer(raw) {
  const text = normalize(raw);

  if (ESCALATE_KEYWORDS.some((k) => hasKeyword(text, k))) {
    return { html: esc(ESCALATE_MESSAGE), cta: whatsappButton(raw) };
  }

  const faqHit = scoreFaq(text);
  if (faqHit) return { html: esc(fillTokens(faqHit.answer)), cta: "" };

  const product = findProductMatch(text);
  if (product) {
    const price = `a partir de ${formatMoney(product.price_from_cents)}`;
    return {
      html: `Temos sim! <strong>${esc(product.name)}</strong>, ${esc(price)}. ${esc(product.description || "")}`,
      cta: `<a class="btn btn--ghost btn--sm chat__cta" href="#/produto/${esc(product.slug)}" data-product-link="${esc(product.slug)}">Ver no cardápio</a>`,
    };
  }

  return { html: esc(FALLBACK_MESSAGE), cta: whatsappButton(raw) };
}

function bubble(from, html, cta = "") {
  return `<div class="chat__bubble chat__bubble--${from}">${html}${cta}</div>`;
}

function quickReplies() {
  const suggestions = turns.length <= 1 ? faq.filter((f) => f.quickReply) : [];
  const chips = suggestions.map((f) => `<button class="chip" type="button" data-suggestion="${esc(f.question)}">${esc(f.label || f.question)}</button>`);
  chips.push(`<button class="chip chip--wa" type="button" data-escalate>${icon("whatsapp")}Falar com atendente</button>`);
  return `<div class="chat__suggestions">${chips.join("")}</div>`;
}

function renderLog() {
  const log = dialog().querySelector("[data-chat-log]");
  if (!log) return;
  log.innerHTML = turns.map((t) => bubble(t.from, t.html, t.cta || "")).join("") + quickReplies();
  log.scrollTop = log.scrollHeight;
}

function ask(text) {
  const question = text.trim();
  if (!question) return;
  turns.push({ from: "user", html: esc(question) });
  const { html, cta } = answer(question);
  turns.push({ from: "bot", html, cta });
  renderLog();
}

function render() {
  const el = dialog();
  el.innerHTML = `
    <div class="cart__head">
      <h2 id="support-title">Suporte</h2>
    </div>
    <button class="icon-btn sheet__close" type="button" data-close aria-label="Fechar suporte">${icon("close")}</button>
    <div class="sheet__scroll"><div class="chat" data-chat-log></div></div>
    <form class="sheet__footer chat__form" data-chat-form>
      <input class="input" type="text" name="question" placeholder="Digite sua pergunta..." maxlength="200" autocomplete="off" data-chat-input />
      <button class="icon-btn chat__send" type="submit" aria-label="Enviar pergunta">${icon("check")}</button>
    </form>`;

  if (!turns.length) turns.push({ from: "bot", html: esc(GREETING) });
  renderLog();

  el.querySelector("[data-chat-form]").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = el.querySelector("[data-chat-input]");
    ask(input.value);
    input.value = "";
    input.focus();
  });
  el.querySelector("[data-chat-log]").addEventListener("click", (e) => {
    const suggestion = e.target.closest("[data-suggestion]");
    if (suggestion) return ask(suggestion.dataset.suggestion);
    if (e.target.closest("[data-escalate]")) return ask("Quero falar com um atendente");
    if (e.target.closest("[data-product-link]")) el.close();
  });
}

export function initSupport(storeInfo, menuData) {
  store = storeInfo || null;
  menu = menuData || { categories: [] };
  document.querySelector("[data-open-support]")?.addEventListener("click", async () => {
    if (!loaded) { await loadFaq(); loaded = true; }
    render();
    openDialog(dialog(), {});
    dialog().querySelector("[data-chat-input]")?.focus();
  });
}
