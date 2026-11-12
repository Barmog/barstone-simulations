// נסטינג: שיבוץ חלקי המטבח על לוחות (ברירת מחדל 3200×1600 מ"מ). ללא תלות בדפדפן.
// כל חלק נחתך יחד עם פסי הקנט הארוכים שלו כ"בלוק" אחד, כדי שהגיד ימשיך מהמשטח אל הקנט.
import { Cutout, PLINTH_H, Piece, Project, Side, isVertical, longIsX, pieceLen, pieceWid } from './model';

/** מיפוי אפיני מנקודה מקומית בחלק לנקודה על הלוח: x = a·lx + b·ly + e, y = c·lx + d·ly + f. */
export type Affine = [a: number, b: number, c: number, d: number, e: number, f: number];

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
  /** חיפוי שנחתך צמוד למשטח שמתחתיו (המשכיות גידים): המפתח של שיבוץ המשטח, ומיפוי ישיר ללוח. */
  attached?: string;
  map?: Affine;
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

interface SplashSlot { piece: Piece; host: Piece; side: Side; low: boolean; start: number; end: number }
interface Block { key: string; pieceId: string; L: number; H: number; wid: number; seg: number; segs: number; off: number; lock: boolean; stripsBefore: Side[]; stripsAfter: Side[]; stripOf?: Side; extra?: string;
  /** אורך נוסף לפני ואחרי המקטע (חיפוי שממשיך לפינה), כיוון החלק, וחיפוי מוצמד. */
  lead?: number; tail?: number; lx?: boolean; splash?: SplashSlot }
