// קורא DXF (ASCII): מחלץ מתארים סגורים → חלקים, ומתארים פנימיים → פתחים (כיור / כיריים / ברז).
// נתמך: LWPOLYLINE, POLYLINE, LINE, ARC, CIRCLE, וגם INSERT של בלוקים (הזזה/קנה מידה/סיבוב).
import { Cutout, CutoutKind, Piece, Project, Pt, emptyProject, uid } from './model';

interface Ent { type: string; layer: string; pts: Pt[]; closed: boolean; circle?: { cx: number; cy: number; r: number } }
type Pair = [number, string];

function pairs(text: string): Pair[] {
  const lines = text.split(/\r\n|\r|\n/), out: Pair[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) out.push([parseInt(lines[i].trim(), 10), lines[i + 1].trim()]);
  return out;
}

function arcPts(cx: number, cy: number, r: number, a0: number, a1: number): Pt[] {
  if (a1 < a0) a1 += 360;
  const n = Math.max(4, Math.ceil((a1 - a0) / 10)), pts: Pt[] = [];
  for (let i = 0; i <= n; i++) { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); }
  return pts;
}

/** קשת בין שתי נקודות לפי bulge של פוליליין. */
function bulgePts(a: Pt, b: Pt, bulge: number): Pt[] {
  const th = 4 * Math.atan(bulge), d = Math.hypot(b.x - a.x, b.y - a.y);
  if (!d || Math.abs(bulge) < 1e-6) return [b];
  const r = d / (2 * Math.sin(th / 2)), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, h = r * Math.cos(th / 2);
  const cx = mx - (h * (b.y - a.y)) / d, cy = my + (h * (b.x - a.x)) / d;
  const s = Math.atan2(a.y - cy, a.x - cx), n = Math.max(3, Math.ceil(Math.abs(th) / (Math.PI / 18))), out: Pt[] = [];
  for (let i = 1; i <= n; i++) { const t = s + (th * i) / n; out.push({ x: cx + Math.abs(r) * Math.cos(t), y: cy + Math.abs(r) * Math.sin(t) }); }
  return out;
}

function readEntities(ps: Pair[], from: number, to: number, blocks: Record<string, Ent[]>, depth = 0): Ent[] {
  const ents: Ent[] = [];
  let i = from;
  const next = () => { let j = i + 1; while (j < to && ps[j][0] !== 0) j++; return j; };
  while (i < to) {
    if (ps[i][0] !== 0) { i++; continue; }
    const type = ps[i][1], end = next(), g = ps.slice(i + 1, end);
    const num = (c: number, d = 0) => { const f = g.find((p) => p[0] === c); return f ? parseFloat(f[1]) : d; };
    const layer = g.find((p) => p[0] === 8)?.[1] || '0';
    if (type === 'LWPOLYLINE') {
      const raw: (Pt & { b: number })[] = [];
      for (const [c, v] of g) { if (c === 10) raw.push({ x: parseFloat(v), y: 0, b: 0 }); else if (c === 20 && raw.length) raw[raw.length - 1].y = parseFloat(v); else if (c === 42 && raw.length) raw[raw.length - 1].b = parseFloat(v); }
      const closed = (num(70) & 1) === 1, pts: Pt[] = [];
      raw.forEach((p, k) => { if (!k) pts.push({ x: p.x, y: p.y }); const nx = raw[k + 1] || (closed ? raw[0] : null); if (nx) pts.push(...bulgePts(p, nx, p.b)); });
      if (closed && pts.length > 1) pts.pop();
      ents.push({ type, layer, pts, closed });
    } else if (type === 'POLYLINE') {
      const closed = (num(70) & 1) === 1, pts: Pt[] = [];
      let j = end;
      while (j < to && ps[j][0] === 0 && ps[j][1] === 'VERTEX') { let k = j + 1, x = 0, y = 0; while (k < to && ps[k][0] !== 0) { if (ps[k][0] === 10) x = parseFloat(ps[k][1]); if (ps[k][0] === 20) y = parseFloat(ps[k][1]); k++; } pts.push({ x, y }); j = k; }
      ents.push({ type, layer, pts, closed }); i = j; continue;
    } else if (type === 'LINE') ents.push({ type, layer, pts: [{ x: num(10), y: num(20) }, { x: num(11), y: num(21) }], closed: false });
    else if (type === 'ARC') ents.push({ type, layer, pts: arcPts(num(10), num(20), num(40), num(50), num(51)), closed: false });
    else if (type === 'CIRCLE') ents.push({ type, layer, pts: arcPts(num(10), num(20), num(40), 0, 360).slice(0, -1), closed: true, circle: { cx: num(10), cy: num(20), r: num(40) } });
    else if (type === 'INSERT' && depth < 4) {
      const name = g.find((p) => p[0] === 2)?.[1] || '', src = blocks[name];
      if (src) {
        const tx = num(10), ty = num(20), sx = num(41, 1), sy = num(42, 1), rot = (num(50) * Math.PI) / 180, c = Math.cos(rot), s = Math.sin(rot);
        const tf = (p: Pt) => ({ x: tx + p.x * sx * c - p.y * sy * s, y: ty + p.x * sx * s + p.y * sy * c });
        for (const e of src) ents.push({ ...e, pts: e.pts.map(tf), circle: e.circle ? { cx: tf({ x: e.circle.cx, y: e.circle.cy }).x, cy: tf({ x: e.circle.cx, y: e.circle.cy }).y, r: e.circle.r * Math.abs(sx) } : undefined });
      }
    }
    i = end;
  }
  return ents;
}

