import { esc, formatMoney, icon, parseMoney } from "../core/format.js";
import { TAGS } from "../core/labels.js";
import { setLoading, showFieldErrors, toast } from "../core/ui.js";
import { ART_OPTIONS, productMedia } from "../components/pizza-art.js";
import { openFormDialog, showFormError } from "./dialog.js";
import { adminApi } from "./session.js";

const centsToInput = (c) => (c / 100).toFixed(2).replace(".", ",");
const field = (id, label, input, hint = "") => `<div class="field"><label for="${id}">${label}</label>${input}${hint ? `<p class="hint">${hint}</p>` : ""}</div>`;
const switchHtml = (name, checked, label, attrs = "") => `<label class="switch"><input type="checkbox" name="${name}" ${checked ? "checked" : ""} ${attrs} /><span class="switch__track"></span>${label}</label>`;

/** Salva um formulário: trata carregamento, erros por campo e erro geral. */
async function save(el, request, success) {
  const btn = el.querySelector("[data-save]");
  const form = el.querySelector("[data-dialog-form]");
  showFormError(el, "");
  setLoading(btn, true);
  try {
    await request();
    el.close();
    toast(success);
    return true;
  } catch (err) {
    if (!(err.fields && showFieldErrors(form, err.fields))) showFormError(el, err.message);
    return false;
  } finally {
    if (btn.isConnected) setLoading(btn, false);
  }
}

async function confirmDelete(message, request, done) {
  if (!window.confirm(message)) return;
  try { await request(); toast("Excluído"); done(); } catch (err) { toast(err.message, { type: "error" }); }
}

/* ================= Produtos ================= */
export async function renderProducts(root) {
  root.innerHTML = `<div class="admin-head"><h1>Produtos</h1><button class="btn" type="button" data-new>${icon("plus")}Novo produto</button></div>
    <div class="search"><label class="visually-hidden" for="p-search">Buscar produto</label>${icon("search")}<input class="input" id="p-search" type="search" placeholder="Buscar produto" /></div>
    <div data-list><div class="skeleton skeleton--card"></div></div>`;

  let categories = [], products = [];
  const draw = () => {
    const q = root.querySelector("#p-search").value.toLowerCase();
    root.querySelector("[data-list]").innerHTML = categories.map((c) => {
      const list = products.filter((p) => p.category_id === c.id && p.name.toLowerCase().includes(q));
      if (!list.length) return "";
      return `<h2 class="group-title">${esc(c.name)}${c.active ? "" : ' <span class="tag">categoria oculta</span>'}</h2>
        <ul class="list">${list.map((p) => `
          <li class="panel row">
            <div class="thumb">${productMedia(p)}</div>
            <div class="row__grow"><strong>${esc(p.name)}</strong>
              <p class="muted">${p.sizes.map((s) => `${esc(s.label)} ${formatMoney(s.price_cents)}`).join(" / ")}</p></div>
            ${switchHtml("available", p.available, p.available ? "Disponível" : "Indisponível", `data-toggle="${p.id}"`)}
            <button class="btn btn--ghost btn--sm" type="button" data-edit="${p.id}">Editar</button>
          </li>`).join("")}</ul>`;
    }).join("") || `<p class="empty">Nenhum produto encontrado.</p>`;
  };
  const load = async () => {
    [categories, products] = await Promise.all([adminApi("/admin/categories"), adminApi("/admin/products")]);
    draw();
  };

  root.querySelector("#p-search").addEventListener("input", draw);
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-new]")) productForm(null, categories, load);
    const ed = e.target.closest("[data-edit]");
    if (ed) productForm(products.find((p) => p.id === Number(ed.dataset.edit)), categories, load);
  });
  root.addEventListener("change", async (e) => {
    const t = e.target.closest("[data-toggle]");
    if (!t) return;
    t.disabled = true;
    try {
      const p = await adminApi(`/admin/products/${t.dataset.toggle}/availability`, { method: "PATCH", body: { available: t.checked } });
      products = products.map((x) => (x.id === p.id ? p : x));
      t.parentElement.lastChild.textContent = p.available ? "Disponível" : "Indisponível";
      toast(`${p.name} ${p.available ? "disponível" : "marcado como indisponível"}`);
    } catch (err) {
      t.checked = !t.checked;
      toast(err.message, { type: "error" });
    } finally { t.disabled = false; }
  });
  try { await load(); } catch (err) { if (err.status !== 401) toast(err.message, { type: "error" }); }
}

