/** Sessão do administrador. sessionStorage: o login some ao fechar a aba. */
import { api, ApiError } from "../core/api.js";

const KEY = "romera:admin:token";
let onExpire = () => {};

export const getToken = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* ignora */ } };
export const onSessionExpired = (fn) => { onExpire = fn; };

export async function adminApi(path, options = {}) {
  try {
    return await api(path, { ...options, token: getToken() });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      setToken(null);
      onExpire(err.message);
    }
    throw err;
  }
}
