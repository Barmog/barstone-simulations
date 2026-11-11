// מודל המטבח האחיד — מקור האמת היחיד לכל המסכים. כל המידות במ"מ.
// מערכת צירים בתוכנית: x ימינה, y כלפי מטה (הקיר האחורי של המשטח הראשי ב-y הקטן).

export type Side = 'back' | 'front' | 'left' | 'right';
export type PieceKind = 'counter' | 'island' | 'splash' | 'waterfall' | 'panel';
export type CutoutKind = 'sink' | 'cooktop' | 'faucet' | 'hole';
export interface Pt { x: number; y: number }

export interface Piece {
  id: string;
  name: string;
  kind: PieceKind;
  /** מיקום בתוכנית (פינה שמאלית-עליונה). לחלקים אנכיים (חיפוי/מפל) מחושב מהמארח. */
  x: number;
  y: number;
  /** חלק אופקי: טביעת הרגל בתוכנית. חלק אנכי: w = אורך, h = גובה. */
  w: number;
  h: number;
  /** הצד שצמוד לקיר (למשטחים) — קובע היכן הארונות והחיפוי. */
  wall?: Side;
  /** חלק אנכי: לאיזה חלק ולאיזה צד הוא צמוד. */
  host?: string;
  side?: Side;
  /** צדדים עם קנט (פס אבן מודבק בגרונג, נחתך צמוד לחלק לשמירת רצף הגיד). */
  aprons: Side[];
  /** נעילת כיוון גיד: true = החלק לא מסתובב על הלוח. */
  grainLock: boolean;
  /** מתאר מדויק (מ-DXF), בקואורדינטות מקומיות בתוך w×h. ריק = מלבן. */
  outline?: Pt[];
}

export interface Cutout {
  id: string;
  pieceId: string;
  kind: CutoutKind;
  name?: string;
  /** מיקום ומידות בקואורדינטות מקומיות של החלק. */
  x: number;
  y: number;
  w: number;
  h: number;
  round?: boolean;
  /** כיור: התקנה תחתונה / שטוחה / עליונה. */
  mount?: 'under' | 'flush' | 'top';
}

export interface Project {
  v: 1;
  name: string;
  stoneId: number | string | null;
  thickness: number;
  /** גובה הקנט הנראה (מ"מ). 0 = בלי קנט. */
  apronH: number;
  kerf: number;
  margin: number;
  slabW: number;
  slabH: number;
  counterH: number;
  cabinets: boolean;
  uppers: boolean;
  cabinetColor: string;
  floor: string;
  pieces: Piece[];
  cutouts: Cutout[];
  notes: string;
  source: 'manual' | 'dxf' | 'plan' | 'template';
}

export const SLAB = { w: 3200, h: 1600 };

let seq = 0;
export const uid = (p = 'p') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function emptyProject(name = 'הדמיה חדשה'): Project {
  return {
    v: 1, name, stoneId: null, thickness: 12, apronH: 40, kerf: 4, margin: 10, slabW: SLAB.w, slabH: SLAB.h,
    counterH: 900, cabinets: true, uppers: true, cabinetColor: '#f2efe9', floor: 'oak',
    pieces: [], cutouts: [], notes: '', source: 'manual',
  };
}

export const isVertical = (p: Piece) => p.kind === 'splash' || p.kind === 'waterfall';
export const sideLen = (p: Piece, s: Side) => (s === 'front' || s === 'back' ? p.w : p.h);
/** האם הציר הארוך של החלק הוא ציר x (בתוכנית / במערכת המקומית). */
export const longIsX = (p: Piece) => isVertical(p) || p.w >= p.h;
export const pieceLen = (p: Piece) => (longIsX(p) ? p.w : p.h);
export const pieceWid = (p: Piece) => (longIsX(p) ? p.h : p.w);

