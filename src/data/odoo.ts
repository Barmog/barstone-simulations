// חיבור ל-Odoo דרך פונקציית הקצה odoo. פרטי החיבור (כתובת, מסד, משתמש ומפתח API) נשמרים בצד השרת בלבד.
import { sb } from './repo';

export interface OdooCustomer { id: number; name: string; phone: string; email: string; address: string }
export interface OdooOrder { id: number; name: string; date: string; state: string; ref: string; customer: OdooCustomer | null }
export interface OdooInfo { url: string; db: string; login: string }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!sb) throw new Error('החיבור ל-Odoo פועל באתר המחובר.');
  const { data, error } = await sb.functions.invoke('odoo', { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* נשארים עם ההודעה הכללית */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

/** מזהה הזמנה שהגיע מהכפתור ב-Odoo (‎?odoo=123). נשמר עד אחרי ההתחברות, ונמחק מהכתובת. */
const KEY = 'bs.odoo';
(() => {
  if (typeof location === 'undefined') return;
  const m = /[?&]odoo=([^&#]+)/.exec(location.search); if (!m) return;
  try { sessionStorage.setItem(KEY, decodeURIComponent(m[1]).slice(0, 60)); } catch { /* */ }
  const rest = location.search.replace(/([?&])odoo=[^&#]+&?/, '$1').replace(/[?&]$/, '');
  history.replaceState(null, '', location.pathname + rest + location.hash);
})();

export const odoo = {
  available: () => !!sb,
  pending: (): string => { try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; } },
  clearPending: () => { try { sessionStorage.removeItem(KEY); } catch { /* */ } },
  async info(): Promise<OdooInfo | null> { if (!sb) return null; const { data } = await sb.rpc('odoo_info'); return (data as OdooInfo) || null; },
  async save(url: string, db: string, login: string, key: string) { if (!sb) return; const { error } = await sb.rpc('set_odoo_config', { p_url: url, p_db: db, p_login: login, p_key: key }); if (error) throw new Error(error.message); },
  status: () => call<{ connected: boolean; version?: string; error?: string; base?: string }>({ mode: 'status' }),
  order: (key: string) => call<{ order: OdooOrder; base: string }>({ mode: 'order', key }),
  find: (q: string) => call<{ orders: OdooOrder[] }>({ mode: 'find', q }).then((r) => r.orders),
  attach: (id: number, filename: string, data: string, note: string) => call<{ ok: boolean; posted: boolean }>({ mode: 'attach', id, filename, data, note }),
};
