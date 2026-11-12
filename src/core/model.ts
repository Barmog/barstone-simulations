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
  /** חלק אנכי: היסט מתחילת הצלע (שלילי = ממשיך אחורה עד הפינה). */
  off?: number;
  /** צדדים עם קנט (פס אבן מודבק בגרונג, נחתך צמוד לחלק לשמירת רצף הגיד). */
  aprons: Side[];
  /** נעילת כיוון גיד: true = החלק לא מסתובב על הלוח. */
  grainLock: boolean;
  /** היכן לשים חיבור כשהחלק ארוך מהלוח: אוטומטי (רחוק מפתחים), במרכז הכיור או במרכז הכיריים. */
  joint?: 'auto' | 'sink' | 'cooktop';
  /** חיבור הפינה עם המשטח הסמוך: ישר או גרונג 45°. */
  corner?: 'butt' | 'miter';
  /** מיקומי חיבור ידניים לאורך החלק (מ"מ מתחילתו). ריק = לפי joint. */
  jointAt?: number[];
  /** ישיבה (דלפק / אי): הצד שבו המשטח בולט מעבר לארונות, עומק הבליטה ומספר הכיסאות. */
  seat?: Side;
  seatDepth?: number;
  chairs?: number;
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
  /** כיור בנוי מאבן (נחתך מהלוח) או כיור קנוי. */
  built?: boolean;
  /** רוחב ארון הכיור במ"מ (600 / 700 / 800 / 900). */
  cabinet?: number;
  /** קערה אחת, כפול חצי-חצי, או כפול גדול + קטן. */
  bowls?: 'single' | 'even' | 'ls';
  /** כיור בנוי: מכסה ניקוז (ונטיל) מאותה אבן. */
  drainCover?: boolean;
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
  wallColor?: string;
  floor: string;
  pieces: Piece[];
  cutouts: Cutout[];
  /** האם הדגם מגיע בוק־מאץ' (לוחות במראה) — מאפשר התאמת גידים בין לוחות. */
  bookmatch?: 'yes' | 'no' | 'unknown';
  light?: 'day' | 'evening';
  kelvin?: 3000 | 4000 | 6000;
  disposal?: boolean;
  water?: boolean;
  /** הצגת פנים הארונות (שקוף) — לראות טוחן ומערכת מים. */
  xray?: boolean;
  /** תאורה מתחת לארונות העליונים (ברירת מחדל: דולקת). */
  underLight?: boolean;
  /** גובה הארונות העליונים במ"מ (הקו העליון קבוע ב-220 ס"מ). */
  upperH?: number;
  upperStyle?: UpperStyle;
  /** צבע חזיתות עליונות (ריק = כמו התחתונים) וגוון הזכוכית. */
  upperColor?: string;
  glassTint?: string;
  /** צוקל מאבן (נכנס לנסטינג) במקום צוקל רגיל. */
  plinthStone?: boolean;
  /** גימור פני האבן: מבריק / מט / סטרקצ׳ר (לפי מה שהדגם מגיע בו). */
  finish?: 'polished' | 'matte' | 'structure';
  /** מכשירים בהדמיה: קולט אדים, מקרר ותנור בארון גבוה. */
  appliances?: boolean;
  /** דגם וגימור הברז מהקטלוג. */
  faucet?: string;
  faucetFinish?: string;
  /** סידור ידני על הלוחות: מפתח שיבוץ → לוח ומיקום. שאר החלקים מסתדרים סביבם. */
  manual?: Record<string, { slab: number; x: number; y: number; rot?: boolean }>;
  notes: string;
  source: 'manual' | 'dxf' | 'plan' | 'template';
}

export type UpperStyle = 'doors' | 'klapa' | 'glass' | 'shelves';
export const UPPER_HE: Record<UpperStyle, string> = { doors: 'דלתות', klapa: 'קלאפות', glass: 'זכוכית', shelves: 'מדפים פתוחים' };
export const SLAB = { w: 3200, h: 1600 };
/** הקו העליון של הארונות העליונים, וגובה תחתיתם מהרצפה. */
export const UPPER_TOP = 2200, PLINTH_H = 100, SEAT_DEPTH = 300, CHAIR_W = 600;
export const upperBottom = (p: Project) => UPPER_TOP - Math.max(300, Math.min(1200, p.upperH || 700));
/** מספר הכיסאות לאורך צד הישיבה (כיסא לכל 60 ס"מ, אלא אם נקבע ידנית). */
export const chairCount = (p: Piece) => (p.seat ? p.chairs ?? Math.max(1, Math.floor(sideLen(p, p.seat) / CHAIR_W)) : 0);

