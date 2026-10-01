import { COMBO_CATEGORY, PREMIUM_TAG, comboItems, comboSavings, flavorProduct, itemPrice } from "../core/combos.js";
import { esc, formatMoney, icon, parseMoney, plural } from "../core/format.js";
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

/** Interruptor "Disponível" das listas: salva na hora e desfaz se der erro. */
async function toggleAvailability(input, onSaved) {
  input.disabled = true;
  try {
    const p = await adminApi(`/admin/products/${input.dataset.toggle}/availability`, { method: "PATCH", body: { available: input.checked } });
    onSaved(p);
    input.parentElement.lastChild.textContent = p.available ? "Disponível" : "Indisponível";
    toast(`${p.name} ${p.available ? "disponível" : "marcado como indisponível"}`);
  } catch (err) {
    input.checked = !input.checked;
    toast(err.message, { type: "error" });
  } finally { input.disabled = false; }
}

/* ================= Produtos ================= */
export async function renderProducts(root) {
  root.innerHTML = `<div class="admin-head"><h1>Produtos</h1><button class="btn" type="button" data-new>${icon("plus")}Novo produto</button></div>
    <div class="search"><label class="visually-hidden" for="p-search">Buscar produto</label>${icon("search")}<input class="input" id="p-search" type="search" placeholder="Buscar produto" /></div>
    <div data-list><div class="skeleton skeleton--card"></div></div>`;

  let categories = [], products = [];
  const draw = () => {
    const q = root.querySelector("#p-search").value.toLowerCase();
    const hasCombos = categories.some((c) => c.slug === COMBO_CATEGORY);
    root.querySelector("[data-list]").innerHTML = (hasCombos ? `<p class="muted">Os combos são editados na aba <a href="#combos">Combos</a>.</p>` : "") +
      (categories.filter((c) => c.slug !== COMBO_CATEGORY).map((c) => {
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
    }).join("") || `<p class="empty">Nenhum produto encontrado.</p>`);
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
  root.addEventListener("change", (e) => {
    const t = e.target.closest("[data-toggle]");
    if (t) toggleAvailability(t, (p) => { products = products.map((x) => (x.id === p.id ? p : x)); });
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

function productForm(p, allCategories, reload) {
  const isNew = !p;
  const categories = allCategories.filter((c) => c.slug !== COMBO_CATEGORY);
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

/* ================= Combos ================= */
function savingsText(s) {
  if (!s) return "Não deu para calcular a economia: confira as pizzas escolhidas.";
  if (s.save <= 0) return `Atenção: separado sai ${formatMoney(s.separate)}, então o combo não está saindo mais barato.`;
  return `Separado a partir de ${formatMoney(s.separate)}. O cliente economiza ${formatMoney(s.save)}${s.varies ? " ou mais" : ""} (${Math.round((s.save / s.separate) * 100)}%).`;
}

export async function renderCombos(root) {
  root.innerHTML = `<div class="admin-head"><h1>Combos</h1><button class="btn" type="button" data-new hidden>${icon("plus")}Novo combo</button></div>
    <p class="muted">Cada combo tem itens fixos e uma pizza que o cliente escolhe. O site mostra quanto ele economiza em relação a pedir tudo separado.</p>
    <div data-list><div class="skeleton skeleton--card"></div></div>`;

  let categories = [], products = [], comboCat = null;
  const load = async () => {
    [categories, products] = await Promise.all([adminApi("/admin/categories"), adminApi("/admin/products")]);
    comboCat = categories.find((c) => c.slug === COMBO_CATEGORY) || null;
    root.querySelector("[data-new]").hidden = !comboCat;
    const list = root.querySelector("[data-list]");
    if (!comboCat) {
      list.innerHTML = `<div class="panel empty"><p>A categoria de combos não existe no cardápio.</p>
        <button class="btn" type="button" data-create-cat>${icon("plus")}Criar categoria Combos</button></div>`;
      return;
    }
    const others = products.filter((p) => p.category_id !== comboCat.id);
    const combos = products.filter((p) => p.category_id === comboCat.id);
    list.innerHTML = (comboCat.active ? "" : `<p class="alert">${icon("alert")}A categoria Combos está oculta no site. Para mostrar, ative em Categorias.</p>`) +
      (combos.length ? `<ul class="list">${combos.map((p) => `
        <li class="panel row">
          <div class="thumb">${productMedia(p)}</div>
          <div class="row__grow"><strong>${esc(p.name)}</strong>
            <p class="muted">${formatMoney(p.price_from_cents)} · ${plural(p.sizes.length, "pizza", "pizzas")} à escolha · cartão ${p.tags.includes(PREMIUM_TAG) ? "especial" : "custo-benefício"}</p>
            <p class="muted">${esc(savingsText(comboSavings(p, others)))}</p></div>
          ${switchHtml("available", p.available, p.available ? "Disponível" : "Indisponível", `data-toggle="${p.id}"`)}
          <button class="btn btn--ghost btn--sm" type="button" data-edit="${p.id}">Editar</button>
        </li>`).join("")}</ul>` : `<p class="empty">Nenhum combo ainda. Crie o primeiro em "Novo combo".</p>`);
  };

  root.addEventListener("click", async (e) => {
    const ed = e.target.closest("[data-edit]");
    if (e.target.closest("[data-new]") || ed) {
      comboForm(ed ? products.find((p) => p.id === Number(ed.dataset.edit)) : null, { comboCat, categories, products }, load);
      return;
    }
    const create = e.target.closest("[data-create-cat]");
    if (!create) return;
    setLoading(create, true);
    try {
      await adminApi("/admin/categories", { method: "POST", body: {
        name: "Combos", position: 0, active: true,
        description: "Pão de alho, focaccia e pizza grande juntos, por um preço menor do que pedir cada item separado." } });
      toast("Categoria Combos criada");
      await load();
    } catch (err) {
      toast(err.message, { type: "error" });
      setLoading(create, false);
    }
  });
  root.addEventListener("change", (e) => {
    const t = e.target.closest("[data-toggle]");
    if (t) toggleAvailability(t, (p) => { products = products.map((x) => (x.id === p.id ? p : x)); });
  });
  try { await load(); } catch (err) { if (err.status !== 401) toast(err.message, { type: "error" }); }
}

function comboForm(p, { comboCat, categories, products }, reload) {
  const isNew = !p;
  const others = products.filter((x) => x.category_id !== comboCat.id);
  const groups = categories.filter((c) => c.id !== comboCat.id)
    .map((c) => ({ c, list: others.filter((x) => x.category_id === c.id) }))
    .filter((g) => g.list.length);
  p ||= { name: "", description: "", ingredients: "", art: "combo-classico", image_url: "", tags: [], available: true,
          position: products.filter((x) => x.category_id === comboCat.id).length, sizes: [] };
  const chosen = new Set(p.sizes.map((s) => flavorProduct(s, others)?.id).filter(Boolean));
  const missing = p.sizes.filter((s) => !flavorProduct(s, others)).map((s) => s.label);

  const el = openFormDialog(isNew ? "Novo combo" : `Editar ${esc(p.name)}`, `
    ${field("cb-name", "Nome", `<input class="input" id="cb-name" name="name" value="${esc(p.name)}" maxlength="80" placeholder="Combo Família" />`)}
    ${field("cb-desc", "Descrição", `<textarea class="textarea" id="cb-desc" name="description" maxlength="400">${esc(p.description)}</textarea>`)}
    ${field("cb-items", "Itens inclusos", `<textarea class="textarea" id="cb-items" name="items" rows="4">${esc(comboItems(p).join("\n"))}</textarea>`,
      "Um item por linha, do jeito que aparece no cartão. Para itens do cardápio, comece pelo nome do produto (ex.: Focaccia de alecrim (meia, serve 2)) para o site calcular a economia.")}
    <fieldset class="field"><legend>Pizzas que o cliente pode escolher</legend>
      ${missing.length ? `<p class="hint">Saíram do cardápio e serão removidas do combo ao salvar: ${esc(missing.join(", "))}.</p>` : ""}
      ${groups.map(({ c, list }) => `<p class="combo-form__group">${esc(c.name)}</p><div class="checks">
        ${list.map((x) => `<label><input type="checkbox" name="flavors" value="${x.id}" ${chosen.has(x.id) ? "checked" : ""} />${esc(x.name)}</label>`).join("")}</div>`).join("")}
    </fieldset>
    <div class="grid-2">
      ${field("cb-size", "Tamanho da pizza", `<select class="select" id="cb-size" name="pizza_size"></select>`)}
      ${field("cb-price", "Preço do combo (R$)", `<input class="input" id="cb-price" name="price" inputmode="decimal" value="${p.sizes.length ? centsToInput(p.sizes[0].price_cents) : ""}" placeholder="89,90" />`)}
    </div>
    <div class="combo-preview" data-preview aria-live="polite"></div>
    <fieldset class="field"><legend>Estilo do cartão no site</legend><div class="checks">
      <label><input type="radio" name="style" value="value" ${p.tags.includes(PREMIUM_TAG) ? "" : "checked"} />Custo-benefício (claro, economia em verde)</label>
      <label><input type="radio" name="style" value="${PREMIUM_TAG}" ${p.tags.includes(PREMIUM_TAG) ? "checked" : ""} />Especial (lousa e dourado)</label>
    </div></fieldset>
    <div class="art-preview"><div class="thumb" data-art-preview>${productMedia(p)}</div>
      <div class="row__grow">${field("cb-art", "Ilustração", `<select class="select" id="cb-art" name="art">${ART_OPTIONS.map((a) => `<option ${a === p.art ? "selected" : ""}>${a}</option>`).join("")}</select>`)}</div></div>
    <div class="grid-2">
      ${field("cb-pos", "Ordem no cardápio", `<input class="input" id="cb-pos" name="position" type="number" min="0" value="${p.position}" />`)}
      <div class="field"><span class="hint">&nbsp;</span>${switchHtml("available", p.available, "Disponível")}</div>
    </div>`, { submitLabel: isNew ? "Criar combo" : "Salvar alterações", danger: isNew ? "" : "Excluir" });

  const form = el.querySelector("[data-dialog-form]");
  const picked = () => [...form.querySelectorAll('[name="flavors"]:checked')].map((b) => others.find((x) => x.id === Number(b.value)));
  const lines = () => form.items.value.split("\n").map((s) => s.trim()).filter(Boolean);

  // Só os tamanhos que todas as pizzas marcadas têm.
  const refreshSizes = () => {
    const flavors = picked();
    const select = form.pizza_size;
    const keep = select.value || p.sizes[0]?.detail || "";
    const labels = flavors.length
      ? flavors[0].sizes.map((s) => s.label).filter((l) => flavors.every((f) => f.sizes.some((s) => s.label === l)))
      : [];
    select.innerHTML = labels.length
      ? labels.map((l) => `<option>${esc(l)}</option>`).join("")
      : `<option value="">${flavors.length ? "Sem tamanho em comum" : "Escolha as pizzas"}</option>`;
    select.disabled = !labels.length;
    select.value = labels.includes(keep) ? keep : labels.includes("Grande") ? "Grande" : labels[labels.length - 1] || "";
  };

  const preview = () => {
    const box = el.querySelector("[data-preview]");
    const flavors = picked();
    const price = parseMoney(form.price.value);
    if (!flavors.length || !form.pizza_size.value || !Number.isInteger(price) || price <= 0) {
      box.className = "combo-preview is-empty";
      box.innerHTML = `<p>Escolha as pizzas, o tamanho e o preço para ver quanto o cliente economiza.</p>`;
      return;
    }
    const draft = { ingredients: lines().join("; "), sizes: flavors.map((f) => ({ label: f.name, detail: form.pizza_size.value, price_cents: price })) };
    const s = comboSavings(draft, others);
    const outside = lines().filter((l) => itemPrice(l, others) === null);
    box.className = `combo-preview${!s || s.save <= 0 ? " is-warning" : ""}`;
    box.innerHTML = `<p><strong>${esc(savingsText(s))}</strong></p>` +
      (outside.length ? `<p class="hint">Fora da conta, por não serem produtos do cardápio: ${esc(outside.join(" · "))}</p>` : "");
  };

  form.addEventListener("change", (e) => {
    if (e.target.name === "flavors") refreshSizes();
    if (e.target.name === "art") el.querySelector("[data-art-preview]").innerHTML = productMedia({ art: form.art.value, image_url: p.image_url, id: p.id });
    preview();
  });
  form.addEventListener("input", preview);
  refreshSizes();
  preview();

  el.querySelector("[data-save]").addEventListener("click", () => {
    const flavors = picked();
    const price = parseMoney(form.price.value);
    const ingredients = lines().join("; ");
    const tooLong = flavors.find((f) => f.name.length > 30);
    const bad = {};
    if (!flavors.length) bad.flavors = "Escolha pelo menos uma pizza.";
    else if (flavors.length > 12) bad.flavors = "Escolha no máximo 12 pizzas.";
    else if (tooLong) bad.flavors = `O nome "${tooLong.name}" passa de 30 letras. Encurte o nome do produto para usá-lo em combos.`;
    else if (!form.pizza_size.value) bad.pizza_size = "As pizzas marcadas não têm um tamanho em comum.";
    if (!Number.isInteger(price) || price <= 0) bad.price = "Digite o preço, ex.: 89,90.";
    if (lines().some((l) => l.includes(";"))) bad.items = "Use uma linha por item, sem ponto e vírgula.";
    else if (ingredients.length > 400) bad.items = "A lista de itens passou de 400 letras. Resuma um pouco.";
    if (showFieldErrors(form, bad)) return;
    const body = {
      name: form.name.value, category_id: comboCat.id, description: form.description.value, ingredients,
      art: form.art.value, image_url: p.image_url || "",
      tags: [...p.tags.filter((t) => t !== PREMIUM_TAG), ...(form.querySelector('[name="style"]:checked').value === PREMIUM_TAG ? [PREMIUM_TAG] : [])],
      available: form.available.checked, position: Number(form.position.value) || 0,
      sizes: flavors.map((f) => ({ label: f.name, detail: form.pizza_size.value, price_cents: price })),
    };
    save(el, () => adminApi(isNew ? "/admin/products" : `/admin/products/${p.id}`, { method: isNew ? "POST" : "PUT", body }),
      isNew ? "Combo criado" : "Combo salvo").then((ok) => ok && reload());
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
