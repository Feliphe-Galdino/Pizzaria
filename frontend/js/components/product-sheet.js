import * as cart from "../core/cart.js";
import { esc, formatMoney, icon } from "../core/format.js";
import { openDialog, toast } from "../core/ui.js";
import { tagList } from "./product-card.js";
import { productMedia } from "./pizza-art.js";

const dialog = () => document.getElementById("product-sheet");

function optionBox({ type, name, value, checked, main, sub = "", price = "", disabled = false }) {
  return `<label class="option">
    <input type="${type}" name="${name}" value="${esc(value)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
    <span class="option__box">
      ${type === "radio" && name === "size" ? "" : `<span class="option__check">${icon("check")}</span>`}
      <span class="option__main">${main}${sub ? `<br><span class="option__sub">${sub}</span>` : ""}</span>
      ${price ? `<span class="option__price">${price}</span>` : ""}
    </span>
  </label>`;
}

export function openProductSheet(product, category, { onClose } = {}) {
  const el = dialog();
  const addons = category?.addons || [];
  const groups = {};
  const extras = [];
  for (const a of addons) (a.exclusive_group ? (groups[a.exclusive_group] ||= []) : extras).push(a);
  const unavailable = !product.available;
  const defaultSize = product.sizes[product.sizes.length > 2 ? product.sizes.length - 1 : 0];

  el.innerHTML = `
    <div class="sheet__scroll">
      <button class="icon-btn sheet__close" type="button" data-close aria-label="Fechar">${icon("close")}</button>
      <div class="pd__media lousa framed">${productMedia(product, { eager: true })}</div>
      ${unavailable ? `<p class="alert pd__unavailable">${icon("alert")}Este item está indisponível hoje. Que tal escolher outro sabor?</p>` : ""}
      <form class="pd__body" data-pd-form novalidate>
        <div class="pd__head">
          ${product.tags.length ? `<div class="product-card__tags">${tagList(product.tags, { limit: 5 })}</div>` : ""}
          <h2 id="pd-title">${esc(product.name)}</h2>
          <p class="pd__desc">${esc(product.description)}</p>
          ${product.ingredients ? `<p class="pd__ingredients"><strong>Ingredientes:</strong> ${esc(product.ingredients)}</p>` : ""}
        </div>

        <fieldset class="pd__group">
          <legend class="pd__group-title">${product.sizes.length > 1 ? "Tamanho" : "Porção"} <span>${product.sizes.length > 1 ? "Escolha 1" : ""}</span></legend>
          <div class="options options--row">
            ${product.sizes.map((s) => optionBox({
              type: "radio", name: "size", value: s.id, checked: s.id === defaultSize.id,
              main: esc(s.label), sub: esc(s.detail), price: formatMoney(s.price_cents), disabled: unavailable,
            })).join("")}
          </div>
        </fieldset>

        ${Object.entries(groups).map(([group, list]) => `
          <fieldset class="pd__group">
            <legend class="pd__group-title">${esc(group)} <span>Escolha 1</span></legend>
            <div class="options">
              ${optionBox({ type: "radio", name: `group:${group}`, value: "", checked: true, main: `Sem ${esc(group.toLowerCase())}`, disabled: unavailable })}
              ${list.map((a) => optionBox({ type: "radio", name: `group:${group}`, value: a.id, main: esc(a.name), price: `+ ${formatMoney(a.price_cents)}`, disabled: unavailable })).join("")}
            </div>
          </fieldset>`).join("")}

        ${extras.length ? `
          <fieldset class="pd__group">
            <legend class="pd__group-title">Adicionais <span>Opcional</span></legend>
            <div class="options">
              ${extras.map((a) => optionBox({ type: "checkbox", name: "extra", value: a.id, main: esc(a.name), price: a.price_cents ? `+ ${formatMoney(a.price_cents)}` : "Grátis", disabled: unavailable })).join("")}
            </div>
          </fieldset>` : ""}

        <div class="field">
          <label for="pd-notes">Alguma observação?</label>
          <textarea class="textarea" id="pd-notes" name="notes" maxlength="140" placeholder="Ex.: sem cebola, bem assada" ${unavailable ? "disabled" : ""}></textarea>
        </div>
      </form>
    </div>
    <div class="sheet__footer">
      <div class="stepper" role="group" aria-label="Quantidade">
        <button type="button" data-qty="-1" aria-label="Diminuir quantidade">${icon("minus")}</button>
        <output data-qty-value aria-live="polite">1</output>
        <button type="button" data-qty="1" aria-label="Aumentar quantidade">${icon("plus")}</button>
      </div>
      <button class="btn btn--split" type="button" data-add ${unavailable ? "disabled" : ""}>
        <span>Adicionar</span><span data-pd-total></span>
      </button>
    </div>`;

  const form = el.querySelector("[data-pd-form]");
  const totalEl = el.querySelector("[data-pd-total]");
  const qtyEl = el.querySelector("[data-qty-value]");
  const minus = el.querySelector('[data-qty="-1"]');
  let quantity = 1;

  const selection = () => {
    const data = new FormData(form);
    const size = product.sizes.find((s) => String(s.id) === data.get("size")) || defaultSize;
    const chosenIds = [
      ...Object.keys(groups).map((g) => data.get(`group:${g}`)).filter(Boolean),
      ...data.getAll("extra"),
    ].map(Number);
    const chosen = addons.filter((a) => chosenIds.includes(a.id));
    const unit = size.price_cents + chosen.reduce((n, a) => n + a.price_cents, 0);
    return { size, chosen, unit, notes: (data.get("notes") || "").trim() };
  };

  const refresh = () => {
    const { unit } = selection();
    totalEl.textContent = formatMoney(unit * quantity);
    qtyEl.textContent = quantity;
    minus.disabled = quantity <= 1;
  };

  form.addEventListener("change", refresh);
  el.querySelectorAll("[data-qty]").forEach((b) => b.addEventListener("click", () => {
    quantity = Math.min(20, Math.max(1, quantity + Number(b.dataset.qty)));
    refresh();
  }));
  el.querySelector("[data-close]").addEventListener("click", () => el.close());
  el.querySelector("[data-add]").addEventListener("click", () => {
    const { size, chosen, unit, notes } = selection();
    cart.add({
      product_id: product.id, slug: product.slug, name: product.name, art: product.art, image_url: product.image_url,
      size_id: size.id, size_label: size.label, addon_ids: chosen.map((a) => a.id), addon_names: chosen.map((a) => a.name),
      unit_cents: unit, quantity, notes,
    });
    el.close();
    toast(`Adicionado ao pedido: ${quantity}× ${product.name} (${size.label})`);
  });

  refresh();
  openDialog(el, { onClose });
  el.querySelector(".sheet__scroll").scrollTop = 0;
  el.querySelector("[data-close]").focus();
}
