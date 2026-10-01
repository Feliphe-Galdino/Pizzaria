import { comboItems } from "../core/combos.js";
import { esc, formatMoney, icon } from "../core/format.js";
import { TAGS } from "../core/labels.js";
import { productMedia } from "./pizza-art.js";

export function tagList(tags, { limit = 3 } = {}) {
  return tags.slice(0, limit).map((t) => TAGS[t]
    ? `<span class="tag tag--${esc(t)}">${icon(TAGS[t].icon)}<span class="tag__label">${esc(TAGS[t].label)}</span></span>` : "").join("");
}

export function productCard(product) {
  const featured = product.tags.includes("mais-pedido");
  const otherTags = product.tags.filter((t) => t !== "mais-pedido");
  const single = product.sizes.length === 1;
  const unavailable = !product.available;

  return `
  <article class="product-card is-framed-media${unavailable ? " is-unavailable" : ""}" data-search="${esc(`${product.name} ${product.description} ${product.ingredients}`)}">
    <div class="product-card__media lousa framed">
      ${featured ? `<span class="product-card__badge">${tagList(["mais-pedido"])}</span>` : ""}
      ${productMedia(product)}
      ${unavailable ? `<span class="sold-out">Indisponível hoje</span>` : ""}
    </div>
    <div class="product-card__body">
      <h4 class="product-card__title"><a href="#/produto/${esc(product.slug)}" data-product-link="${esc(product.slug)}">${esc(product.name)}</a></h4>
      <p class="product-card__desc">${esc(product.description)}</p>
      ${otherTags.length ? `<div class="product-card__tags">${tagList(otherTags)}</div>` : ""}
      <div class="product-card__foot">
        <p class="price">
          <small>${single ? esc(product.sizes[0].detail || product.sizes[0].label) : "a partir de"}</small>
          <strong>${formatMoney(product.price_from_cents)}</strong>
        </p>
        <button class="add-btn" type="button" data-quick-add="${esc(product.slug)}"
          aria-label="${unavailable ? `${esc(product.name)} indisponível` : `Adicionar ${esc(product.name)}`}" ${unavailable ? "disabled" : ""}>
          ${icon("plus")}
        </button>
      </div>
    </div>
  </article>`;
}

/** Cartão de combo: lista o que vem incluso e a economia em relação a pedir separado. */
export function comboCard(product, { premium = false, savings = null } = {}) {
  const items = comboItems(product);
  const flavors = product.sizes.map((s) => s.label).join(" ");
  const uniform = product.sizes.every((s) => s.price_cents === product.price_from_cents);
  const unavailable = !product.available;

  return `
  <article class="product-card combo-card combo-card--${premium ? "premium" : "value"}${unavailable ? " is-unavailable" : ""}" data-search="${esc(`${product.name} ${product.description} ${product.ingredients} ${flavors}`)}">
    <div class="combo-card__media lousa framed">
      ${productMedia(product)}
      ${unavailable ? `<span class="sold-out">Indisponível hoje</span>` : ""}
    </div>
    <div class="product-card__body">
      <span class="combo-card__badge">${icon(premium ? "spark" : "star")}${premium ? "Experiência especial" : "Melhor custo-benefício"}</span>
      <h4 class="product-card__title"><a href="#/produto/${esc(product.slug)}" data-product-link="${esc(product.slug)}">${esc(product.name)}</a></h4>
      <p class="product-card__desc">${esc(product.description)}</p>
      <ul class="combo-card__items">${items.map((i) => `<li>${icon("check")}<span>${esc(i)}</span></li>`).join("")}</ul>
      ${savings ? `<p class="combo-card__save">Você economiza ${formatMoney(savings.save)}${savings.varies ? " ou mais" : ""}</p>` : ""}
      <div class="product-card__foot">
        <p class="price">
          <small>${savings ? `Separado <s>${formatMoney(savings.separate)}</s>` : uniform ? "Preço do combo" : "a partir de"}</small>
          <strong>${formatMoney(product.price_from_cents)}</strong>
        </p>
        <button class="add-btn" type="button" data-quick-add="${esc(product.slug)}"
          aria-label="${unavailable ? `${esc(product.name)} indisponível` : `Montar ${esc(product.name)}`}" ${unavailable ? "disabled" : ""}>
          ${icon("plus")}
        </button>
      </div>
    </div>
  </article>`;
}