export const KIND_HE: Record<PieceKind, string> = { counter: 'משטח', island: 'אי', splash: 'חיפוי קיר', waterfall: 'מפל', panel: 'פאנל' };
export const CUT_HE: Record<CutoutKind, string> = { sink: 'כיור', cooktop: 'כיריים', faucet: 'חור ברז', hole: 'פתח' };
export const SIDE_HE: Record<Side, string> = { back: 'אחורי', front: 'קדמי', left: 'שמאל', right: 'ימין' };

/** אותיות A, B, C… לחלקים לפי הסדר. */
export const letter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26)}`);

export function piece(partial: Partial<Piece> & Pick<Piece, 'kind' | 'w' | 'h'>): Piece {
  return { id: uid(), name: KIND_HE[partial.kind], x: 0, y: 0, aprons: [], grainLock: true, ...partial };
}

/** קו הקיר/הצמדה של חלק אנכי בתוכנית: נקודת התחלה, כיוון ונורמל (כלפי חוץ מהמארח). */
export function hostEdge(host: Piece, side: Side) {
  switch (side) {
    case 'back': return { x: host.x, y: host.y, dx: 1, dy: 0, nx: 0, ny: -1, len: host.w };
    case 'front': return { x: host.x, y: host.y + host.h, dx: 1, dy: 0, nx: 0, ny: 1, len: host.w };
    case 'left': return { x: host.x, y: host.y, dx: 0, dy: 1, nx: -1, ny: 0, len: host.h };
    case 'right': return { x: host.x + host.w, y: host.y, dx: 0, dy: 1, nx: 1, ny: 0, len: host.h };
  }
}

export function bounds(p: Project) {
  const hs = p.pieces.filter((q) => !isVertical(q));
  if (!hs.length) return { x: 0, y: 0, w: 3000, h: 2000 };
  const x0 = Math.min(...hs.map((q) => q.x)), y0 = Math.min(...hs.map((q) => q.y));
  const x1 = Math.max(...hs.map((q) => q.x + q.w)), y1 = Math.max(...hs.map((q) => q.y + q.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ---------- תבניות התחלה ----------
export type TemplateId = 'straight' | 'l' | 'u' | 'island' | 'l-island';
export const TEMPLATES: { id: TemplateId; name: string }[] = [
  { id: 'straight', name: 'ישר' }, { id: 'l', name: 'צורת L' }, { id: 'u', name: 'צורת U' },
  { id: 'island', name: 'ישר + אי' }, { id: 'l-island', name: 'L + אי' },
];

export function fromTemplate(id: TemplateId, name = 'הדמיה חדשה'): Project {
  const p = emptyProject(name); p.source = 'template';
  const L = 3000, D = 620;
  const main = piece({ kind: 'counter', name: 'משטח ראשי', x: 0, y: 0, w: L, h: D, wall: 'back', aprons: ['front'] });
  p.pieces.push(main);
  p.cutouts.push(
    { id: uid('c'), pieceId: main.id, kind: 'sink', x: 450, y: 110, w: 760, h: 400, mount: 'under' },
    { id: uid('c'), pieceId: main.id, kind: 'faucet', x: 812, y: 38, w: 35, h: 35, round: true },
    { id: uid('c'), pieceId: main.id, kind: 'cooktop', x: 1850, y: 65, w: 560, h: 490 },
  );
  if (id === 'l' || id === 'l-island' || id === 'u') p.pieces.push(piece({ kind: 'counter', name: 'משטח L', x: L - D, y: D, w: D, h: 1800, wall: 'right', aprons: ['left'] }));
  if (id === 'u') p.pieces.push(piece({ kind: 'counter', name: 'משטח U', x: 0, y: D, w: D, h: 1800, wall: 'left', aprons: ['right'] }));
  if (id === 'island' || id === 'l-island') {
    const isl = piece({ kind: 'island', name: 'אי', x: id === 'l-island' ? 0 : 400, y: D + 1100, w: id === 'l-island' ? 1900 : 2200, h: 1000, aprons: ['front', 'back', 'left', 'right'] });
    p.pieces.push(isl);
  }
  p.pieces.push(piece({ kind: 'splash', name: 'חיפוי קיר', w: L, h: 600, host: main.id, side: 'back' }));
  return p;
}

/** המרת הדמיה מהמערכת הישנה (שדות בס"מ) למודל האחיד. */
export function fromLegacy(sim: Record<string, any>): Project {
  const T = (v: any, d = 0) => Math.round((+v || d) * 10);
  const p = emptyProject(String(sim.client_name || 'הדמיה'));
  p.stoneId = sim.stone_id ?? null; p.thickness = T(sim.thickness_cm, 2); p.apronH = sim.edge === false ? 0 : +sim.edge_mm || 40; p.kerf = +sim.kerf_mm || 4;
  const L = T(sim.length_cm), D = T(sim.depth_cm, 60);
  const ap: Side[] = p.apronH ? ['front'] : [];
  const main = piece({ kind: 'counter', name: 'משטח ראשי', x: 0, y: 0, w: L, h: D, wall: 'back', aprons: ap });
  p.pieces.push(main);
  const byKey: Record<string, Piece> = { A: main };
  if (T(sim.l_length_cm)) { const d2 = T(sim.l_depth_cm) || D; byKey.B = piece({ kind: 'counter', name: 'משטח L', x: L - d2, y: D, w: d2, h: T(sim.l_length_cm), wall: 'right', aprons: p.apronH ? ['left'] : [] }); p.pieces.push(byKey.B); }
  if (T(sim.island_l_cm)) {
    const il = T(sim.island_l_cm), iw = T(sim.island_w_cm, 90);
    byKey.C = piece({ kind: 'island', name: 'אי', x: Math.max(0, (L - il) / 2), y: D + 1000 + (byKey.B ? 0 : 0), w: il, h: iw, aprons: p.apronH ? ['front', 'back'] : [] }); p.pieces.push(byKey.C);
    if (sim.island_waterfall) for (const s of ['left', 'right'] as Side[]) p.pieces.push(piece({ kind: 'waterfall', name: `מפל אי · ${SIDE_HE[s]}`, w: iw, h: p.counterH - p.thickness, host: byKey.C.id, side: s }));
  }
  if (T(sim.splash_h_cm)) p.pieces.push(piece({ kind: 'splash', name: 'חיפוי קיר', w: L, h: T(sim.splash_h_cm), host: main.id, side: 'back' }));
  const along = (host: Piece, cx: any, w: number) => { const len = pieceLen(host); const c = +cx > 0 ? T(cx) : len / 2; return Math.round(Math.min(len - w - 60, Math.max(60, c - w / 2))); };
  const put = (host: Piece, kind: CutoutKind, a: number, w: number, d: number, extra: Partial<Cutout> = {}) => {
    const across = Math.round((pieceWid(host) - d) / 2);
    p.cutouts.push(longIsX(host) ? { id: uid('c'), pieceId: host.id, kind, x: a, y: across, w, h: d, ...extra } : { id: uid('c'), pieceId: host.id, kind, x: across, y: a, w: d, h: w, ...extra });
  };
  if (sim.sink) {
    const host = byKey[sim.sink_piece] || main, w = T(sim.sink_w_cm, 60), d = Math.min(T(sim.sink_d_cm, 40), pieceWid(host) - 100), a = along(host, sim.sink_x_cm, w);
    put(host, 'sink', a, w, d, { mount: 'under' });
    if (sim.faucet_hole !== false && longIsX(host)) p.cutouts.push({ id: uid('c'), pieceId: host.id, kind: 'faucet', x: a + w / 2 - 17, y: Math.max(15, (pieceWid(host) - d) / 4 - 17), w: 35, h: 35, round: true });
  }
  if (sim.cooktop) { const host = byKey[sim.cooktop_piece] || main, w = T(sim.cooktop_w_cm, 56), d = T(sim.cooktop_d_cm, 49); put(host, 'cooktop', along(host, sim.cooktop_x_cm, w), w, d); }
  return p;
}
