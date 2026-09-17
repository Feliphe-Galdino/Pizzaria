import { esc, icon } from "../core/format.js";

const $$ = (sel) => document.querySelectorAll(sel);

export function renderStore(store) {
  $$("[data-store-status]").forEach((el) => {
    el.textContent = store.status.message;
    el.classList.toggle("is-open", store.status.is_open);
  });
  $$("[data-delivery-time]").forEach((el) => { el.textContent = `Entrega em ${store.average_times.delivery}`; });
  $$("[data-pickup-time]").forEach((el) => { el.textContent = `Retirada em ${store.average_times.pickup}`; });

  const byDay = Object.fromEntries(store.hours.map((h) => [h.weekday, h]));
  const names = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  document.querySelector("[data-hours]").innerHTML = names.map((name, day) => {
    const h = byDay[day];
    const today = day === store.today_weekday;
    return `<tr class="${today ? "is-today" : ""}"${today ? ' aria-current="date"' : ""}>
      <th scope="row">${name}${today ? " (hoje)" : ""}</th>
      <td class="${h ? "" : "closed"}">${h ? `${esc(h.open)} às ${esc(h.close)}` : "Fechado"}</td></tr>`;
  }).join("");

  const a = store.address;
  const line = `${a.street}, ${a.district}, ${a.city} - ${a.state}`;
  document.querySelector("[data-address]").innerHTML = `${esc(a.street)}<br>${esc(a.district)}, ${esc(a.city)} - ${esc(a.state)}<br>CEP ${esc(a.zip)}`;
  document.querySelector("[data-footer-address]").textContent = line;
  const maps = document.querySelector("[data-maps]");
  if (/^https:\/\//.test(a.maps_url)) maps.href = a.maps_url;
  document.querySelector("[data-delivery-area]").textContent = store.delivery_area;

  const contacts = [];
  if (store.whatsapp) contacts.push(`<li><a href="https://wa.me/${encodeURIComponent(store.whatsapp)}" target="_blank" rel="noopener">${icon("whatsapp")}Pedir pelo WhatsApp</a></li>`);
  if (store.phone) contacts.push(`<li><a href="tel:+55${esc(store.phone.replace(/\D/g, ""))}">${icon("phone")}${esc(store.phone)}</a></li>`);
  if (store.email) contacts.push(`<li><a href="mailto:${esc(store.email)}">${icon("mail")}${esc(store.email)}</a></li>`);
  document.querySelector("[data-contacts]").innerHTML = contacts.join("");

  const socials = [["instagram", "Instagram"], ["facebook", "Facebook"]]
    .filter(([k]) => /^https:\/\//.test(store.social?.[k] || ""))
    .map(([k, label]) => `<a href="${esc(store.social[k])}" target="_blank" rel="noopener" aria-label="${label} da Romera &amp; Romera">${icon(k)}</a>`);
  document.querySelector("[data-socials]").innerHTML = socials.join("");
}
