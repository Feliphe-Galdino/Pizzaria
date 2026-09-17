/** Cliente HTTP da API com timeout e erros padronizados. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = "network_error", fields = null } = {}) {
    super(message);
    Object.assign(this, { status, code, fields });
  }
}

export async function api(path, { method = "GET", body, token, timeout = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method, headers, signal: controller.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const aborted = err.name === "AbortError";
    throw new ApiError(aborted ? "A conexão demorou demais. Tente de novo." : "Sem conexão com a pizzaria. Verifique sua internet.");
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const e = data?.error || {};
    throw new ApiError(e.message || "Não foi possível concluir a ação.", { status: response.status, code: e.code, fields: e.fields });
  }
  return data;
}
