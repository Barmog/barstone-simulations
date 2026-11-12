// חישוב מטר רץ לפי רוחב החלק. האורך הוא המטר הרץ, והרוחב קובע את המקדם:
// עד 20 ס"מ = שליש · 20–30 = חצי · 31–70 = מטר רגיל · 70–150 = כפול.
import { PLINTH_H, Project, isVertical, pieceLen, pieceWid } from './model';

export function rmFactor(widthMm: number): number {
  if (widthMm <= 200) return 1 / 3;
  if (widthMm <= 300) return 0.5;
  if (widthMm <= 700) return 1;
  if (widthMm <= 1500) return 2;
  return 3; // מעל 150 ס"מ: חריג, לבדוק מול המחירון
}
export const factorHe = (f: number) => (f < 0.4 ? 'שליש' : f === 0.5 ? 'חצי' : f === 1 ? 'רגיל' : f === 2 ? 'כפול' : '×3 (חריג)');

export interface RmRow { id: string; name: string; len: number; wid: number; factor: number; rm: number }
export function runningMeters(p: Project): { rows: RmRow[]; total: number } {
  const row = (id: string, name: string, len: number, wid: number): RmRow => { const factor = rmFactor(wid); return { id, name, len, wid, factor, rm: (len / 1000) * factor }; };
  const rows = p.pieces.map((q) => row(q.id, q.name, pieceLen(q), pieceWid(q)));
  if (p.plinthStone && p.cabinets) { const len = p.pieces.filter((q) => !isVertical(q) && q.kind !== 'panel').reduce((s, q) => s + (q.kind === 'island' ? 2 * (q.w + q.h) : pieceLen(q)), 0); if (len) rows.push(row('plinth', 'צוקל מאבן', len, PLINTH_H)); }
  return { rows, total: rows.reduce((s, r) => s + r.rm, 0) };
}
