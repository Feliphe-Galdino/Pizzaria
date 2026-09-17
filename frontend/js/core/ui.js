import { esc, icon } from "./format.js";

export function toast(message, { type = "success", duration = 2800 } = {}) {
  const region = document.querySelector("[data-toasts]");
  if (!region) return;
  const el = document.createElement("div");
  el.className = `toast${type === "error" ? " toast--error" : ""}`;
  el.innerHTML = `${icon(type === "error" ? "alert" : "check")}<span>${esc(message)}</span>`;
  region.append(el);
  setTimeout(() => {
    el.classList.add("is-leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  }, duration);
}

/** Abre um <dialog> como modal e fecha ao clicar no fundo. */
export function openDialog(dialog, { onClose } = {}) {
  if (!dialog.open) dialog.showModal();
  document.documentElement.style.overflow = "hidden";
  const backdrop = (e) => { if (e.target === dialog) dialog.close(); };
  dialog.addEventListener("click", backdrop);
  dialog.addEventListener("close", () => {
    dialog.removeEventListener("click", backdrop);
    document.documentElement.style.overflow = "";
    onClose?.();
  }, { once: true });
}

/** Mostra erros de validação do servidor ao lado de cada campo. */
export function showFieldErrors(form, fields = {}) {
  form.querySelectorAll(".field-error").forEach((e) => e.remove());
  form.querySelectorAll(".has-error").forEach((e) => e.classList.remove("has-error"));
  let first = null;
  for (const [name, message] of Object.entries(fields || {})) {
    const input = form.querySelector(`[name="${CSS.escape(name)}"]`);
    const field = input?.closest(".field");
    if (!field) continue;
    field.classList.add("has-error");
    const p = document.createElement("p");
    p.className = "field-error";
    p.id = `${input.id || name}-error`;
    p.textContent = message;
    field.append(p);
    input.setAttribute("aria-describedby", p.id);
    first ||= input;
  }
  first?.focus();
  return Boolean(first);
}

export function setLoading(button, loading) {
  button.classList.toggle("is-loading", loading);
  button.disabled = loading;
  button.setAttribute("aria-busy", String(loading));
}
