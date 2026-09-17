import { api } from "../core/api.js";
import * as cart from "../core/cart.js";
import { esc, formatMoney, formatPhone, icon, parseMoney, plural } from "../core/format.js";
import { FULFILLMENT, ORDER_STATUS, PAYMENT } from "../core/labels.js";
import { openDialog, setLoading, showFieldErrors, toast } from "../core/ui.js";
import { pizzaSVG, productMedia } from "./pizza-art.js";

const PROFILE_KEY = "romera:checkout:v1";
const dialog = () => document.getElementById("cart-sheet");

let store = null;
let step = "cart";
let lastOrder = null;
let serverProblem = "";

const loadProfile = () => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}"); } catch { return {}; } };
const saveProfile = (p) => { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* ignora */ } };

export function initCart(storeInfo) {
  store = storeInfo;
  cart.subscribe(() => { if (dialog().open && step !== "done") render(); });
}

export function setStore(storeInfo) { store = storeInfo; }

export async function openCart() {
  step = "cart";
  serverProblem = "";
  render();
  openDialog(dialog(), { onClose: () => { if (step === "done") step = "cart"; } });
  dialog().querySelector("[data-close]")?.focus();
  await refreshQuote();
}

async function refreshQuote(fulfillment = "delivery") {
  const { count } = cart.snapshot();
  if (!count) return;
  try {
    const q = await api("/orders/quote", { method: "POST", body: { fulfillment, items: cart.toOrderItems() } });
    serverProblem = "";
    cart.syncPrices(q.items);
  } catch (err) {
    serverProblem = err.message;
    render();
  }
}

function header(title, { back = false } = {}) {
  const idx = { cart: 1, checkout: 2, done: 3 }[step];
  return `<div class="cart__head">
    ${back ? `<button class="icon-btn" type="button" data-back aria-label="Voltar ao carrinho">${icon("back")}</button>` : ""}
    <h2 id="cart-title">${title}</h2>
    <div class="cart__steps" aria-hidden="true">${[1, 2, 3].map((n) => `<span class="${n <= idx ? "is-done" : ""}"></span>`).join("")}</div>
  </div>
  <button class="icon-btn sheet__close" type="button" data-close aria-label="Fechar pedido">${icon("close")}</button>`;
}

function totals(subtotal, fulfillment) {
  const fee = fulfillment === "delivery" ? store?.delivery_fee_cents || 0 : 0;
  return `<dl class="totals">
    <div><dt>Subtotal</dt><dd>${formatMoney(subtotal)}</dd></div>
    <div><dt>${fulfillment === "delivery" ? "Taxa de entrega" : "Retirada na loja"}</dt><dd>${fee ? formatMoney(fee) : "Grátis"}</dd></div>
    <div class="totals__total"><dt>Total</dt><dd>${formatMoney(subtotal + fee)}</dd></div>
  </dl>`;
}

