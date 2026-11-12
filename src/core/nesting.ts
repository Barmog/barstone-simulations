// נסטינג: שיבוץ חלקי המטבח על לוחות (ברירת מחדל 3200×1600 מ"מ). ללא תלות בדפדפן.
// כל חלק נחתך יחד עם פסי הקנט הארוכים שלו כ"בלוק" אחד, כדי שהגיד ימשיך מהמשטח אל הקנט.
import { Cutout, PLINTH_H, Piece, Project, Side, isVertical, longIsX, pieceLen, pieceWid } from './model';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Strip { side: Side; rect: Rect }
export interface Placement {
  /** מזהה יציב של השיבוץ (לסידור ידני). */
  key: string;
  pieceId: string;
  slab: number;
  /** מלבן גוף החלק על הלוח. */
  body: Rect;
  /** הבלוק כולו (גוף + פסי קנט צמודים). */
  block: Rect;
  rot: boolean;
  /** מספר המקטע ומספר המקטעים (חלק ארוך מהלוח מתפצל עם חיבור). */
  seg: number;
  segs: number;
  /** היסט המקטע לאורך הציר הארוך של החלק, ואורכו. */
  off: number;
  len: number;
  strips: Strip[];
  /** פס קנט עצמאי (צד קצר) — לא גוף של חלק. */
  stripOf?: Side;
  /** חלק נלווה (למשל דופן של כיור בנוי) — לא גוף של חלק. */
  extra?: string;
}
/** האם השיבוץ הוא גוף החלק עצמו (ולא קנט או חלק נלווה). */
export const isBody = (pl: Placement) => !pl.stripOf && !pl.extra;
export interface Joint { pieceId: string; at: number }
export interface NestResult {
  slabs: { w: number; h: number; placements: Placement[]; used: number }[];
  unplaced: { pieceId: string; len: number; wid: number; reason: string }[];
  joints: Joint[];
  /** מפתחות של שיבוצים ידניים שחופפים זה לזה או חורגים מהלוח. */
  overlaps: string[];
  metrics: { slabs: number; utilization: number; pieceArea: number; slabArea: number; apronLen: number; joints: number };
}

interface Block { key: string; pieceId: string; L: number; H: number; wid: number; seg: number; segs: number; off: number; lock: boolean; stripsBefore: Side[]; stripsAfter: Side[]; stripOf?: Side; extra?: string }
interface Opts { W: number; H: number; kerf: number; margin: number; apronH: number }
type Manual = NonNullable<Project['manual']>;

