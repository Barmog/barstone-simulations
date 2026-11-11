// מצב האפליקציה: ההזמנה הפתוחה, היסטוריית ביטול/חזרה, בחירה, ושמירה אוטומטית.
import { create } from 'zustand';
import { Cutout, Piece, Project } from './core/model';
import { NestResult, nest } from './core/nesting';
import { Issue, check } from './core/checks';
import { Order, Stone, repo } from './data/repo';

export type Sel = { type: 'piece' | 'cutout'; id: string } | null;
export type Step = 'dims' | 'stone' | 'design' | 'check' | 'summary';
export interface ChatMsg { role: 'user' | 'ai'; text: string }
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

interface State {
  order: Order | null;
  project: Project | null;
  past: Project[];
  future: Project[];
  sel: Sel;
  save: SaveState;
  stones: Stone[];
  nest: NestResult | null;
  issues: Issue[];
  toast: string;
  step: Step;
  chat: ChatMsg[];
  setStep(s: Step): void;
  say(m: ChatMsg): void;
  open(order: Order): void;
  close(): void;
  /** שינוי שנכנס להיסטוריה. coalesce: מפתח שמאחד רצף שינויים (גרירה, הקלדה) לצעד ביטול אחד. */
  apply(fn: (p: Project) => Project, coalesce?: string): void;
  undo(): void;
  redo(): void;
  select(sel: Sel): void;
  patchPiece(id: string, patch: Partial<Piece>, coalesce?: string): void;
  patchCutout(id: string, patch: Partial<Cutout>, coalesce?: string): void;
  remove(sel: Sel): void;
  setToast(t: string): void;
  loadStones(): Promise<void>;
  flush(): Promise<void>;
  patchOrder(patch: Partial<Pick<Order, 'title' | 'order_no' | 'status'>>): void;
}

let lastKey = '', lastAt = 0, timer: ReturnType<typeof setTimeout> | undefined;
const derive = (p: Project) => { const n = nest(p); return { nest: n, issues: check(p, n) }; };

export const useStore = create<State>((set, get) => {
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => get().flush(), 900); };
  const commit = (project: Project, extra: Partial<State> = {}) => { set({ project, ...derive(project), save: 'dirty', ...extra }); schedule(); };
  return {
    order: null, project: null, past: [], future: [], sel: null, save: 'saved', stones: [], nest: null, issues: [], toast: '', step: 'dims', chat: [],
    setStep(step) { set({ step, sel: null }); },
    say(m) { set({ chat: [...get().chat, m] }); },
    open(order) { lastKey = ''; set({ step: 'dims', chat: [], order, project: order.project, past: [], future: [], sel: null, save: 'saved', ...derive(order.project) }); },
    close() { get().flush(); set({ order: null, project: null, past: [], future: [], sel: null, nest: null, issues: [] }); },
    apply(fn, coalesce) {
      const cur = get().project; if (!cur) return;
      const next = fn(cur); if (next === cur) return;
      const t = Date.now(), merge = !!coalesce && coalesce === lastKey && t - lastAt < 1200;
      lastKey = coalesce || ''; lastAt = t;
      commit(next, { past: merge ? get().past : [...get().past.slice(-99), cur], future: [] });
    },
    undo() { const { past, project, future } = get(); if (!past.length || !project) return; lastKey = ''; commit(past[past.length - 1], { past: past.slice(0, -1), future: [project, ...future], sel: null }); },
    redo() { const { past, project, future } = get(); if (!future.length || !project) return; lastKey = ''; commit(future[0], { past: [...past, project], future: future.slice(1), sel: null }); },
    select(sel) { set({ sel }); },
    patchPiece(id, patch, coalesce) { get().apply((p) => ({ ...p, pieces: p.pieces.map((q) => (q.id === id ? { ...q, ...patch } : q)) }), coalesce); },
    patchCutout(id, patch, coalesce) { get().apply((p) => ({ ...p, cutouts: p.cutouts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), coalesce); },
    remove(sel) {
      if (!sel) return;
      get().apply((p) => sel.type === 'cutout'
        ? { ...p, cutouts: p.cutouts.filter((c) => c.id !== sel.id) }
        : { ...p, pieces: p.pieces.filter((q) => q.id !== sel.id && q.host !== sel.id), cutouts: p.cutouts.filter((c) => c.pieceId !== sel.id) });
      set({ sel: null });
    },
    setToast(toast) { set({ toast }); if (toast) setTimeout(() => get().toast === toast && set({ toast: '' }), 2600); },
    async loadStones() { if (!get().stones.length) set({ stones: await repo.stones() }); },
    patchOrder(patch) { const o = get().order; if (!o) return; set({ order: { ...o, ...patch }, save: 'dirty' }); schedule(); },
    async flush() {
      clearTimeout(timer);
      const { order, project, save, nest: n, issues } = get();
      if (!order || !project || save === 'saved' || save === 'saving') return;
      set({ save: 'saving' });
      try {
        await repo.updateOrder(order.id, {
          title: order.title, order_no: order.order_no, status: order.status, project,
          stone_id: typeof project.stoneId === 'number' ? project.stoneId : null,
          metrics: { slabs: n?.metrics.slabs, utilization: n?.metrics.utilization, joints: n?.metrics.joints, area: n ? +(n.metrics.pieceArea / 1e6).toFixed(2) : 0, issues: issues.filter((i) => i.level !== 'tip').length },
        });
        set({ save: get().project === project && get().order === order ? 'saved' : 'dirty' });
        if (get().save === 'dirty') schedule();
      } catch (e) { set({ save: 'error' }); get().setToast(`השמירה נכשלה: ${(e as Error).message}`); }
    },
  };
});

// ניתוב פשוט לפי hash: #/ · #/c/<לקוח> · #/o/<הזמנה> · #/o/<הזמנה>/doc
export type Route = { name: 'home'; customer?: string } | { name: 'studio'; id: string } | { name: 'doc'; id: string } | { name: 'team' };
export function parseRoute(hash: string): Route {
  const [a, b, c] = hash.replace(/^#\/?/, '').split('/');
  if (a === 'o' && b) return c === 'doc' ? { name: 'doc', id: b } : { name: 'studio', id: b };
  if (a === 'c' && b) return { name: 'home', customer: b };
  if (a === 'team') return { name: 'team' };
  return { name: 'home' };
}
export const go = (path: string) => { location.hash = path; };
