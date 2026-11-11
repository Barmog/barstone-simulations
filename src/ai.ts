// לקוח ליכולות ה-AI. הקריאה למודל נעשית בפונקציית קצה ב-Supabase (המפתח נשמר שם בלבד, לא בדפדפן).
import { Cutout, CutoutKind, Piece, PieceKind, Project, Side, uid } from './core/model';
import { sb } from './data/repo';

/** ייצוג קומפקטי של המטבח שהמודל קורא וכותב. מזהים קצרים (A, B, …) במקום מזהים פנימיים. */
export interface Draft {
  thickness?: number; apronH?: number;
  pieces: { ref: string; name: string; kind: PieceKind; x: number; y: number; w: number; h: number; wall?: Side | null; host?: string | null; side?: Side | null; aprons?: Side[]; grainLock?: boolean }[];
  cutouts: { piece: string; kind: CutoutKind; x: number; y: number; w: number; h: number; round?: boolean }[];
}
export interface AiReply { draft?: Draft; reply: string; assumptions?: string[] }

export function toDraft(p: Project): Draft {
  const ref = new Map(p.pieces.map((q, i) => [q.id, `P${i + 1}`]));
  return {
    thickness: p.thickness, apronH: p.apronH,
    pieces: p.pieces.map((q) => ({ ref: ref.get(q.id)!, name: q.name, kind: q.kind, x: q.x, y: q.y, w: q.w, h: q.h, wall: q.wall || null, host: q.host ? ref.get(q.host) || null : null, side: q.side || null, aprons: q.aprons, grainLock: q.grainLock })),
    cutouts: p.cutouts.map((c) => ({ piece: ref.get(c.pieceId)!, kind: c.kind, x: c.x, y: c.y, w: c.w, h: c.h, round: !!c.round })),
  };
}

const KINDS: PieceKind[] = ['counter', 'island', 'splash', 'waterfall', 'panel'], CUTS: CutoutKind[] = ['sink', 'cooktop', 'faucet', 'hole'], SIDES: Side[] = ['back', 'front', 'left', 'right'];
const n = (v: unknown, lo: number, hi: number, d: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };

/** מיזוג תשובת המודל לפרויקט, עם ניקוי וולידציה — לא סומכים על הפלט כמו שהוא. */
export function applyDraft(base: Project, d: Draft): Project {
  const prev = new Map(base.pieces.map((q, i) => [`P${i + 1}`, q]));
  const ids = new Map<string, string>();
  for (const q of d.pieces || []) ids.set(q.ref, prev.get(q.ref)?.id || uid());
  const pieces: Piece[] = (d.pieces || []).filter((q) => KINDS.includes(q.kind)).slice(0, 40).map((q) => {
    const old = prev.get(q.ref), vertical = q.kind === 'splash' || q.kind === 'waterfall';
    return {
      id: ids.get(q.ref)!, name: String(q.name || old?.name || 'חלק').slice(0, 60), kind: q.kind,
      x: n(q.x, -20000, 20000, 0), y: n(q.y, -20000, 20000, 0), w: n(q.w, 30, 12000, 600), h: n(q.h, 30, 12000, 600),
      wall: !vertical && q.wall && SIDES.includes(q.wall) ? q.wall : undefined,
      host: vertical && q.host && ids.has(q.host) ? ids.get(q.host) : undefined, side: vertical && q.side && SIDES.includes(q.side) ? q.side : undefined,
      aprons: (q.aprons || []).filter((s) => SIDES.includes(s)), grainLock: q.grainLock !== false, outline: old && old.w === q.w && old.h === q.h ? old.outline : undefined,
    };
  }).filter((q) => !(q.kind === 'splash' || q.kind === 'waterfall') || q.host);
  const byId = new Map(pieces.map((q) => [q.id, q]));
  const cutouts: Cutout[] = (d.cutouts || []).filter((c) => CUTS.includes(c.kind) && ids.has(c.piece) && byId.has(ids.get(c.piece)!)).slice(0, 40).map((c) => {
    const host = byId.get(ids.get(c.piece)!)!, w = n(c.w, 10, host.w, 400), h = n(c.h, 10, host.h, 400);
    const old = base.cutouts.find((o) => o.pieceId === host.id && o.kind === c.kind);
    return { id: old?.id || uid('c'), pieceId: host.id, kind: c.kind, x: n(c.x, 0, host.w - w, 0), y: n(c.y, 0, host.h - h, 0), w, h, round: c.round || c.kind === 'faucet' || undefined, mount: c.kind === 'sink' ? old?.mount || 'under' : undefined };
  });
  return { ...base, thickness: n(d.thickness, 6, 60, base.thickness), apronH: n(d.apronH, 0, 200, base.apronH), pieces, cutouts };
}

async function call(body: Record<string, unknown>): Promise<AiReply> {
  if (!sb) throw new Error('יכולות ה-AI פועלות באתר המחובר (לא במצב הדגמה מקומי).');
  const { data, error } = await sb.functions.invoke('ai', { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* נשארים עם ההודעה הכללית */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as AiReply;
}

const fileB64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('קריאת הקובץ נכשלה')); r.readAsDataURL(f); });

export const ai = {
  /** צילום / PDF של תוכנית או דף מדידה → מטבח. */
  async fromPlan(file: File): Promise<AiReply> {
    if (file.size > 12 * 1024 * 1024) throw new Error('הקובץ גדול מדי (עד 12MB).');
    return call({ mode: 'plan', media_type: file.type || 'image/jpeg', data: await fileB64(file) });
  },
  /** עריכה בשפה חופשית. */
  edit: (p: Project, text: string) => call({ mode: 'edit', text, draft: toDraft(p) }),
  /** חוות דעת מקצועית והצעות עיצוב על בסיס ממצאי הבודק. */
  advise: (p: Project, facts: Record<string, unknown>) => call({ mode: 'advise', draft: toDraft(p), facts }),
};