const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** אזורים לאורך החלק שאסור לשים בהם חיבור (פתחים + 60 מ"מ). */
function keepZones(p: Piece, cutouts: Cutout[]): [number, number][] {
  const lx = longIsX(p);
  return cutouts.filter((c) => c.pieceId === p.id).map((c) => (lx ? [c.x - 60, c.x + c.w + 60] : [c.y - 60, c.y + c.h + 60]) as [number, number]);
}

export function splitPoints(len: number, maxL: number, keep: [number, number][], prefer: number[] = []): number[] {
  const segs = Math.ceil(len / maxL);
  const cuts: number[] = [];
  for (let i = 1; i < segs; i++) cuts.push(Math.round((len * i) / segs));
  for (let i = 0; i < cuts.length; i++) {
    const prev = i ? cuts[i - 1] : 0, next = i < cuts.length - 1 ? cuts[i + 1] : len;
    const fits = (c: number) => c > prev && c < next && c - prev <= maxL && next - c <= maxL;
    // חיבור מועדף (מרכז כיור / כיריים): שם החיבור הכי קצר והכי פחות נראה
    const want = prefer.filter(fits).sort((x, y) => Math.abs(x - cuts[i]) - Math.abs(y - cuts[i]));
    if (want.length) { cuts[i] = Math.round(want[0]); continue; }
    for (const [a, b] of keep) if (cuts[i] > a && cuts[i] < b) {
      const opts = [a, b].filter(fits).sort((x, y) => Math.abs(x - cuts[i]) - Math.abs(y - cuts[i]));
      if (opts.length) cuts[i] = Math.round(opts[0]);
    }
  }
  return [0, ...cuts, len];
}

function toBlocks(project: Project, o: Opts): Block[] {
  const blocks: Block[] = [];
  const maxL = o.W - 2 * o.margin;
  for (const p of project.pieces) {
    const wid = pieceWid(p), lx = longIsX(p), len = pieceLen(p) + (p.corner === 'miter' ? wid : 0); // גרונג 45°: החלק ארוך יותר בעומק המשטח
    const longSides: Side[] = lx ? ['back', 'front'] : ['left', 'right'];
    const aprons = o.apronH > 0 ? p.aprons : [];
    const before = aprons.filter((s) => s === longSides[0]), after = aprons.filter((s) => s === longSides[1]);
    const prefer = p.joint === 'sink' || p.joint === 'cooktop' ? project.cutouts.filter((c) => c.pieceId === p.id && c.kind === p.joint).map((c) => (lx ? c.x + c.w / 2 : c.y + c.h / 2)) : [];
    const custom = [...new Set((p.jointAt || []).map(Math.round))].filter((v) => v > 20 && v < len - 20).sort((a, b) => a - b), cpts = [0, ...custom, len];
    // חיבורים ידניים תקפים רק אם כל מקטע נכנס בלוח; אחרת חוזרים לאוטומטי
    const pts = custom.length && cpts.every((v, i) => !i || v - cpts[i - 1] <= maxL) ? cpts : splitPoints(len, maxL, keepZones(p, project.cutouts), prefer);
    const segs = pts.length - 1;
    for (let i = 0; i < segs; i++) {
      const L = pts[i + 1] - pts[i];
      blocks.push({ key: `${p.id}|${i}`, pieceId: p.id, L, wid, H: wid + (before.length + after.length) * (o.kerf + o.apronH), seg: i, segs, off: pts[i], lock: p.grainLock, stripsBefore: before, stripsAfter: after });
    }
    // קנט בצדדים הקצרים: פס נפרד
    for (const s of aprons.filter((s) => !longSides.includes(s))) blocks.push({ key: `${p.id}|k-${s}`, pieceId: p.id, L: wid, wid: o.apronH, H: o.apronH, seg: 0, segs: 1, off: 0, lock: false, stripsBefore: [], stripsAfter: [], stripOf: s });
  }
  // כיור בנוי מאבן: תחתית + 4 דפנות (ובכיור כפול גם מחיצה) נחתכים מהלוח
  for (const c of project.cutouts.filter((c) => c.kind === 'sink' && c.built)) {
    const t = project.thickness, D = 200, parts: [string, number, number][] = [['כיור · תחתית', c.w, c.h], ['כיור · דופן', c.w, D], ['כיור · דופן', c.w, D], ['כיור · דופן', c.h - 2 * t, D], ['כיור · דופן', c.h - 2 * t, D]];
    if (c.bowls && c.bowls !== 'single') parts.push(['כיור · מחיצה', c.h - 2 * t, D - 20]);
    parts.forEach(([name, a, b], n) => blocks.push({ key: `${c.id}|s${n}`, pieceId: c.pieceId, L: Math.max(a, b), wid: Math.min(a, b), H: Math.min(a, b), seg: 0, segs: 1, off: 0, lock: false, stripsBefore: [], stripsAfter: [], extra: name }));
  }
  // צוקל מאבן: פס בגובה הצוקל לאורך חזית הארונות (באי — מכל הצדדים)
  if (project.plinthStone && project.cabinets) for (const p of project.pieces.filter((q) => !isVertical(q) && q.kind !== 'panel')) {
    const runs = p.kind === 'island' ? [p.w, p.w, p.h, p.h] : [pieceLen(p)];
    let n = 0;
    for (const run of runs) for (let left = run; left > 1; left -= maxL) blocks.push({ key: `${p.id}|z${n++}`, pieceId: p.id, L: Math.min(left, maxL), wid: PLINTH_H, H: PLINTH_H, seg: 0, segs: 1, off: 0, lock: false, stripsBefore: [], stripsAfter: [], extra: 'צוקל' });
  }
  return blocks;
}

// MaxRects (Best-Short-Side-Fit) עם עובי מסור
function maxRects(W: number, H: number, o: Opts) {
  const m = o.margin, k = o.kerf;
  let free: Rect[] = [{ x: m, y: m, w: W - 2 * m + k, h: H - 2 * m + k }];
  const split = (r: Rect) => {
    const out: Rect[] = [];
    for (const f of free) {
      if (!hit(f, r)) { out.push(f); continue; }
      if (r.x > f.x) out.push({ x: f.x, y: f.y, w: r.x - f.x, h: f.h });
      if (r.x + r.w < f.x + f.w) out.push({ x: r.x + r.w, y: f.y, w: f.x + f.w - r.x - r.w, h: f.h });
      if (r.y > f.y) out.push({ x: f.x, y: f.y, w: f.w, h: r.y - f.y });
      if (r.y + r.h < f.y + f.h) out.push({ x: f.x, y: r.y + r.h, w: f.w, h: f.y + f.h - r.y - r.h });
    }
    free = out.filter((a, i) => !out.some((b, j) => j !== i && b.x <= a.x && b.y <= a.y && b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h && (j < i || b.w * b.h > a.w * a.h)));
  };
  return {
    find(w: number, h: number, canRotate: boolean) {
      let best: (Rect & { rot: boolean; ss: number; ls: number }) | null = null;
      const tries: [number, number, boolean][] = canRotate ? [[w, h, false], [h, w, true]] : [[w, h, false]];
      for (const f of free) for (const [ww, hh, r] of tries) if (ww + k <= f.w && hh + k <= f.h) {
        const ss = Math.min(f.w - ww, f.h - hh), ls = Math.max(f.w - ww, f.h - hh);
        if (!best || ss < best.ss || (ss === best.ss && ls < best.ls)) best = { x: f.x, y: f.y, w: ww, h: hh, rot: r, ss, ls };
      }
      return best;
    },
    take(p: Rect) { split({ x: p.x, y: p.y, w: p.w + k, h: p.h + k }); },
  };
}

function place(bl: Block, r: Rect & { rot: boolean }, slab: number, o: Opts): Placement {
  const step = o.kerf + o.apronH, nb = bl.stripsBefore.length;
  const strips: Strip[] = [];
  let body: Rect;
  if (!r.rot) {
    body = { x: r.x, y: r.y + nb * step, w: bl.L, h: bl.wid };
    bl.stripsBefore.forEach((s, i) => strips.push({ side: s, rect: { x: r.x, y: r.y + i * step, w: bl.L, h: o.apronH } }));
    bl.stripsAfter.forEach((s, i) => strips.push({ side: s, rect: { x: r.x, y: body.y + bl.wid + o.kerf + i * step, w: bl.L, h: o.apronH } }));
  } else {
    body = { x: r.x + nb * step, y: r.y, w: bl.wid, h: bl.L };
    bl.stripsBefore.forEach((s, i) => strips.push({ side: s, rect: { x: r.x + i * step, y: r.y, w: o.apronH, h: bl.L } }));
    bl.stripsAfter.forEach((s, i) => strips.push({ side: s, rect: { x: body.x + bl.wid + o.kerf + i * step, y: r.y, w: o.apronH, h: bl.L } }));
  }
  return { key: bl.key, pieceId: bl.pieceId, slab, body, block: { x: r.x, y: r.y, w: r.w, h: r.h }, rot: r.rot, seg: bl.seg, segs: bl.segs, off: bl.off, len: bl.L, strips, stripOf: bl.stripOf, extra: bl.extra };
}

function pack(blocks: Block[], o: Opts, manual: Manual = {}) {
  const slabs: { mr: ReturnType<typeof maxRects>; placements: Placement[] }[] = [];
  const unplaced: Block[] = [];
  const fits = (b: Block) => (b.L <= o.W - 2 * o.margin && b.H <= o.H - 2 * o.margin) || (!b.lock && b.H <= o.W - 2 * o.margin && b.L <= o.H - 2 * o.margin);
  const slabAt = (i: number) => { while (slabs.length <= i) slabs.push({ mr: maxRects(o.W, o.H, o), placements: [] }); return slabs[i]; };
  // קודם החלקים שסודרו ידנית: הם תופסים את מקומם, והשאר מסתדרים סביבם
  const fixed = new Set<string>();
  for (const bl of blocks) {
    const m = manual[bl.key]; if (!m || !fits(bl)) continue;
    const rot = !!m.rot && !bl.lock, w = rot ? bl.H : bl.L, h = rot ? bl.L : bl.H;
    if (w > o.W || h > o.H) continue;
    const r = { x: Math.round(Math.max(0, Math.min(o.W - w, m.x))), y: Math.round(Math.max(0, Math.min(o.H - h, m.y))), w, h, rot }, s = slabAt(Math.max(0, Math.min(40, Math.round(m.slab))));
    s.mr.take(r); s.placements.push(place(bl, r, slabs.indexOf(s), o)); fixed.add(bl.key);
  }
  for (const bl of blocks) {
    if (fixed.has(bl.key)) continue;
    if (!fits(bl)) { unplaced.push(bl); continue; }
    let done = false;
    for (let i = 0; i < slabs.length && !done; i++) {
      const r = slabs[i].mr.find(bl.L, bl.H, !bl.lock);
      if (r) { slabs[i].mr.take(r); slabs[i].placements.push(place(bl, r, i, o)); done = true; }
    }
    if (!done) {
      const s = slabAt(slabs.length), r = s.mr.find(bl.L, bl.H, !bl.lock)!;
      s.mr.take(r); s.placements.push(place(bl, r, slabs.length - 1, o));
    }
  }
  while (slabs.length && !slabs[slabs.length - 1].placements.length) slabs.pop();
  return { slabs, unplaced, fixed };
}

const ORDERS: ((a: Block, b: Block) => number)[] = [
  (a, b) => b.H * b.L - a.H * a.L, (a, b) => Math.max(b.L, b.H) - Math.max(a.L, a.H), (a, b) => b.H - a.H || b.L - a.L, (a, b) => b.L - a.L || b.H - a.H,
];

export function nest(project: Project): NestResult {
  const o: Opts = { W: project.slabW, H: project.slabH, kerf: project.kerf, margin: project.margin, apronH: project.apronH };
  const blocks = toBlocks(project, o);
  let best: ReturnType<typeof pack> | null = null, bestScore = Infinity;
  for (const ord of ORDERS) {
    const r = pack([...blocks].sort(ord), o, project.manual);
    // פחות לוחות קודם; בשוויון — מעדיף שהלוח האחרון יהיה כמה שיותר ריק (שארית שימושית)
    const last = r.slabs[r.slabs.length - 1];
    const lastUse = last ? last.placements.reduce((s, p) => s + p.block.w * p.block.h, 0) / (o.W * o.H) : 0;
    const score = r.unplaced.length * 1e6 + r.slabs.length * 1e3 + lastUse;
    if (score < bestScore) { best = r; bestScore = score; }
  }
  const res = best!;
  // שיבוצים ידניים שחופפים לחלק אחר או חורגים מהשוליים
  const overlaps = new Set<string>();
  res.slabs.forEach((sl) => sl.placements.forEach((a) => {
    if (!res.fixed.has(a.key)) return;
    if (a.block.x < o.margin - 0.5 || a.block.y < o.margin - 0.5 || a.block.x + a.block.w > o.W - o.margin + 0.5 || a.block.y + a.block.h > o.H - o.margin + 0.5) overlaps.add(a.key);
    for (const b of sl.placements) if (b !== a && hit({ x: a.block.x - o.kerf + 0.5, y: a.block.y - o.kerf + 0.5, w: a.block.w + 2 * o.kerf - 1, h: a.block.h + 2 * o.kerf - 1 }, b.block)) { overlaps.add(a.key); if (res.fixed.has(b.key)) overlaps.add(b.key); }
  }));
  const slabArea = res.slabs.length * o.W * o.H;
  const usedArea = res.slabs.reduce((s, sl) => s + sl.placements.reduce((t, p) => t + p.block.w * p.block.h, 0), 0);
  const pieceArea = project.pieces.reduce((s, p) => s + p.w * p.h, 0);
  const joints: Joint[] = blocks.filter((b) => b.segs > 1 && b.seg > 0 && !b.stripOf && !b.extra).map((b) => ({ pieceId: b.pieceId, at: b.off }));
  const apronLen = o.apronH > 0 ? project.pieces.reduce((s, p) => s + p.aprons.reduce((t, sd) => t + (sd === 'front' || sd === 'back' ? p.w : p.h), 0), 0) : 0;
  return {
    slabs: res.slabs.map((s) => ({ w: o.W, h: o.H, placements: s.placements, used: Math.round((s.placements.reduce((t, p) => t + p.block.w * p.block.h, 0) / (o.W * o.H)) * 100) })),
    unplaced: res.unplaced.map((b) => ({ pieceId: b.pieceId, len: b.L, wid: b.H, reason: b.lock ? 'גדול מהלוח (כיוון הגיד נעול)' : 'גדול מהלוח' })),
    joints,
    overlaps: [...overlaps],
    metrics: { slabs: res.slabs.length, utilization: slabArea ? Math.round((usedArea / slabArea) * 100) : 0, pieceArea, slabArea, apronLen, joints: joints.length },
  };
}

/** מלבן המקטע בקואורדינטות המקומיות של החלק (בתוך w×h). */
export function segLocal(p: Piece, pl: Placement): Rect {
  const wid = pieceWid(p), len = Math.max(1, Math.min(pl.len, pieceLen(p) - pl.off)); // גרונג 45° מאריך את השיבוץ מעבר לחלק
  return longIsX(p) ? { x: pl.off, y: 0, w: len, h: wid } : { x: 0, y: pl.off, w: wid, h: len };
}

/** נקודה מקומית בחלק → נקודה על הלוח (למיפוי טקסטורה מדויק = רצף גידים אמיתי). */
export function localToSlab(p: Piece, pl: Placement, lx: number, ly: number): { x: number; y: number } {
  const s = segLocal(p, pl), sameAxis = longIsX(p) !== pl.rot;
  if (sameAxis) return { x: pl.body.x + (lx - s.x), y: pl.body.y + (ly - s.y) };
  return { x: pl.body.x + (ly - s.y), y: pl.body.y + pl.body.h - (lx - s.x) };
}

/** מטריצת SVG שממפה את תמונת הלוח (במ"מ) אל מיקום המקטע (ox,oy = ראשית החלק במרחב היעד). */
export function slabToLocalMatrix(p: Piece, pl: Placement, ox = 0, oy = 0): string {
  const s = segLocal(p, pl), sameAxis = longIsX(p) !== pl.rot;
  if (sameAxis) return `matrix(1,0,0,1,${ox + s.x - pl.body.x},${oy + s.y - pl.body.y})`;
  return `matrix(0,1,-1,0,${ox + s.x + pl.body.h + pl.body.y},${oy + s.y - pl.body.x})`;
}