const fullL = (b: Block) => b.L + (b.lead || 0) + (b.tail || 0);
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
  // חיפוי קיר נחתך צמוד לצלע הקיר של המשטח שמתחתיו, כדי שהגיד ימשיך מהמשטח אל החיפוי
  const byId = new Map(project.pieces.map((q) => [q.id, q])), attached = new Map<string, Piece>();
  for (const q of project.pieces) {
    if (q.kind !== 'splash' || !q.host || !q.side) continue;
    const h = byId.get(q.host); if (!h || isVertical(h) || h.outline) continue;
    const longSides: Side[] = longIsX(h) ? ['back', 'front'] : ['left', 'right'];
    const aprH = o.apronH > 0 ? h.aprons.filter((sd) => longSides.includes(sd)).length * (o.kerf + o.apronH) : 0;
    if (!longSides.includes(q.side) || attached.has(h.id) || pieceWid(h) + aprH + o.kerf + q.h > o.H - 2 * o.margin) continue;
    attached.set(h.id, q);
  }
  const glued = new Set([...attached.values()].map((q) => q.id));
  for (const p of project.pieces) {
    if (glued.has(p.id)) continue;
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
      const sq = attached.get(p.id), b: Block = { key: `${p.id}|${i}`, pieceId: p.id, L, wid, H: wid + (before.length + after.length) * (o.kerf + o.apronH), seg: i, segs, off: pts[i], lock: p.grainLock, stripsBefore: before, stripsAfter: after, lx };
      if (sq) {
        // החלק של החיפוי שמעל המקטע הזה; במקטע הראשון והאחרון הוא יכול להמשיך לפינה
        const s0 = sq.off || 0, s1 = s0 + sq.w, start = i === 0 ? s0 : Math.max(s0, pts[i]), end = i === segs - 1 ? s1 : Math.min(s1, pts[i + 1]);
        if (end - start > 1) { b.splash = { piece: sq, host: p, side: sq.side!, low: sq.side === longSides[0], start, end }; b.H += o.kerf + sq.h; b.lead = Math.max(0, pts[i] - start); b.tail = Math.max(0, end - pts[i + 1]); }
      }
      blocks.push(b);
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

function place(bl: Block, r: Rect & { rot: boolean }, slab: number, o: Opts): Placement[] {
  const step = o.kerf + o.apronH, sp = bl.splash, spH = sp ? o.kerf + sp.piece.h : 0;
  // הצד "הנמוך" (y קטן, או x קטן כשמסובב) של הבלוק: חלק לאורך y שלא מסובב מתהפך על הלוח
  const flip = !r.rot && bl.lx === false, low = flip ? bl.stripsAfter : bl.stripsBefore, high = flip ? bl.stripsBefore : bl.stripsAfter;
  const spLow = !!sp && sp.low !== flip, lowH = low.length * step + (spLow ? spH : 0), highStart = (sp && !spLow ? spH : 0) + o.kerf;
  const lead = bl.lead || 0, tail = bl.tail || 0;
  const strips: Strip[] = [];
  let body: Rect;
  if (!r.rot) {
    body = { x: r.x + lead, y: r.y + lowH, w: bl.L, h: bl.wid };
    low.forEach((sd, i) => strips.push({ side: sd, rect: { x: body.x, y: r.y + i * step, w: bl.L, h: o.apronH } }));
    high.forEach((sd, i) => strips.push({ side: sd, rect: { x: body.x, y: body.y + bl.wid + highStart + i * step, w: bl.L, h: o.apronH } }));
  } else {
    body = { x: r.x + lowH, y: r.y + (bl.lx === false ? lead : tail), w: bl.wid, h: bl.L };
    low.forEach((sd, i) => strips.push({ side: sd, rect: { x: r.x + i * step, y: body.y, w: o.apronH, h: bl.L } }));
    high.forEach((sd, i) => strips.push({ side: sd, rect: { x: body.x + bl.wid + highStart + i * step, y: body.y, w: o.apronH, h: bl.L } }));
  }
  const host: Placement = { key: bl.key, pieceId: bl.pieceId, slab, body, block: { x: r.x, y: r.y, w: r.w, h: r.h }, rot: r.rot, seg: bl.seg, segs: bl.segs, off: bl.off, len: bl.L, strips, stripOf: bl.stripOf, extra: bl.extra };
  if (!sp) return [host];
  // החיפוי: צמוד לצלע הקיר של המקטע, כך שהשורה התחתונה שלו ממשיכה את השורה האחורית של המשטח
  const h = sp.host, q = sp.piece, edge = (t: number): [number, number] => (sp.side === 'back' ? [t, 0] : sp.side === 'front' ? [t, h.h] : sp.side === 'left' ? [0, t] : [h.w, t]);
  const out: [number, number] = sp.side === 'back' ? [0, -1] : sp.side === 'front' ? [0, 1] : sp.side === 'left' ? [-1, 0] : [1, 0];
  const at = (lx: number, ly: number) => localToSlab(h, host, lx, ly), E0 = at(...edge(0)), E1 = at(...edge(1)), [ex, ey] = edge(0), N = at(ex + out[0], ey + out[1]);
  const u = { x: E1.x - E0.x, y: E1.y - E0.y }, n = { x: N.x - E0.x, y: N.y - E0.y }, s0 = q.off || 0, gap = o.kerf + q.h;
  const map: Affine = [u.x, -n.x, u.y, -n.y, E0.x + u.x * s0 + n.x * gap, E0.y + u.y * s0 + n.y * gap];
  const pt = (lx: number, ly: number) => ({ x: map[0] * lx + map[1] * ly + map[4], y: map[2] * lx + map[3] * ly + map[5] });
  const c1 = pt(sp.start - s0, 0), c2 = pt(sp.end - s0, q.h), rect = { x: Math.round(Math.min(c1.x, c2.x)), y: Math.round(Math.min(c1.y, c2.y)), w: Math.round(Math.abs(c2.x - c1.x)), h: Math.round(Math.abs(c2.y - c1.y)) };
  return [host, { key: `${q.id}|${bl.seg}`, pieceId: q.id, slab, body: rect, block: rect, rot: r.rot, seg: bl.seg, segs: bl.segs, off: sp.start - s0, len: sp.end - sp.start, strips: [], attached: bl.key, map }];
}

function pack(blocks: Block[], o: Opts, manual: Manual = {}, bookmatch = false) {
  const slabs: { mr: ReturnType<typeof maxRects>; placements: Placement[] }[] = [];
  const unplaced: Block[] = [];
  const fits = (b: Block) => (fullL(b) <= o.W - 2 * o.margin && b.H <= o.H - 2 * o.margin) || (!b.lock && b.H <= o.W - 2 * o.margin && fullL(b) <= o.H - 2 * o.margin);
  const slabAt = (i: number) => { while (slabs.length <= i) slabs.push({ mr: maxRects(o.W, o.H, o), placements: [] }); return slabs[i]; };
  // קודם החלקים שסודרו ידנית: הם תופסים את מקומם, והשאר מסתדרים סביבם
  const fixed = new Set<string>();
  for (const bl of blocks) {
    const m = manual[bl.key]; if (!m || !fits(bl)) continue;
    const rot = !!m.rot && !bl.lock, w = rot ? bl.H : fullL(bl), h = rot ? fullL(bl) : bl.H;
    if (w > o.W || h > o.H) continue;
    const r = { x: Math.round(Math.max(0, Math.min(o.W - w, m.x))), y: Math.round(Math.max(0, Math.min(o.H - h, m.y))), w, h, rot }, s = slabAt(Math.max(0, Math.min(40, Math.round(m.slab))));
    s.mr.take(r); s.placements.push(...place(bl, r, slabs.indexOf(s), o)); fixed.add(bl.key);
  }
  // בוק־מאץ': חלק עם חיבור נחתך מזוג לוחות (A ו-B במראה), והמקטע השני יושב במקום המשלים — כך הגיד נפתח כמו ספר על החיבור
  if (bookmatch) {
    const free = (sl: number, r: Rect) => !slabAt(sl).placements.some((p) => hit({ x: r.x - o.kerf, y: r.y - o.kerf, w: r.w + 2 * o.kerf, h: r.h + 2 * o.kerf }, p.block));
    const cur = new Map<number, number>();
    for (const a of blocks) {
      if (a.seg !== 0 || a.segs !== 2 || a.stripOf || a.extra || fixed.has(a.key)) continue;
      const b = blocks.find((x) => x.pieceId === a.pieceId && x.seg === 1 && !x.stripOf && !x.extra);
      if (!b || fixed.has(b.key) || fullL(a) > o.W - 2 * o.margin || b.L + (b.tail || 0) > a.L + (a.lead || 0)) continue;
      const hh = Math.max(a.H, b.H);
      for (let k = 0; k < 40; k += 2) {
        let y = cur.get(k) ?? o.margin, ok = false, ra = { x: 0, y: 0, w: 0, h: 0, rot: false }, rb = ra;
        for (; y + hh <= o.H - o.margin; y += 20) {
          ra = { x: o.margin, y, w: fullL(a), h: a.H, rot: false }; rb = { x: o.W - (o.margin + (a.lead || 0) + a.L), y, w: fullL(b), h: b.H, rot: false };
          if (free(k, ra) && free(k + 1, rb)) { ok = true; break; }
        }
        if (!ok) continue;
        slabAt(k).mr.take(ra); slabAt(k).placements.push(...place(a, ra, k, o));
        slabAt(k + 1).mr.take(rb); slabAt(k + 1).placements.push(...place(b, rb, k + 1, o));
        fixed.add(a.key); fixed.add(b.key); cur.set(k, y + hh + o.kerf); break;
      }
    }
  }
  for (const bl of blocks) {
    if (fixed.has(bl.key)) continue;
    if (!fits(bl)) { unplaced.push(bl); continue; }
    let done = false;
    for (let i = 0; i < slabs.length && !done; i++) {
      const r = slabs[i].mr.find(fullL(bl), bl.H, !bl.lock);
      if (r) { slabs[i].mr.take(r); slabs[i].placements.push(...place(bl, r, i, o)); done = true; }
    }
    if (!done) {
      const s = slabAt(slabs.length), r = s.mr.find(fullL(bl), bl.H, !bl.lock)!;
      s.mr.take(r); s.placements.push(...place(bl, r, slabs.length - 1, o));
    }
  }
  while (slabs.length && !slabs[slabs.length - 1].placements.length) slabs.pop();
  return { slabs, unplaced, fixed };
}

const ORDERS: ((a: Block, b: Block) => number)[] = [
  (a, b) => b.H * fullL(b) - a.H * fullL(a), (a, b) => Math.max(fullL(b), b.H) - Math.max(fullL(a), a.H), (a, b) => b.H - a.H || fullL(b) - fullL(a), (a, b) => fullL(b) - fullL(a) || b.H - a.H,
];

export function nest(project: Project): NestResult {
  const o: Opts = { W: project.slabW, H: project.slabH, kerf: project.kerf, margin: project.margin, apronH: project.apronH };
  const blocks = toBlocks(project, o);
  let best: ReturnType<typeof pack> | null = null, bestScore = Infinity;
  for (const ord of ORDERS) {
    const r = pack([...blocks].sort(ord), o, project.manual, project.bookmatch === 'yes');
    // פחות לוחות קודם; בשוויון — מעדיף שהלוח האחרון יהיה כמה שיותר ריק (שארית שימושית)
    const last = r.slabs[r.slabs.length - 1];
    const lastUse = last ? last.placements.filter((p) => !p.attached).reduce((s, p) => s + p.block.w * p.block.h, 0) / (o.W * o.H) : 0;
    const score = r.unplaced.length * 1e6 + r.slabs.length * 1e3 + lastUse;
    if (score < bestScore) { best = r; bestScore = score; }
  }
  const res = best!;
  // שיבוצים ידניים שחופפים לחלק אחר או חורגים מהשוליים
  const overlaps = new Set<string>();
  res.slabs.forEach((sl) => sl.placements.forEach((a) => {
    if (!res.fixed.has(a.key) || a.attached) return;
    if (a.block.x < o.margin - 0.5 || a.block.y < o.margin - 0.5 || a.block.x + a.block.w > o.W - o.margin + 0.5 || a.block.y + a.block.h > o.H - o.margin + 0.5) overlaps.add(a.key);
    for (const b of sl.placements) if (b !== a && b.attached !== a.key && hit({ x: a.block.x - o.kerf + 0.5, y: a.block.y - o.kerf + 0.5, w: a.block.w + 2 * o.kerf - 1, h: a.block.h + 2 * o.kerf - 1 }, b.block)) { overlaps.add(a.key); if (res.fixed.has(b.key)) overlaps.add(b.key); }
  }));
  const slabArea = res.slabs.length * o.W * o.H;
  const usedArea = res.slabs.reduce((s, sl) => s + sl.placements.filter((p) => !p.attached).reduce((t, p) => t + p.block.w * p.block.h, 0), 0);
  const pieceArea = project.pieces.reduce((s, p) => s + p.w * p.h, 0);
  const joints: Joint[] = blocks.filter((b) => b.segs > 1 && b.seg > 0 && !b.stripOf && !b.extra).map((b) => ({ pieceId: b.pieceId, at: b.off }));
  const apronLen = o.apronH > 0 ? project.pieces.reduce((s, p) => s + p.aprons.reduce((t, sd) => t + (sd === 'front' || sd === 'back' ? p.w : p.h), 0), 0) : 0;
  return {
    slabs: res.slabs.map((s) => ({ w: o.W, h: o.H, placements: s.placements, used: Math.round((s.placements.filter((p) => !p.attached).reduce((t, p) => t + p.block.w * p.block.h, 0) / (o.W * o.H)) * 100) })),
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
  if (pl.map) { const m = pl.map; return { x: m[0] * lx + m[1] * ly + m[4], y: m[2] * lx + m[3] * ly + m[5] }; }
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
