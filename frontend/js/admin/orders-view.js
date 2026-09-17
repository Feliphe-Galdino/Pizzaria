import { esc, formatMoney, icon } from "../core/format.js";
import { FULFILLMENT, ORDER_STATUS, PAYMENT } from "../core/labels.js";
import { toast } from "../core/ui.js";
import { adminApi } from "./session.js";

const FILTERS = [["", "Todos"], ["received", "Novos"], ["preparing", "No forno"], ["ready", "Prontos"], ["out_for_delivery", "Em entrega"], ["completed", "Concluídos"], ["canceled", "Cancelados"]];
let filter = "";
let knownIds = null;
let timer = null;

const time = (sqlDate) => new Date(`${sqlDate.replace(" ", "T")}Z`).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function orderCard(o, isNew) {
  const a = o.address;
  return `<li class="panel order${isNew ? " is-new" : ""}" data-status="${o.status}">
    <div class="row">
      <span class="order__code">${esc(o.code)}</span>
      <span class="muted">${time(o.created_at)}</span>
      <span class="tag">${FULFILLMENT[o.fulfillment]}</span>
      <span class="row__grow"></span>
      <span class="order__total">${formatMoney(o.total_cents)}</span>
    </div>
    <div class="row">
      <div class="row__grow">
        <strong>${esc(o.customer_name)}</strong>
        <a href="https://wa.me/55${esc(o.phone)}" target="_blank" rel="noopener">${icon("whatsapp")} ${esc(o.phone)}</a>
        ${a ? `<p class="muted">${esc(a.street)}, ${esc(a.number)} ${a.complement ? `(${esc(a.complement)})` : ""}, ${esc(a.district)}${a.reference ? `. Ref.: ${esc(a.reference)}` : ""}</p>` : ""}
        <p class="muted">Pagamento: ${PAYMENT[o.payment_method]}${o.change_for_cents ? `, troco para ${formatMoney(o.change_for_cents)}` : ""}${o.delivery_fee_cents ? `. Taxa de entrega ${formatMoney(o.delivery_fee_cents)}` : ""}</p>
      </div>
      <label class="visually-hidden" for="st-${o.id}">Status do pedido ${esc(o.code)}</label>
      <select class="select" id="st-${o.id}" data-order-status="${o.id}">
        ${Object.entries(ORDER_STATUS).map(([k, v]) => `<option value="${k}" ${k === o.status ? "selected" : ""}>${v}</option>`).join("")}
      </select>
    </div>
    <ul class="order__items">
      ${o.items.map((i) => `<li>${i.quantity}× ${esc(i.product_name)} (${esc(i.size_label)})${i.addons.length ? ` com ${esc(i.addons.map((x) => x.name).join(", "))}` : ""}${i.notes ? `. <em>Obs.: ${esc(i.notes)}</em>` : ""} <span class="muted">${formatMoney(i.line_total_cents)}</span></li>`).join("")}
    </ul>
    ${o.notes ? `<p class="alert alert--info">${icon("alert")}${esc(o.notes)}</p>` : ""}
  </li>`;
}

export async function renderOrders(root) {
  clearInterval(timer);
  root.innerHTML = `
    <div class="admin-head"><h1>Pedidos</h1><button class="btn btn--ghost btn--sm" type="button" data-refresh>Atualizar agora</button></div>
    <div class="stats" data-stats></div>
    <div class="filters" role="group" aria-label="Filtrar por status">
      ${FILTERS.map(([k, v]) => `<button class="chip" type="button" data-filter="${k}" ${k === filter ? 'aria-current="true"' : ""}>${v}</button>`).join("")}
    </div>
    <ul class="list" data-orders><li class="skeleton skeleton--card"></li></ul>`;

  const load = async () => {
    try {
      const [orders, s] = await Promise.all([
        adminApi(`/admin/orders${filter ? `?status=${filter}` : ""}`),
        adminApi("/admin/summary"),
      ]);
      root.querySelector("[data-stats]").innerHTML = `
        <div class="stat">Pedidos hoje<strong>${s.orders_today}</strong></div>
        <div class="stat">Faturamento hoje<strong>${formatMoney(s.revenue_today_cents)}</strong></div>
        <div class="stat">Aguardando ou no forno<strong>${s.in_progress}</strong></div>`;
      const ids = new Set(orders.map((o) => o.id));
      const fresh = knownIds ? orders.filter((o) => !knownIds.has(o.id)) : [];
      if (fresh.length) toast(`${fresh.length} pedido(s) novo(s) chegaram`);
      knownIds = knownIds ? new Set([...knownIds, ...ids]) : ids;
      root.querySelector("[data-orders]").innerHTML = orders.length
        ? orders.map((o) => orderCard(o, fresh.some((f) => f.id === o.id))).join("")
        : `<li class="empty">Nenhum pedido ${filter ? "com esse status" : "ainda"}. Os novos aparecem aqui automaticamente.</li>`;
    } catch (err) {
      if (err.status !== 401) toast(err.message, { type: "error" });
    }
  };

  root.addEventListener("click", (e) => {
    const f = e.target.closest("[data-filter]");
    if (f) { filter = f.dataset.filter; renderOrders(root); }
    if (e.target.closest("[data-refresh]")) load();
  });
  root.addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-order-status]");
    if (!sel) return;
    sel.disabled = true;
    try {
      const o = await adminApi(`/admin/orders/${sel.dataset.orderStatus}/status`, { method: "PATCH", body: { status: sel.value } });
      toast(`Pedido ${o.code}: ${ORDER_STATUS[o.status]}`);
      sel.closest(".order").dataset.status = o.status;
    } catch (err) {
      toast(err.message, { type: "error" });
    } finally {
      sel.disabled = false;
    }
  });

  await load();
  timer = setInterval(() => { if (document.visibilityState === "visible" && root.isConnected) load(); }, 20000);
}

export const stopOrders = () => clearInterval(timer);