function render() {
  const el = dialog();
  if (step === "done") return renderDone(el);
  if (step === "checkout") return renderCheckout(el);
  const { items, count, subtotal } = cart.snapshot();

  if (!count) {
    el.innerHTML = `${header("Seu pedido")}
      <div class="sheet__scroll"><div class="cart-empty">
        <div class="cart-empty__art">${pizzaSVG("margherita", "empty")}</div>
        <h3>Seu pedido está vazio</h3>
        <p>Escolha uma pizza no cardápio para começar.</p>
        <button class="btn" type="button" data-go-menu>Ver cardápio</button>
      </div></div>`;
  } else {
    const min = store?.min_order_cents || 0;
    el.innerHTML = `${header("Seu pedido")}
      <div class="sheet__scroll"><div class="cart__body">
        ${serverProblem ? `<p class="alert" role="alert">${icon("alert")}${esc(serverProblem)}</p>` : ""}
        <ul class="cart-items">
          ${items.map((i) => `
            <li class="cart-item">
              <div class="cart-item__art">${productMedia({ art: i.art, image_url: i.image_url, id: i.product_id })}</div>
              <div>
                <p class="cart-item__name">${esc(i.name)}</p>
                <p class="cart-item__meta">${esc(i.size_label)}${i.addon_names.length ? ` com ${esc(i.addon_names.join(", "))}` : ""}</p>
                ${i.notes ? `<p class="cart-item__meta">Obs.: ${esc(i.notes)}</p>` : ""}
                <div class="cart-item__row">
                  <div class="stepper stepper--sm" role="group" aria-label="Quantidade de ${esc(i.name)}">
                    <button type="button" data-line="${esc(i.key)}" data-delta="-1" aria-label="${i.quantity === 1 ? "Remover" : "Diminuir"}">${icon(i.quantity === 1 ? "trash" : "minus")}</button>
                    <output>${i.quantity}</output>
                    <button type="button" data-line="${esc(i.key)}" data-delta="1" aria-label="Aumentar" ${i.quantity >= 20 ? "disabled" : ""}>${icon("plus")}</button>
                  </div>
                  <span class="cart-item__price">${formatMoney(i.unit_cents * i.quantity)}</span>
                </div>
              </div>
            </li>`).join("")}
        </ul>
        <button class="btn btn--ghost btn--sm" type="button" data-go-menu>${icon("plus")}Adicionar mais itens</button>
        <dl class="totals">
          <div><dt>Subtotal (${plural(count, "item", "itens")})</dt><dd>${formatMoney(subtotal)}</dd></div>
          <div><dt>Entrega</dt><dd>calculada no próximo passo</dd></div>
        </dl>
        ${subtotal < min ? `<p class="alert alert--info">${icon("alert")}Faltam ${formatMoney(min - subtotal)} para o pedido mínimo de ${formatMoney(min)}.</p>` : ""}
      </div></div>
      <div class="sheet__footer">
        <button class="btn btn--split" type="button" data-next ${subtotal < min || serverProblem ? "disabled" : ""}>
          <span>Continuar</span><span>${formatMoney(subtotal)}</span>
        </button>
      </div>`;
  }
  bindCommon(el);
  el.querySelectorAll("[data-line]").forEach((b) => b.addEventListener("click", () => {
    const line = cart.snapshot().items.find((i) => i.key === b.dataset.line);
    if (!line) return;
    serverProblem = "";
    cart.setQuantity(line.key, line.quantity + Number(b.dataset.delta));
    if (line.quantity + Number(b.dataset.delta) <= 0) toast(`${line.name} removido do pedido`);
  }));
  el.querySelector("[data-next]")?.addEventListener("click", () => { step = "checkout"; render(); el.querySelector("input")?.focus(); });
}