function sizeRow(s = { label: "", detail: "", price_cents: 0 }, i = 0) {
  return `<div class="size-row" data-size>
    ${field(`sz-l-${i}`, "Tamanho", `<input class="input" id="sz-l-${i}" name="sizes[${i}].label" value="${esc(s.label)}" maxlength="30" placeholder="Grande" />`)}
    ${field(`sz-d-${i}`, "Detalhe", `<input class="input" id="sz-d-${i}" name="sizes[${i}].detail" value="${esc(s.detail)}" maxlength="40" placeholder="8 fatias" />`)}
    ${field(`sz-p-${i}`, "Preço (R$)", `<input class="input" id="sz-p-${i}" name="sizes[${i}].price_cents" value="${s.price_cents ? centsToInput(s.price_cents) : ""}" inputmode="decimal" placeholder="64,90" />`)}
    <button class="icon-btn" type="button" data-remove-size aria-label="Remover tamanho">${icon("trash")}</button>
  </div>`;
}

function productForm(p, categories, reload) {
  const isNew = !p;
  p ||= { name: "", category_id: categories[0]?.id, description: "", ingredients: "", art: "margherita", image_url: "", tags: [], available: true, position: 0, sizes: [{ label: "", detail: "", price_cents: 0 }] };
  const el = openFormDialog(isNew ? "Novo produto" : `Editar ${esc(p.name)}`, `
    ${field("pf-name", "Nome", `<input class="input" id="pf-name" name="name" value="${esc(p.name)}" maxlength="80" required />`)}
    ${field("pf-cat", "Categoria", `<select class="select" id="pf-cat" name="category_id">${categories.map((c) => `<option value="${c.id}" ${c.id === p.category_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>`)}
    ${field("pf-desc", "Descrição", `<textarea class="textarea" id="pf-desc" name="description" maxlength="400">${esc(p.description)}</textarea>`)}
    ${field("pf-ingr", "Ingredientes", `<input class="input" id="pf-ingr" name="ingredients" value="${esc(p.ingredients)}" maxlength="400" />`)}
    <fieldset class="field"><legend>Tamanhos e preços</legend><div class="size-list" data-sizes>${p.sizes.map(sizeRow).join("")}</div>
      <button class="btn btn--ghost btn--sm" type="button" data-add-size>${icon("plus")}Adicionar tamanho</button></fieldset>
    <fieldset class="field"><legend>Etiquetas</legend><div class="checks">
      ${Object.entries(TAGS).map(([k, t]) => `<label><input type="checkbox" name="tags" value="${k}" ${p.tags.includes(k) ? "checked" : ""} />${t.label}</label>`).join("")}</div></fieldset>
    <div class="art-preview"><div class="thumb" data-art-preview>${productMedia(p)}</div>
      <div class="row__grow">${field("pf-art", "Ilustração", `<select class="select" id="pf-art" name="art">${ART_OPTIONS.map((a) => `<option ${a === p.art ? "selected" : ""}>${a}</option>`).join("")}</select>`)}</div></div>
    ${field("pf-img", "Foto (opcional)", `<input class="input" id="pf-img" name="image_url" value="${esc(p.image_url)}" placeholder="https://... ou /assets/fotos/margherita.webp" />`, "Quando preenchida, a foto substitui a ilustração.")}
    <div class="grid-2">
      ${field("pf-pos", "Ordem no cardápio", `<input class="input" id="pf-pos" name="position" type="number" min="0" value="${p.position}" />`)}
      <div class="field"><span class="hint">&nbsp;</span>${switchHtml("available", p.available, "Disponível")}</div>
    </div>`, { submitLabel: isNew ? "Criar produto" : "Salvar alterações", danger: isNew ? "" : "Excluir" });

  const form = el.querySelector("[data-dialog-form]");
  const renumber = () => el.querySelectorAll("[data-size]").forEach((row, i) => {
    row.querySelectorAll("input").forEach((inp) => { inp.name = inp.name.replace(/sizes\[\d+\]/, `sizes[${i}]`); });
  });
  el.querySelector("[data-add-size]").addEventListener("click", () => {
    el.querySelector("[data-sizes]").insertAdjacentHTML("beforeend", sizeRow(undefined, Date.now()));
    renumber();
  });
  el.querySelector("[data-sizes]").addEventListener("click", (e) => {
    if (e.target.closest("[data-remove-size]") && el.querySelectorAll("[data-size]").length > 1) {
      e.target.closest("[data-size]").remove(); renumber();
    }
  });
  const preview = () => { el.querySelector("[data-art-preview]").innerHTML = productMedia({ art: form.art.value, image_url: /^https:\/\/|^\//.test(form.image_url.value) ? form.image_url.value : "", id: p.id }); };
  form.art.addEventListener("change", preview);
  form.image_url.addEventListener("change", preview);

  el.querySelector("[data-save]").addEventListener("click", () => {
    const sizes = [...el.querySelectorAll("[data-size]")].map((row) => {
      const [label, detail, price] = row.querySelectorAll("input");
      return { label: label.value, detail: detail.value, price_cents: parseMoney(price.value) };
    });
    const bad = {};
    sizes.forEach((s, i) => { if (!Number.isInteger(s.price_cents)) bad[`sizes[${i}].price_cents`] = "Digite o preço, ex.: 64,90."; });
    if (showFieldErrors(form, bad)) return;
    const body = {
      name: form.name.value, category_id: Number(form.category_id.value), description: form.description.value,
      ingredients: form.ingredients.value, art: form.art.value, image_url: form.image_url.value,
      tags: [...form.querySelectorAll('[name="tags"]:checked')].map((c) => c.value),
      available: form.available.checked, position: Number(form.position.value) || 0, sizes,
    };
    save(el, () => adminApi(isNew ? "/admin/products" : `/admin/products/${p.id}`, { method: isNew ? "POST" : "PUT", body }),
      isNew ? "Produto criado" : "Alterações salvas").then((ok) => ok && reload());
  });
  el.querySelector("[data-danger]")?.addEventListener("click", () => {
    el.close();
    confirmDelete(`Excluir "${p.name}"? Pedidos antigos continuam com o nome registrado.`, () => adminApi(`/admin/products/${p.id}`, { method: "DELETE" }), reload);
  });
}

/* ================= Categorias ================= */
export async function renderCategories(root) {
  root.innerHTML = `<div class="admin-head"><h1>Categorias</h1><button class="btn" type="button" data-new>${icon("plus")}Nova categoria</button></div><ul class="list" data-list></ul>`;
  let categories = [];
  const load = async () => {
    categories = await adminApi("/admin/categories");
    root.querySelector("[data-list]").innerHTML = categories.map((c) => `
      <li class="panel row">
        <div class="row__grow"><strong>${esc(c.name)}</strong> <span class="muted">(${c.product_count} produtos, ordem ${c.position})</span>
          <p class="muted">${esc(c.description)}</p></div>
        <span class="tag ${c.active ? "tag--vegetariano" : ""}">${c.active ? "Visível no site" : "Oculta"}</span>
        <button class="btn btn--ghost btn--sm" type="button" data-edit="${c.id}">Editar</button>
      </li>`).join("") || `<li class="empty">Crie a primeira categoria do cardápio.</li>`;
  };
  root.addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit]");
    if (!e.target.closest("[data-new]") && !ed) return;
    const c = ed ? categories.find((x) => x.id === Number(ed.dataset.edit)) : null;
    const v = c || { name: "", description: "", position: categories.length, active: true };
    const el = openFormDialog(c ? "Editar categoria" : "Nova categoria", `
      ${field("cf-name", "Nome", `<input class="input" id="cf-name" name="name" value="${esc(v.name)}" maxlength="60" />`)}
      ${field("cf-desc", "Descrição", `<textarea class="textarea" id="cf-desc" name="description" maxlength="240">${esc(v.description)}</textarea>`)}
      <div class="grid-2">${field("cf-pos", "Ordem", `<input class="input" id="cf-pos" name="position" type="number" min="0" value="${v.position}" />`)}
      <div class="field"><span class="hint">&nbsp;</span>${switchHtml("active", v.active, "Visível no site")}</div></div>`,
      { danger: c ? "Excluir" : "" });
    const form = el.querySelector("[data-dialog-form]");
    el.querySelector("[data-save]").addEventListener("click", () => {
      const body = { name: form.name.value, description: form.description.value, position: Number(form.position.value) || 0, active: form.active.checked };
      save(el, () => adminApi(c ? `/admin/categories/${c.id}` : "/admin/categories", { method: c ? "PUT" : "POST", body }), "Categoria salva").then((ok) => ok && load());
    });
    el.querySelector("[data-danger]")?.addEventListener("click", () => {
      el.close();
      confirmDelete(`Excluir a categoria "${c.name}"?`, () => adminApi(`/admin/categories/${c.id}`, { method: "DELETE" }), load);
    });
  });
  try { await load(); } catch (err) { if (err.status !== 401) toast(err.message, { type: "error" }); }
}

/* ================= Adicionais ================= */
export async function renderAddons(root) {
  root.innerHTML = `<div class="admin-head"><h1>Adicionais e bordas</h1><button class="btn" type="button" data-new>${icon("plus")}Novo adicional</button></div>
    <p class="muted">Adicionais com o mesmo <strong>grupo exclusivo</strong> (ex.: Borda) permitem escolher só uma opção.</p><ul class="list" data-list></ul>`;
  let addons = [], categories = [];
  const load = async () => {
    [addons, categories] = await Promise.all([adminApi("/admin/addons"), adminApi("/admin/categories")]);
    const names = Object.fromEntries(categories.map((c) => [c.id, c.name]));
    root.querySelector("[data-list]").innerHTML = addons.map((a) => `
      <li class="panel row">
        <div class="row__grow"><strong>${esc(a.name)}</strong> ${a.exclusive_group ? `<span class="tag">${esc(a.exclusive_group)}</span>` : ""}
          <p class="muted">${formatMoney(a.price_cents)} em ${a.category_ids.map((id) => esc(names[id])).join(", ") || "nenhuma categoria"}</p></div>
        <span class="tag ${a.available ? "tag--vegetariano" : ""}">${a.available ? "Disponível" : "Indisponível"}</span>
        <button class="btn btn--ghost btn--sm" type="button" data-edit="${a.id}">Editar</button>
      </li>`).join("") || `<li class="empty">Nenhum adicional cadastrado.</li>`;
  };
  root.addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit]");
    if (!e.target.closest("[data-new]") && !ed) return;
    const a = ed ? addons.find((x) => x.id === Number(ed.dataset.edit)) : null;
    const v = a || { name: "", price_cents: 0, exclusive_group: "", available: true, category_ids: [], position: 0 };
    const el = openFormDialog(a ? "Editar adicional" : "Novo adicional", `
      ${field("af-name", "Nome", `<input class="input" id="af-name" name="name" value="${esc(v.name)}" maxlength="60" />`)}
      <div class="grid-2">
        ${field("af-price", "Preço (R$)", `<input class="input" id="af-price" name="price_cents" inputmode="decimal" value="${centsToInput(v.price_cents)}" />`)}
        ${field("af-group", "Grupo exclusivo", `<input class="input" id="af-group" name="exclusive_group" value="${esc(v.exclusive_group)}" maxlength="30" placeholder="Borda" />`)}
      </div>
      <fieldset class="field"><legend>Vale para as categorias</legend><div class="checks">
        ${categories.map((c) => `<label><input type="checkbox" name="category_ids" value="${c.id}" ${v.category_ids.includes(c.id) ? "checked" : ""} />${esc(c.name)}</label>`).join("")}</div></fieldset>
      ${switchHtml("available", v.available, "Disponível")}`, { danger: a ? "Excluir" : "" });
    const form = el.querySelector("[data-dialog-form]");
    el.querySelector("[data-save]").addEventListener("click", () => {
      const price = parseMoney(form.price_cents.value);
      if (!Number.isInteger(price) && showFieldErrors(form, { price_cents: "Digite o preço, ex.: 12,00." })) return;
      const body = {
        name: form.name.value, price_cents: price, exclusive_group: form.exclusive_group.value, available: form.available.checked,
        position: v.position, category_ids: [...form.querySelectorAll('[name="category_ids"]:checked')].map((c) => Number(c.value)),
      };
      save(el, () => adminApi(a ? `/admin/addons/${a.id}` : "/admin/addons", { method: a ? "PUT" : "POST", body }), "Adicional salvo").then((ok) => ok && load());
    });
    el.querySelector("[data-danger]")?.addEventListener("click", () => {
      el.close();
      confirmDelete(`Excluir "${a.name}"?`, () => adminApi(`/admin/addons/${a.id}`, { method: "DELETE" }), load);
    });
  });
  try { await load(); } catch (err) { if (err.status !== 401) toast(err.message, { type: "error" }); }
}