/** חיבור קטעים פתוחים (LINE/ARC/פוליליין פתוח) ללולאות סגורות לפי קצוות משותפים. */
function chain(open: Ent[], tol: number): Ent[] {
  const segs = open.filter((e) => e.pts.length >= 2).map((e) => ({ pts: [...e.pts], layer: e.layer, used: false }));
  const near = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) <= tol;
  const loops: Ent[] = [];
  for (const s of segs) {
    if (s.used) continue;
    s.used = true;
    let pts = [...s.pts], grew = true;
    while (grew && !near(pts[0], pts[pts.length - 1])) {
      grew = false;
      for (const t of segs) {
        if (t.used) continue;
        const end = pts[pts.length - 1];
        if (near(end, t.pts[0])) { pts = pts.concat(t.pts.slice(1)); t.used = grew = true; break; }
        if (near(end, t.pts[t.pts.length - 1])) { pts = pts.concat([...t.pts].reverse().slice(1)); t.used = grew = true; break; }
      }
    }
    if (pts.length >= 4 && near(pts[0], pts[pts.length - 1])) { pts.pop(); loops.push({ type: 'LOOP', layer: s.layer, pts, closed: true }); }
  }
  return loops;
}

const area = (pts: Pt[]) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p.x * q.y - q.x * p.y; }, 0) / 2);
const bbox = (pts: Pt[]) => { const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; };
function inside(pt: Pt, poly: Pt[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c; }
  return c;
}
/** הסרת נקודות על אותו קו ישר — מתאר נקי. */
function simplify(pts: Pt[]): Pt[] {
  const out = pts.filter((p, i) => { const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length]; return Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) > 0.5; });
  return out.length >= 3 ? out : pts;
}

export interface DxfInfo { units: string; scale: number; loops: number; pieces: number; cutouts: number; warnings: string[] }
export interface DxfResult { project: Project; info: DxfInfo }

const UNIT: Record<number, [string, number]> = { 1: ['אינץ׳', 25.4], 2: ['רגל', 304.8], 4: ['מ"מ', 1], 5: ['ס"מ', 10], 6: ['מטר', 1000] };