let seq = 0;
export const uid = (p = 'p') => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function emptyProject(name = 'הדמיה חדשה'): Project {
  return {
    v: 1, name, stoneId: null, thickness: 12, apronH: 40, kerf: 4, margin: 10, slabW: SLAB.w, slabH: SLAB.h,
    counterH: 900, cabinets: true, uppers: true, cabinetColor: '#f4f3ef', wallColor: '#f4f2ee', floor: 'oak',
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

/** נטו משוער של כיור לפי רוחב הארון (פלוס־מינוס; תלוי בדגם ובפרזול). */
export function sinkNet(cabinet: number, built: boolean, thickness: number) {
  const w = built ? cabinet - 36 - 2 * thickness - 4 : cabinet - 100;
  return { w: Math.max(250, Math.round(w)), h: 400 };
}

/** פינות: חלק שנפגש עם חלק אחר בצלע משותפת. מחזיר את קו החיבור (ישר או אלכסון 45°). */
export function corners(p: Project): { a: Piece; b: Piece; x1: number; y1: number; x2: number; y2: number; miter: boolean }[] {
  const flat = p.pieces.filter((q) => !isVertical(q) && q.kind !== 'panel'), out = [];
  for (const b of flat) for (const a of flat) {
    if (a === b || b.h <= b.w) continue; // b = הרגל (ארוכה לאורך y)
    const below = Math.abs(b.y - (a.y + a.h)) < 3, above = Math.abs(b.y + b.h - a.y) < 3;
    // רגל בגובה מלא (המשטח הראשי נצמד לצד שלה): החיבור אנכי, בקצה המשטח הראשי
    const sideR = Math.abs(b.x - (a.x + a.w)) < 3, sideL = Math.abs(b.x + b.w - a.x) < 3;
    if ((sideR || sideL) && !(below || above) && a.w > a.h && b.y <= a.y + 3 && b.y + b.h >= a.y + a.h - 3) {
      const ex = sideR ? b.x : b.x + b.w; out.push({ a, b, x1: ex, y1: a.y, x2: ex, y2: a.y + a.h, miter: b.corner === 'miter' }); continue;
    }
    if (!(below || above) || b.x < a.x - 3 || b.x + b.w > a.x + a.w + 3) continue;
    const ey = below ? a.y + a.h : a.y, miter = b.corner === 'miter';
    if (!miter) { out.push({ a, b, x1: b.x, y1: ey, x2: b.x + b.w, y2: ey, miter }); continue; }
    const outerRight = b.x + b.w / 2 > a.x + a.w / 2, oy = below ? a.y : a.y + a.h;
    out.push({ a, b, x1: outerRight ? b.x : b.x + b.w, y1: ey, x2: outerRight ? b.x + b.w : b.x, y2: oy, miter });
  }
  return out;
}

/** כמה צלע הקיר של משטח צריכה להמשיך לפני תחילתה ואחרי סופה, עד הקיר של משטח ניצב (פינת L / U). */
export function cornerExt(p: Project, host: Piece): { lead: number; tail: number } {
  const out = { lead: 0, tail: 0 }; if (!host.wall) return out;
  const e = hostEdge(host, host.wall), x1 = e.x + e.dx * e.len, y1 = e.y + e.dy * e.len, near = (a: number, b: number) => Math.abs(a - b) < 6;
  for (const q of p.pieces) {
    if (q === host || isVertical(q) || q.kind !== 'counter' || !q.wall) continue;
    if (e.dy) { // צלע לאורך y: מחפשים משטח עם קיר אחורי/קדמי שנוגע בתחילתה או בסופה
      if (e.x < q.x - 6 || e.x > q.x + q.w + 6) continue;
      if (q.wall === 'back' && near(q.y + q.h, e.y) && q.y < e.y) out.lead = Math.max(out.lead, e.y - q.y);
      if (q.wall === 'front' && near(q.y, y1) && q.y + q.h > y1) out.tail = Math.max(out.tail, q.y + q.h - y1);
    } else {
      if (e.y < q.y - 6 || e.y > q.y + q.h + 6) continue;
      if (q.wall === 'left' && near(q.x + q.w, e.x) && q.x < e.x) out.lead = Math.max(out.lead, e.x - q.x);
      if (q.wall === 'right' && near(q.x, x1) && q.x + q.w > x1) out.tail = Math.max(out.tail, q.x + q.w - x1);
    }
  }
  return out;
}

/** חיפוי קיר בלחיצה: בלי / 60 ס"מ / עד הארונות העליונים / עד התקרה. בפינה החיפוי ממשיך עד החיפוי של הקיר הניצב. */
export function setSplash(pr: Project, mode: 'none' | '60' | 'uppers' | 'ceiling' | number): Project {
  const hosts = pr.pieces.filter((q) => q.kind === 'counter' && q.wall), ids = new Set(hosts.map((q) => q.id));
  const rest = pr.pieces.filter((q) => !(q.kind === 'splash' && q.host && ids.has(q.host)));
  if (mode === 'none') return { ...pr, pieces: rest };
  const h = typeof mode === 'number' ? mode : mode === '60' ? 600 : mode === 'uppers' ? upperBottom(pr) - pr.counterH : Math.min(2500 - pr.counterH, pr.slabH - 2 * pr.margin);
  return { ...pr, pieces: [...rest, ...hosts.map((q) => {
    const { lead, tail } = cornerExt(pr, q), a = lead ? lead - pr.thickness : 0, b = tail ? tail - pr.thickness : 0;
    return piece({ kind: 'splash', name: 'חיפוי קיר', w: sideLen(q, q.wall!) + a + b, h, host: q.id, side: q.wall, off: a ? -a : undefined });
  })] };
}
