// שכבת הנתונים: Supabase כשמוגדר, ואחרת מצב הדגמה מקומי (localStorage) — אותו ממשק בשני המצבים.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Project, fromTemplate, piece } from '../core/model';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
export const sb: SupabaseClient | null = URL_ && KEY ? createClient(URL_, KEY) : null;
export const isLocal = !sb;

export interface Customer { id: string; name: string; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null; created_at: string; updated_at: string }
export type OrderStatus = 'draft' | 'review' | 'approved' | 'production' | 'done';
export interface OrderMetrics { slabs?: number; utilization?: number; joints?: number; area?: number; issues?: number }
export interface Order { id: string; customer_id: string; title: string; order_no?: string | null; status: OrderStatus; stone_id: number | null; project: Project; metrics: OrderMetrics; created_at: string; updated_at: string }
export interface Stone { id: number | string; name: string; color?: string | null; url: string; slab: boolean; stock: 'yes' | 'no' | 'unknown'; hasImage: boolean; bookmatch?: boolean | null; en?: string | null; novo?: string | null }
/** שם דגם לתצוגה: עברית ולצידה השם באנגלית (LUCENTE). */
export const stoneLabel = (s: { name: string; en?: string | null }) => (s.en ? `${s.name} · ${s.en}` : s.name);
export const STATUS_HE: Record<OrderStatus, string> = { draft: 'טיוטה', review: 'לעיון הלקוח', approved: 'אושר', production: 'בייצור', done: 'הושלם' };

const J = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || '') ?? d; } catch { return d; } };
const W = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const now = () => new Date().toISOString();
const id = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const ok = <T,>(r: { data: T | null; error: { message: string } | null }): T => { if (r.error) throw new Error(r.error.message); return r.data as T; };

const STONE_FALLBACK = import.meta.env.BASE_URL + 'stone.jpg';
const LOCAL_STONES: Stone[] = [
  { id: 'l1', name: 'אבן בהירה (דוגמה)', url: STONE_FALLBACK, slab: true, stock: 'yes', hasImage: true },
];

/** מצב הדגמה: בפתיחה הראשונה נוצרים לקוח והזמנות לדוגמה, כדי שיהיה במה לשחק. */
function seedDemo() {
  if (sb || localStorage.getItem('bs.seeded')) return;
  localStorage.setItem('bs.seeded', '1');
  if (J<Customer[]>('bs.customers', []).length) return;
  const c: Customer = { id: id(), name: 'משפחת לוי (דוגמה)', phone: '050-0000000', address: 'רחוב הדוגמה 1', notes: 'לקוח לדוגמה — אפשר לשנות ולמחוק הכול.', created_at: now(), updated_at: now() };
  const a = fromTemplate('l-island', 'מטבח L עם אי'), isl = a.pieces.find((q) => q.kind === 'island')!;
  a.pieces.push(...(['left', 'right'] as const).map((s) => piece({ kind: 'waterfall', name: s === 'left' ? 'מפל · שמאל' : 'מפל · ימין', w: isl.h, h: a.counterH - a.thickness, host: isl.id, side: s })));
  const b = fromTemplate('straight', 'מטבח ישר ארוך'); b.pieces[0].w = 4560; b.pieces[b.pieces.length - 1].w = 4560; b.cutouts[2].x = 2050;
  const mk = (title: string, order_no: string, project: Project, metrics: OrderMetrics): Order => ({ id: id(), customer_id: c.id, title, order_no, status: 'draft', stone_id: null, project, metrics, created_at: now(), updated_at: now() });
  W('bs.customers', [c]);
  W('bs.orders', [mk('מטבח L עם אי', '1001', a, { slabs: 3, utilization: 58, area: 8.45 }), mk('מטבח ישר ארוך · חיבור ליד הכיריים', '1002', b, { slabs: 2, utilization: 60, area: 5.57 })]);
}
try { seedDemo(); } catch { /* אחסון חסום — ממשיכים בלי דוגמה */ }

