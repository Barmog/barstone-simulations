// שכבת הנתונים: Supabase כשמוגדר, ואחרת מצב הדגמה מקומי (localStorage) — אותו ממשק בשני המצבים.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Project } from '../core/model';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_KEY as string | undefined;
export const sb: SupabaseClient | null = URL_ && KEY ? createClient(URL_, KEY) : null;
export const isLocal = !sb;

export interface Customer { id: string; name: string; phone?: string | null; email?: string | null; address?: string | null; notes?: string | null; created_at: string; updated_at: string }
export type OrderStatus = 'draft' | 'review' | 'approved' | 'production' | 'done';
export interface OrderMetrics { slabs?: number; utilization?: number; joints?: number; area?: number; issues?: number }
export interface Order { id: string; customer_id: string; title: string; order_no?: string | null; status: OrderStatus; stone_id: number | null; project: Project; metrics: OrderMetrics; created_at: string; updated_at: string }
export interface Stone { id: number | string; name: string; color?: string | null; url: string; slab: boolean }
export const STATUS_HE: Record<OrderStatus, string> = { draft: 'טיוטה', review: 'לעיון הלקוח', approved: 'אושר', production: 'בייצור', done: 'הושלם' };

const J = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || '') ?? d; } catch { return d; } };
const W = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const now = () => new Date().toISOString();
const id = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const ok = <T,>(r: { data: T | null; error: { message: string } | null }): T => { if (r.error) throw new Error(r.error.message); return r.data as T; };

const LOCAL_STONES: Stone[] = [
  { id: 'l1', name: 'אבן לדוגמה (מצב הדגמה)', url: '/stone.jpg', slab: true },
];

export const repo = {
  async stones(): Promise<Stone[]> {
    if (!sb) return LOCAL_STONES;
    const { data, error } = await sb.from('stones').select('id,name,color,tile_path,slab_path,supplier').order('name');
    if (error || !data?.length) return LOCAL_STONES;
    return data
      .map((s: any): Stone => ({ id: s.id, name: s.name, color: s.color, slab: !!s.slab_path, url: s.slab_path ? sb.storage.from('slabs').getPublicUrl(s.slab_path).data.publicUrl : s.tile_path ? sb.storage.from('tiles').getPublicUrl(s.tile_path).data.publicUrl : '/stone.jpg' }))
      .sort((a, b) => Number(b.slab) - Number(a.slab) || a.name.localeCompare(b.name));
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
