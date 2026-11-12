// חישוב מטר רץ לפי הכללים של Barstone:
// · האורך הוא המטר הרץ, והרוחב קובע את המקדם: עד 20 ס"מ (כולל) שליש · 20–30 חצי · 31–70 רגיל · 70–150 כפול · 150–170 פי 2.5.
// · אין מינימום ואין עיגול: מחשבים לפי המ"מ.
// · מפל: אורך = גובה המטבח (90), והמקדם לפי עומק האי — מפל באי מעל 80 = 1.8 מטר רץ.
// · חיפוי ומפל: הגובה הוא ה"רוחב" (חיפוי 60 = רגיל, חיפוי עד התקרה = כפול).
// · פינה נספרת פעמיים: ב-L של 3 על 4 מטר (כל צלע עד הקיר) מחשבים 7 מטר.
// · קנט: תוספת נפרדת לפי מטר אורך. כיור בנוי: תוספת. פתחים (כיור קנוי, כיריים, ברז): בלי תוספת.
import { PLINTH_H, Piece, Project, isVertical, longIsX, pieceLen, pieceWid } from './model';

export function rmFactor(widthMm: number): number {
  if (widthMm <= 200) return 1 / 3;
  if (widthMm <= 300) return 0.5;
  if (widthMm <= 700) return 1;
  if (widthMm <= 1500) return 2;
  if (widthMm <= 1700) return 2.5;
  return 3; // מעל 170 ס"מ: פי 3
}
export const factorHe = (f: number) => (f < 0.4 ? 'שליש' : f === 0.5 ? 'חצי' : f === 1 ? 'רגיל' : f === 2 ? 'כפול' : f === 2.5 ? 'פי 2.5' : 'פי 3');

/** כמה להוסיף לאורך של משטח בגלל פינה: משטח ניצב שנוגע בקצה שלו (כך כל צלע נמדדת עד הקיר). */
export function cornerAdd(p: Project, x: Piece): number {
  if (isVertical(x) || x.kind !== 'counter') return 0;
  const lx = longIsX(x), near = (a: number, b: number) => Math.abs(a - b) < 6;
  let add = 0;
  for (const y of p.pieces) {
    if (y === x || isVertical(y) || y.kind !== 'counter' || longIsX(y) === lx) continue;
    if (lx) { if (y.y < x.y + x.h - 6 && y.y + y.h > x.y + 6 && (near(y.x + y.w, x.x) || near(y.x, x.x + x.w))) add += y.w; }
    else if (y.x < x.x + x.w - 6 && y.x + y.w > x.x + 6 && (near(y.y + y.h, x.y) || near(y.y, x.y + x.h))) add += y.h;
  }
  return add;
}

export interface RmRow { id: string; name: string; len: number; wid: number; factor: number; rm: number; corner?: number }
export interface Extra { id: string; name: string; qty: number; unit: string }
export function runningMeters(p: Project): { rows: RmRow[]; total: number; extras: Extra[] } {
  const row = (id: string, name: string, len: number, wid: number, corner = 0): RmRow => { const factor = rmFactor(wid); return { id, name, len: len + corner, wid, factor, rm: ((len + corner) / 1000) * factor, corner: corner || undefined }; };
  const rows = p.pieces.map((q) => (q.kind === 'waterfall' ? row(q.id, q.name, p.counterH, q.w) : row(q.id, q.name, pieceLen(q), pieceWid(q), cornerAdd(p, q))));
  if (p.plinthStone && p.cabinets) { const len = p.pieces.filter((q) => !isVertical(q) && q.kind !== 'panel').reduce((s, q) => s + (q.kind === 'island' ? 2 * (q.w + q.h) : pieceLen(q)), 0); if (len) rows.push(row('plinth', 'צוקל מאבן', len, PLINTH_H)); }
  const extras: Extra[] = [];
  const apron = p.apronH > 0 ? p.pieces.reduce((s, q) => s + q.aprons.reduce((t, sd) => t + (sd === 'front' || sd === 'back' ? q.w : q.h), 0), 0) : 0;
  if (apron) extras.push({ id: 'apron', name: `קנט ${p.apronH / 10} ס"מ`, qty: +(apron / 1000).toFixed(2), unit: 'מטר' });
  const built = p.cutouts.filter((c) => c.kind === 'sink' && c.built);
  if (built.length) extras.push({ id: 'built', name: 'כיור בנוי', qty: built.length, unit: built.length > 1 ? 'כיורים' : 'כיור' });
  return { rows, total: rows.reduce((s, r) => s + r.rm, 0), extras };
}