/** מצב הדגמה: שלוש אבנים (האבן לדוגמה ועוד שני גוונים שנוצרים ממנה), כדי שאפשר יהיה להשוות דגמים. */
let demoCache: Promise<Stone[]> | null = null;
function demoStones(): Promise<Stone[]> {
  demoCache ||= new Promise<Stone[]>((res) => {
    const img = new Image();
    img.onload = () => {
      const mk = (filter: string) => { const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const g = c.getContext('2d')!; g.filter = filter; g.drawImage(img, 0, 0); return c.toDataURL('image/jpeg', 0.85); };
      try { res([...LOCAL_STONES, { id: 'l2', name: 'אבן כהה (דוגמה)', url: mk('invert(1) brightness(.75) contrast(1.15)'), slab: true, stock: 'yes', hasImage: true }, { id: 'l3', name: 'אבן חמה (דוגמה)', url: mk('sepia(.75) saturate(1.5) brightness(.93)'), slab: true, stock: 'no', hasImage: true }]); } catch { res(LOCAL_STONES); }
    };
    img.onerror = () => res(LOCAL_STONES); img.src = STONE_FALLBACK;
  });
  return demoCache;
}

export const repo = {
  async stones(): Promise<Stone[]> {
    if (!sb) return demoStones();
    // מנסים את העמודות החדשות קודם, ונופלים אחורה אם המסד עוד לא עודכן
    const cols = ['id,name,color,tile_path,slab_path,supplier,in_stock,bookmatch,name_en,novo_name,novo_no,active', 'id,name,color,tile_path,slab_path,supplier,in_stock,bookmatch', 'id,name,color,tile_path,slab_path,supplier'];
    let data: any[] | null = null;
    for (const c of cols) { const r = await sb.from('stones').select(c).order('name'); if (!r.error) { data = r.data; break; } }
    if (!data?.length) return LOCAL_STONES;
    const rank = { yes: 0, unknown: 1, no: 2 };
    // slab_path שמתחיל ב-site: הוא תמונה שמגיעה עם האתר (public/slabs); אחרת קובץ באחסון של Supabase
    const slabUrl = (path: string) => (path.startsWith('site:') ? import.meta.env.BASE_URL + path.slice(5) : sb!.storage.from('slabs').getPublicUrl(path).data.publicUrl);
    return data
      .filter((s: any) => s.active !== false)
      .map((s: any): Stone => ({ id: s.id, name: s.name, en: s.name_en, novo: [s.novo_name, s.novo_no].filter(Boolean).join(' · ') || null, color: s.color, slab: !!s.slab_path, stock: s.in_stock || 'unknown', hasImage: !!(s.slab_path || s.tile_path), bookmatch: s.bookmatch, url: s.slab_path ? slabUrl(s.slab_path) : s.tile_path ? sb!.storage.from('tiles').getPublicUrl(s.tile_path).data.publicUrl : STONE_FALLBACK }))
      .sort((a, b) => Number(b.hasImage) - Number(a.hasImage) || rank[a.stock] - rank[b.stock] || a.name.localeCompare(b.name, 'he'));
  },
  async updateStone(sid: number | string, patch: { in_stock?: string; bookmatch?: boolean | null; name?: string }) { if (sb) ok(await sb.from('stones').update(patch).eq('id', sid).select('id')); },
  async addStone(name: string): Promise<number | null> { if (!sb) return null; return ok<{ id: number }>(await sb.from('stones').insert({ name, supplier: 'Barstone' }).select('id').single()).id; },
  /** העלאת תמונת לוח לדגם (מנהל הקטלוג). */
  async uploadSlab(sid: number | string, file: File) {
    if (!sb) throw new Error('העלאה פועלת באתר המחובר.');
    const path = `barstone/${sid}-${Date.now()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`;
    const up = await sb.storage.from('slabs').upload(path, file, { contentType: file.type || 'image/jpeg' });
    if (up.error) throw new Error(up.error.message);
    ok(await sb.from('stones').update({ slab_path: path }).eq('id', sid).select('id'));
  },

  async customers(): Promise<Customer[]> {
    if (!sb) return J<Customer[]>('bs.customers', []).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return ok(await sb.from('customers').select('*').order('updated_at', { ascending: false }));
  },
  async saveCustomer(c: Partial<Customer> & { name: string }): Promise<Customer> {
    if (!sb) {
      const all = J<Customer[]>('bs.customers', []), ex = all.find((x) => x.id === c.id);
      const row: Customer = { ...(ex || { id: id(), created_at: now() }), ...c, updated_at: now() } as Customer;
      W('bs.customers', [row, ...all.filter((x) => x.id !== row.id)]); return row;
    }
    const { id: cid, created_at, updated_at, ...rest } = c as Customer;
    return ok(cid ? await sb.from('customers').update(rest).eq('id', cid).select().single() : await sb.from('customers').insert(rest).select().single());
  },
  async deleteCustomer(cid: string) {
    if (!sb) { W('bs.customers', J<Customer[]>('bs.customers', []).filter((x) => x.id !== cid)); W('bs.orders', J<Order[]>('bs.orders', []).filter((o) => o.customer_id !== cid)); return; }
    ok(await sb.from('customers').delete().eq('id', cid).select());
  },

  /** רשימת הזמנות בלי גוף הפרויקט (קל וטוען מהר). */
  async orders(): Promise<Omit<Order, 'project'>[]> {
    if (!sb) return J<Order[]>('bs.orders', []).map(({ project, ...o }) => o).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return ok(await sb.from('orders').select('id,customer_id,title,order_no,status,stone_id,metrics,created_at,updated_at').order('updated_at', { ascending: false }));
  },
  async order(oid: string): Promise<Order | null> {
    if (!sb) return J<Order[]>('bs.orders', []).find((o) => o.id === oid) || null;
    const { data, error } = await sb.from('orders').select('*').eq('id', oid).maybeSingle();
    if (error) throw new Error(error.message);
    return data as Order | null;
  },
  async createOrder(o: { customer_id: string; title: string; order_no?: string; project: Project }): Promise<Order> {
    const base = { ...o, status: 'draft' as OrderStatus, stone_id: typeof o.project.stoneId === 'number' ? o.project.stoneId : null, metrics: {} };
    if (!sb) { const row: Order = { ...base, id: id(), created_at: now(), updated_at: now() }; W('bs.orders', [row, ...J<Order[]>('bs.orders', [])]); return row; }
    return ok(await sb.from('orders').insert(base).select().single());
  },
  async updateOrder(oid: string, patch: Partial<Pick<Order, 'title' | 'order_no' | 'status' | 'project' | 'metrics' | 'stone_id'>>) {
    if (!sb) { W('bs.orders', J<Order[]>('bs.orders', []).map((o) => (o.id === oid ? { ...o, ...patch, updated_at: now() } : o))); return; }
    ok(await sb.from('orders').update(patch).eq('id', oid).select('id'));
  },
  async deleteOrder(oid: string) {
    if (!sb) { W('bs.orders', J<Order[]>('bs.orders', []).filter((o) => o.id !== oid)); return; }
    ok(await sb.from('orders').delete().eq('id', oid).select('id'));
  },

  // ----- צוות -----
  async claimAccess(): Promise<'admin' | 'sales' | 'pending'> {
    if (!sb) return 'admin';
    const { data, error } = await sb.rpc('claim_access');
    if (error) throw new Error(error.message);
    return data;
  },
  async team(): Promise<{ staff: { user_id: string; email: string; role: string }[]; invites: { email: string; role: string }[] }> {
    if (!sb) return { staff: [], invites: [] };
    const [s, i] = await Promise.all([sb.from('staff').select('user_id,email,role').order('created_at'), sb.from('staff_invites').select('email,role').order('created_at')]);
    return { staff: s.data || [], invites: i.data || [] };
  },
  async invite(email: string, role: 'admin' | 'sales' = 'sales') { if (sb) ok(await sb.from('staff_invites').upsert({ email: email.trim().toLowerCase(), role }).select()); },
  async removeInvite(email: string) { if (sb) ok(await sb.from('staff_invites').delete().eq('email', email).select()); },
  async removeStaff(userId: string) { if (sb) ok(await sb.from('staff').delete().eq('user_id', userId).select()); },
};