function renderCheckout(el) {
  const { subtotal } = cart.snapshot();
  const p = loadProfile();
  const a = p.address || {};
  const fulfillment = p.fulfillment || "delivery";
  const status = store?.status;

  el.innerHTML = `${header("Finalizar pedido", { back: true })}
    <div class="sheet__scroll"><form class="cart__body checkout-form" data-checkout novalidate>
      ${status && !status.is_open ? `<p class="alert alert--info">${icon("clock")}${esc(status.message)}. Você já pode enviar: preparamos assim que abrirmos.</p>` : ""}
      <div class="field"><label for="co-name">Seu nome</label>
        <input class="input" id="co-name" name="customer_name" autocomplete="name" maxlength="80" required value="${esc(p.customer_name || "")}" /></div>
      <div class="field"><label for="co-phone">Telefone ou WhatsApp</label>
        <input class="input" id="co-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 91234-5678" required value="${esc(p.phone || "")}" /></div>

      <fieldset class="field"><legend>Como você quer receber?</legend>
        <div class="segmented">
          ${["delivery", "pickup"].map((f) => `<label class="option"><input type="radio" name="fulfillment" value="${f}" ${f === fulfillment ? "checked" : ""} />
            <span class="option__box">${icon(f === "delivery" ? "bike" : "bag")}${FULFILLMENT[f]}</span></label>`).join("")}
        </div>
      </fieldset>

      <div class="checkout-form" data-address-fields>
        <div class="grid-3">
          <div class="field"><label for="co-street">Rua</label><input class="input" id="co-street" name="address.street" autocomplete="address-line1" value="${esc(a.street || "")}" /></div>
          <div class="field"><label for="co-number">Número</label><input class="input" id="co-number" name="address.number" inputmode="numeric" value="${esc(a.number || "")}" /></div>
        </div>
        <div class="grid-2">
          <div class="field"><label for="co-district">Bairro</label><input class="input" id="co-district" name="address.district" value="${esc(a.district || "")}" /></div>
          <div class="field"><label for="co-complement">Complemento</label><input class="input" id="co-complement" name="address.complement" placeholder="Apto, bloco" value="${esc(a.complement || "")}" /></div>
        </div>
        <div class="field"><label for="co-reference">Ponto de referência</label><input class="input" id="co-reference" name="address.reference" value="${esc(a.reference || "")}" /></div>
        ${store?.delivery_area ? `<p class="hint">${esc(store.delivery_area)} Tempo médio: ${esc(store.average_times?.delivery || "")}.</p>` : ""}
      </div>

      <fieldset class="field"><legend>Pagamento na entrega ou retirada</legend>
        <div class="options">
          ${Object.entries(PAYMENT).map(([k, label]) => `<label class="option"><input type="radio" name="payment_method" value="${k}" ${k === (p.payment_method || "pix") ? "checked" : ""} />
            <span class="option__box"><span class="option__check">${icon("check")}</span><span class="option__main">${label}</span></span></label>`).join("")}
        </div>
      </fieldset>
      <div class="field" data-change-field hidden>
        <label for="co-change">Troco para quanto?</label>
        <input class="input" id="co-change" name="change_for_cents" inputmode="decimal" placeholder="Ex.: 100,00 (deixe vazio se não precisar)" />
      </div>

      <div class="field"><label for="co-notes">Observações do pedido</label>
        <textarea class="textarea" id="co-notes" name="notes" maxlength="240" placeholder="Ex.: interfone quebrado, pode ligar"></textarea></div>

      <div data-totals>${totals(subtotal, fulfillment)}</div>
      <p class="alert" role="alert" data-form-error hidden></p>
    </form></div>
    <div class="sheet__footer">
      <button class="btn btn--split" type="button" data-submit><span>Enviar pedido</span><span data-submit-total></span></button>
    </div>`;

  bindCommon(el);
  const form = el.querySelector("[data-checkout]");
  const phone = form.elements.phone;
  const submit = el.querySelector("[data-submit]");
  const errorBox = el.querySelector("[data-form-error]");

  const sync = () => {
    const f = form.elements.fulfillment.value;
    el.querySelector("[data-address-fields]").hidden = f !== "delivery";
    el.querySelector("[data-change-field]").hidden = form.elements.payment_method.value !== "cash";
    el.querySelector("[data-totals]").innerHTML = totals(subtotal, f);
    const fee = f === "delivery" ? store?.delivery_fee_cents || 0 : 0;
    el.querySelector("[data-submit-total]").textContent = formatMoney(subtotal + fee);
  };
  phone.addEventListener("input", () => { phone.value = formatPhone(phone.value); });
  form.addEventListener("change", sync);
  sync();

  const send = async (e) => {
    e?.preventDefault();
    errorBox.hidden = true;
    const f = form.elements;
    const body = {
      customer_name: f.customer_name.value,
      phone: f.phone.value,
      fulfillment: f.fulfillment.value,
      payment_method: f.payment_method.value,
      notes: f.notes.value,
      items: cart.toOrderItems(),
    };
    if (body.fulfillment === "delivery") {
      body.address = Object.fromEntries(["street", "number", "district", "complement", "reference"].map((k) => [k, f[`address.${k}`].value]));
    }
    if (body.payment_method === "cash" && f.change_for_cents.value.trim()) {
      const cents = parseMoney(f.change_for_cents.value);
      if (Number.isNaN(cents)) return showFieldErrors(form, { change_for_cents: "Digite um valor, ex.: 100,00." });
      body.change_for_cents = cents;
    }

    // Checagem rápida no navegador; a validação definitiva é do servidor.
    const local = {};
    if (body.customer_name.trim().length < 2) local.customer_name = "Informe seu nome.";
    if (body.phone.replace(/\D/g, "").length < 10) local.phone = "Informe um telefone com DDD.";
    if (body.address) for (const k of ["street", "number", "district"]) if (!body.address[k].trim()) local[`address.${k}`] = "Campo obrigatório.";
    if (showFieldErrors(form, local)) return;

    setLoading(submit, true);
    try {
      lastOrder = await api("/orders", { method: "POST", body });
      saveProfile({ customer_name: body.customer_name, phone: body.phone, fulfillment: body.fulfillment, payment_method: body.payment_method, address: body.address });
      lastOrder.payment_method = body.payment_method;
      step = "done";
      cart.clear();
      render();
    } catch (err) {
      if (err.fields && showFieldErrors(form, err.fields)) {
        toast("Revise os campos destacados", { type: "error" });
      } else {
        errorBox.hidden = false;
        errorBox.innerHTML = `${icon("alert")}<span>${esc(err.message)}</span>`;
        errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } finally {
      if (submit.isConnected) setLoading(submit, false);
    }
  };
  form.addEventListener("submit", send);
  submit.addEventListener("click", send);
}

function renderDone(el) {
  const o = lastOrder;
  const wa = store?.whatsapp
    ? `https://wa.me/${encodeURIComponent(store.whatsapp)}?text=${encodeURIComponent(`Olá! Acabei de fazer o pedido ${o.code} pelo site (total ${formatMoney(o.total_cents)}).`)}`
    : "";
  const eta = o.fulfillment === "delivery" ? store?.average_times?.delivery : store?.average_times?.pickup;

  el.innerHTML = `${header("Pedido enviado")}
    <div class="sheet__scroll"><div class="success">
      <div class="success__seal">${icon("check")}</div>
      <h3>Pedido recebido!</h3>
      <p>Guarde o código para acompanhar o status aqui no site.</p>
      <p class="success__code" aria-label="Código do pedido ${[...o.code].join(" ")}">${esc(o.code)}</p>
      <dl class="totals totals--full">
        <div><dt>Status</dt><dd>${ORDER_STATUS[o.status]}</dd></div>
        <div><dt>${FULFILLMENT[o.fulfillment]}</dt><dd>${eta ? `cerca de ${esc(eta)}` : ""}</dd></div>
        <div><dt>Pagamento</dt><dd>${PAYMENT[o.payment_method] || ""}</dd></div>
        <div class="totals__total"><dt>Total</dt><dd>${formatMoney(o.total_cents)}</dd></div>
      </dl>
      ${wa ? `<a class="btn btn--block" href="${wa}" target="_blank" rel="noopener">${icon("whatsapp")}Confirmar pelo WhatsApp</a>` : ""}
      <button class="btn btn--ghost btn--block" type="button" data-go-menu>Voltar ao cardápio</button>
    </div></div>`;
  bindCommon(el);
}

function bindCommon(el) {
  el.querySelector("[data-close]")?.addEventListener("click", () => el.close());
  el.querySelector("[data-back]")?.addEventListener("click", () => { step = "cart"; render(); });
  el.querySelectorAll("[data-go-menu]").forEach((b) => b.addEventListener("click", () => {
    el.close();
    document.getElementById("cardapio").scrollIntoView({ behavior: "smooth" });
  }));
}