/** scaleOverride: כמה מ"מ שווה יחידת שרטוט אחת (אם רוצים לעקוף את הזיהוי האוטומטי). */
export function parseDxf(text: string, name = 'מדידה מ-DXF', scaleOverride?: number): DxfResult {
  const ps = pairs(text), warnings: string[] = [];
  const secs: Record<string, [number, number]> = {};
  for (let i = 0; i < ps.length - 1; i++) if (ps[i][0] === 0 && ps[i][1] === 'SECTION' && ps[i + 1][0] === 2) { let j = i + 2; while (j < ps.length && !(ps[j][0] === 0 && ps[j][1] === 'ENDSEC')) j++; secs[ps[i + 1][1]] = [i + 2, j]; }
  if (!secs.ENTITIES) throw new Error('הקובץ אינו DXF תקין (חסר מקטע ENTITIES). אם זה DWG — יש לייצא ל-DXF.');

  let unitCode = 0;
  if (secs.HEADER) for (let i = secs.HEADER[0]; i < secs.HEADER[1] - 1; i++) if (ps[i][0] === 9 && ps[i][1] === '$INSUNITS') unitCode = parseInt(ps[i + 1][1], 10) || 0;

  const blocks: Record<string, Ent[]> = {};
  if (secs.BLOCKS) {
    const [a, b] = secs.BLOCKS; let i = a;
    while (i < b) { if (ps[i][0] === 0 && ps[i][1] === 'BLOCK') { let nm = '', j = i + 1; while (j < b && ps[j][0] !== 0) { if (ps[j][0] === 2) nm = ps[j][1]; j++; } let k = j; while (k < b && !(ps[k][0] === 0 && ps[k][1] === 'ENDBLK')) k++; if (nm && !nm.startsWith('*')) blocks[nm] = readEntities(ps, j, k, blocks, 1); i = k; } i++; }
  }
  const ents = readEntities(ps, secs.ENTITIES[0], secs.ENTITIES[1], blocks);
  const all = ents.flatMap((e) => e.pts);
  if (!all.length) throw new Error('לא נמצאה גיאומטריה בקובץ.');
  const ext = bbox(all), span = Math.max(ext.w, ext.h);

  let scale = scaleOverride || UNIT[unitCode]?.[1] || 0, units = UNIT[unitCode]?.[0] || '';
  if (!scale) { // ניחוש לפי גודל השרטוט: מטבח הוא בערך 1–12 מטר
    if (span < 40) { scale = 1000; units = 'מטר (זוהה)'; } else if (span < 1500) { scale = 10; units = 'ס"מ (זוהה)'; } else { scale = 1; units = 'מ"מ (זוהה)'; }
  }
  if (scaleOverride) units = `1 יחידה = ${scaleOverride} מ"מ`;

  const tol = span / 2000;
  const loops = [...ents.filter((e) => e.closed && e.pts.length >= 3), ...chain(ents.filter((e) => !e.closed), tol)]
    .map((e) => ({ ...e, pts: simplify(e.pts.map((p) => ({ x: (p.x - ext.x) * scale, y: (ext.y + ext.h - p.y) * scale }))) })) // היפוך y: ב-DXF הציר כלפי מעלה
    .map((e) => ({ ...e, box: bbox(e.pts), area: area(e.pts) }))
    .filter((e) => e.box.w > 15 && e.box.h > 15)
    .sort((a, b) => b.area - a.area);
  // הסרת כפילויות (אותו מתאר שורטט פעמיים)
  const uniq = loops.filter((l, i) => !loops.slice(0, i).some((m) => Math.abs(m.box.x - l.box.x) < 2 && Math.abs(m.box.y - l.box.y) < 2 && Math.abs(m.box.w - l.box.w) < 2 && Math.abs(m.box.h - l.box.h) < 2));

  const project = emptyProject(name); project.source = 'dxf';
  const tops: { l: (typeof uniq)[number]; piece: Piece }[] = [];
  const named = new Set<string>(); // חלקים שבהם שם השכבה כבר קבע מה כיור ומה כיריים
  for (const l of uniq) {
    const c = { x: l.box.x + l.box.w / 2, y: l.box.y + l.box.h / 2 };
    const parent = tops.find((t) => t.l !== l && t.l.area > l.area * 1.05 && inside(c, t.l.pts));
    if (parent) {
      const b = l.box, round = !!l.circle || (Math.abs(b.w - b.h) < 3 && l.pts.length > 10);
      const lay = l.layer.toLowerCase();
      let kind: CutoutKind = 'hole';
      if (round && b.w <= 80) kind = 'faucet';
      else if (/sink|כיור/.test(lay)) { kind = 'sink'; named.add(parent.piece.id); }
      else if (/cook|hob|כיריים/.test(lay)) { kind = 'cooktop'; named.add(parent.piece.id); }
      else if (!round && b.w >= 300 && b.h >= 300) kind = project.cutouts.some((q) => q.pieceId === parent.piece.id && q.kind === 'sink') ? 'cooktop' : 'sink';
      const cut: Cutout = { id: uid('c'), pieceId: parent.piece.id, kind, x: Math.round(b.x - parent.piece.x), y: Math.round(b.y - parent.piece.y), w: Math.round(b.w), h: Math.round(b.h), round: round || undefined };
      if (kind === 'sink') cut.mount = 'under';
      project.cutouts.push(cut);
      continue;
    }
    if (l.box.w < 60 || l.box.h < 60) continue; // לא חלק
    const b = l.box, rectLike = l.pts.length === 4 && l.area > b.w * b.h * 0.995;
    const narrow = Math.min(b.w, b.h) < 300;
    const p: Piece = {
      id: uid(), name: narrow ? `פאנל ${tops.length + 1}` : `משטח ${tops.length + 1}`, kind: narrow ? 'panel' : 'counter',
      x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), aprons: [], grainLock: true,
      outline: rectLike ? undefined : l.pts.map((q) => ({ x: Math.round((q.x - b.x) * 10) / 10, y: Math.round((q.y - b.y) * 10) / 10 })),
    };
    tops.push({ l, piece: p }); project.pieces.push(p);
  }
  // כיור וכיריים: אם זוהו שני פתחים גדולים, הצר יותר (בדרך כלל 56×49) הוא הכיריים
  for (const p of project.pieces) {
    const big = project.cutouts.filter((c) => c.pieceId === p.id && (c.kind === 'sink' || c.kind === 'cooktop'));
    if (big.length === 2 && !named.has(p.id)) { const [a, b] = [...big].sort((m, n) => n.w * n.h - m.w * m.h); a.kind = 'sink'; a.mount = 'under'; b.kind = 'cooktop'; delete b.mount; }
  }
  // פס צר באורך של משטח = חיפוי הקיר של אותו משטח
  for (const p of project.pieces.filter((q) => q.kind === 'panel')) {
    const len = Math.max(p.w, p.h), wid = Math.min(p.w, p.h);
    const host = project.pieces.find((q) => q.kind === 'counter' && Math.abs(Math.max(q.w, q.h) - len) <= 5 && !project.pieces.some((s) => s.kind === 'splash' && s.host === q.id));
    if (!host || project.cutouts.some((c) => c.pieceId === p.id)) continue;
    host.wall = host.wall || (host.w >= host.h ? 'back' : 'right');
    Object.assign(p, { kind: 'splash', name: 'חיפוי קיר', host: host.id, side: host.wall, w: len, h: wid, x: 0, y: 0, outline: undefined });
  }
  if (!project.pieces.length) warnings.push('לא נמצאו מתארים סגורים. ודאו שהחלקים שורטטו כפוליליין סגור.');
  if (project.pieces.some((p) => p.outline)) warnings.push('יש חלקים בצורה לא מלבנית — הנסטינג משבץ אותם לפי המלבן החוסם.');
  if (span * scale > 20000) warnings.push('המידות נראות גדולות מדי — בדקו את יחידות השרטוט.');
  return { project, info: { units, scale, loops: uniq.length, pieces: project.pieces.length, cutouts: project.cutouts.length, warnings } };
}

/** ייצוא תוכנית החיתוך ל-DXF (מ"מ) — לוח אחרי לוח, לשליחה למכונה / ללייזר. */
export function exportNestDxf(slabs: { w: number; h: number; placements: { body: { x: number; y: number; w: number; h: number }; strips: { rect: { x: number; y: number; w: number; h: number } }[] }[] }[]): string {
  const out: string[] = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
  const rect = (layer: string, x: number, y: number, w: number, h: number) => out.push('0', 'LWPOLYLINE', '8', layer, '90', '4', '70', '1', ...[[x, y], [x + w, y], [x + w, y + h], [x, y + h]].flatMap(([a, b]) => ['10', String(a), '20', String(b)]));
  slabs.forEach((s, i) => {
    const ox = i * (s.w + 300);
    rect('SLAB', ox, 0, s.w, s.h);
    for (const p of s.placements) { rect('PARTS', ox + p.body.x, s.h - p.body.y - p.body.h, p.body.w, p.body.h); for (const st of p.strips) rect('EDGE', ox + st.rect.x, s.h - st.rect.y - st.rect.h, st.rect.w, st.rect.h); }
  });
  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\n');
}
