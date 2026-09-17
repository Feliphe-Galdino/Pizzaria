import { api } from "../core/api.js";
import { esc, icon } from "../core/format.js";
import { setLoading, showFieldErrors } from "../core/ui.js";
import { renderAddons, renderCategories, renderProducts } from "./catalog-views.js";
import { renderOrders, stopOrders } from "./orders-view.js";
import { getToken, onSessionExpired, setToken } from "./session.js";

const root = document.getElementById("admin-root");
const ROUTES = {
  pedidos: ["Pedidos", renderOrders],
  produtos: ["Produtos", renderProducts],
  categorias: ["Categorias", renderCategories],
  adicionais: ["Adicionais", renderAddons],
};

function renderLogin(message = "") {
  stopOrders();
  document.title = "Entrar | Romera & Romera Pizzaria";
  root.innerHTML = `
    <main class="login">
      <form class="login__card lousa framed" novalidate>
        <img src="/assets/logo-dark.svg" alt="Romera &amp; Romera Pizzaria" width="180" height="170" />
        <h1>Painel da pizzaria</h1>
        ${message ? `<p class="alert" role="alert">${icon("alert")}${esc(message)}</p>` : ""}
        <div class="field"><label for="lg-email">E-mail</label><input class="input" id="lg-email" name="email" type="email" autocomplete="username" required /></div>
        <div class="field"><label for="lg-pass">Senha</label><input class="input" id="lg-pass" name="password" type="password" autocomplete="current-password" required /></div>
        <p class="alert" role="alert" data-error hidden></p>
        <button class="btn btn--gold btn--block" type="submit">Entrar</button>
      </form>
    </main>`;
  const form = root.querySelector("form");
  form.email.focus();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("[type=submit]");
    const box = form.querySelector("[data-error]");
    box.hidden = true;
    if (showFieldErrors(form, {
      ...(form.email.value.trim() ? {} : { email: "Informe o e-mail." }),
      ...(form.password.value ? {} : { password: "Informe a senha." }),
    })) return;
    setLoading(btn, true);
    try {
      const { token } = await api("/auth/login", { method: "POST", body: { email: form.email.value, password: form.password.value } });
      setToken(token);
      if (!location.hash) location.hash = "#pedidos";
      renderShell();
    } catch (err) {
      box.hidden = false;
      box.textContent = err.message;
    } finally {
      if (btn.isConnected) setLoading(btn, false);
    }
  });
}

function renderShell() {
  const route = location.hash.slice(1) in ROUTES ? location.hash.slice(1) : "pedidos";
  const [title, view] = ROUTES[route];
  document.title = `${title} | Painel Romera & Romera`;
  stopOrders();
  const dlg = document.getElementById("admin-dialog");
  if (dlg.open) dlg.close();
  root.innerHTML = `
    <header class="admin-bar awning-edge">
      <div class="container admin-bar__inner">
        <a class="brand" href="/" target="_blank" rel="noopener" aria-label="Abrir o site em nova aba">
          <img src="/assets/logo-mark.svg" alt="" width="40" height="40" />
          <span class="brand__name">Romera &amp; Romera<small>PAINEL</small></span>
        </a>
        <button class="btn btn--ghost btn--sm" type="button" data-logout>Sair</button>
      </div>
    </header>
    <nav class="admin-tabs" aria-label="Seções do painel"><div class="container"><ul>
      ${Object.entries(ROUTES).map(([k, [label]]) => `<li><a href="#${k}" ${k === route ? 'aria-current="page"' : ""}>${label}</a></li>`).join("")}
    </ul></div></nav>
    <main class="container admin-main" data-view></main>`;
  root.querySelector("[data-logout]").addEventListener("click", () => { setToken(null); renderLogin("Você saiu do painel."); });
  view(root.querySelector("[data-view]"));
}

onSessionExpired((message) => renderLogin(message));
window.addEventListener("hashchange", () => { if (getToken()) renderShell(); });
getToken() ? renderShell() : renderLogin();
