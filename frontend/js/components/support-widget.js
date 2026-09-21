import { esc, icon, formatMoney } from "../core/format.js";

const box = () => document.querySelector("[data-support-box]");
const fab = () => document.querySelector("[data-open-support]");
const GREETING = "Oi! Escolha uma das opções abaixo para eu te ajudar rapidinho.";

let faq = [];
let store = null;
let turns = [];
let isOpen = false;
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
  const number = store?.support_whatsapp || store?.whatsapp;
  return number ? `https://wa.me/${encodeURIComponent(number)}?text=${encodeURIComponent(text)}` : null;
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

function bubble(from, html) {
  return `<div class="chat__bubble chat__bubble--${from}">${html}</div>`;
}

function quickReplies() {
  const chips = [`<button class="chip" type="button" data-scroll-menu>${icon("search")}Ver cardápio</button>`];
  chips.push(...faq.map((f) => `<button class="chip" type="button" data-ask="${esc(f.id)}">${esc(f.label || f.question)}</button>`));
  const wa = waLink("Olá! Vim do site e preciso falar com o suporte.");
  if (wa) chips.push(`<a class="chip chip--wa" href="${wa}" target="_blank" rel="noopener">${icon("whatsapp")}Falar com atendente</a>`);
  return `<div class="chat__suggestions">${chips.join("")}</div>`;
}

function renderLog() {
  const log = box().querySelector("[data-chat-log]");
  if (!log) return;
  log.innerHTML = turns.map((t) => bubble(t.from, t.html)).join("") + quickReplies();
  log.scrollTop = log.scrollHeight;
}

function askFaq(id) {
  const item = faq.find((f) => f.id === id);
  if (!item) return;
  turns.push({ from: "user", html: esc(item.question) });
  turns.push({ from: "bot", html: esc(fillTokens(item.answer)) });
  renderLog();
}

function render() {
  const el = box();
  el.innerHTML = `
    <div class="support__head">
      <h2 id="support-title">Suporte</h2>
      <button class="icon-btn" type="button" data-close-support aria-label="Fechar suporte">${icon("close")}</button>
    </div>
    <div class="sheet__scroll"><div class="chat" data-chat-log></div></div>`;

  if (!turns.length) turns.push({ from: "bot", html: esc(GREETING) });
  renderLog();

  el.querySelector("[data-chat-log]").addEventListener("click", (e) => {
    const ask = e.target.closest("[data-ask]");
    if (ask) return askFaq(ask.dataset.ask);
    if (e.target.closest("[data-scroll-menu]")) {
      closeSupport();
      document.getElementById("cardapio").scrollIntoView({ behavior: "smooth" });
    }
  });
  el.querySelector("[data-close-support]").addEventListener("click", closeSupport);
}

function openSupport() {
  isOpen = true;
  const el = box();
  el.classList.add("is-open");
  el.inert = false;
  el.setAttribute("aria-hidden", "false");
  el.querySelector(".chip")?.focus();
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onOutsideClick, true);
}

function closeSupport() {
  isOpen = false;
  const el = box();
  el.classList.remove("is-open");
  el.inert = true;
  el.setAttribute("aria-hidden", "true");
  document.removeEventListener("keydown", onKeydown);
  document.removeEventListener("click", onOutsideClick, true);
  fab()?.focus();
}

function onKeydown(e) {
  if (e.key === "Escape") closeSupport();
}

function onOutsideClick(e) {
  if (box().contains(e.target) || fab()?.contains(e.target)) return;
  closeSupport();
}

export function initSupport(storeInfo) {
  store = storeInfo || null;
  fab()?.addEventListener("click", async () => {
    if (isOpen) return closeSupport();
    if (!loaded) { await loadFaq(); loaded = true; render(); }
    openSupport();
  });
}
