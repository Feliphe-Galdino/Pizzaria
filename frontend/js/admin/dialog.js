import { icon } from "../core/format.js";
import { openDialog } from "../core/ui.js";

export const adminDialog = () => document.getElementById("admin-dialog");

/** Abre um formulário no diálogo padrão e devolve o <form>. */
export function openFormDialog(title, bodyHtml, { submitLabel = "Salvar", danger = "" } = {}) {
  const el = adminDialog();
  el.innerHTML = `
    <div class="sheet__scroll">
      <button class="icon-btn sheet__close" type="button" data-close aria-label="Fechar">${icon("close")}</button>
      <form class="form-grid" data-dialog-form novalidate>
        <h2 id="admin-dialog-title">${title}</h2>
        ${bodyHtml}
        <p class="alert" role="alert" data-form-error hidden></p>
      </form>
    </div>
    <div class="sheet__footer">
      ${danger ? `<button class="btn btn--ghost" type="button" data-danger>${danger}</button>` : ""}
      <button class="btn" type="button" data-save>${submitLabel}</button>
    </div>`;
  el.querySelector("[data-close]").addEventListener("click", () => el.close());
  openDialog(el);
  return el;
}

export function showFormError(el, message) {
  const box = el.querySelector("[data-form-error]");
  box.hidden = !message;
  box.textContent = message || "";
}
