// חיבור לפיירברי דרך פונקציית הקצה fireberry. הטוקן האישי של כל משתמש נשמר בצד השרת בלבד.
import { sb } from './repo';

export interface FbAccount { id: string; name: string; phone: string; email: string; address: string }
export interface FbRecord { id: string; title: string; number: string; date: string }
export interface FbOrder { id: string; title: string; number: string; date: string; account: FbAccount | null }
export interface FbSettings { object?: number; objectName?: string; measureObject?: number; measureName?: string }
export interface FbFile { id: string; name: string; url: string; date: string }
export interface FbMeasure { id: string; title: string; date: string; order: boolean; files: FbFile[] }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!sb) throw new Error('החיבור לפיירברי פועל באתר המחובר.');
  const { data, error } = await sb.functions.invoke('fireberry', { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = j.error; } catch { /* נשארים עם ההודעה הכללית */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const fireberry = {
  available: () => !!sb,
  async setToken(token: string) { if (!sb) return; const { error } = await sb.rpc('set_fireberry_token', { p_token: token }); if (error) throw new Error(error.message); },
  async hasToken(): Promise<boolean> { if (!sb) return false; const { data } = await sb.rpc('has_fireberry_token'); return !!data; },
  status: () => call<{ connected: boolean }>({ mode: 'status' }),
  objects: () => call<{ objects: { objecttype: number; name: string }[] }>({ mode: 'objects' }).then((r) => r.objects),
  search: (q: string) => call<{ accounts: FbAccount[] }>({ mode: 'search', q }).then((r) => r.accounts),
  records: (object: number, accountId: string) => call<{ records: FbRecord[] }>({ mode: 'records', object, accountId }).then((r) => r.records),
  find: (object: number, q: string) => call<{ orders: FbOrder[]; accounts: FbAccount[] }>({ mode: 'find', object, q }),
  measures: (object: number, accountId: string, orderId?: string) => call<{ measures: FbMeasure[] }>({ mode: 'measures', object, accountId, orderId }).then((r) => r.measures),
  /** מוריד קובץ מדידה מפיירברי ומחזיר אותו כקובץ רגיל (כמו שנבחר מהמחשב). */
  async file(object: number, recordId: string, f: FbFile): Promise<File> {
    const r = await call<{ data: string; type: string }>({ mode: 'file', object, recordId, fileId: f.id, url: f.url });
    const bytes = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0)), name = f.name || 'measure';
    const ext = (name.split('.').pop() || '').toLowerCase(), type = r.type || (ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : /jpe?g/.test(ext) ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'application/octet-stream');
    return new File([bytes], name, { type });
  },
  attach: (object: number, id: string, filename: string, data: string) => call<{ ok: boolean }>({ mode: 'attach', object, id, filename, data }),
  async settings(): Promise<FbSettings> { if (!sb) return {}; const { data } = await sb.from('app_settings').select('value').eq('key', 'fireberry').maybeSingle(); return (data?.value as FbSettings) || {}; },
  async saveSettings(v: FbSettings) { if (!sb) return; const { error } = await sb.from('app_settings').upsert({ key: 'fireberry', value: v, updated_at: new Date().toISOString() }); if (error) throw new Error(error.message); },
};
