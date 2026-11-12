// הצעות שדרוג לאיש המכירות: כל הצעה מראה מה היא מוסיפה ומה המחיר שלה באבן (מ"ר ולוחות).
import { runningMeters } from './pricing';
import { Project, SIDE_HE, Side, isVertical, piece as mkPiece } from './model';
import { NestResult, nest } from './nesting';

export interface Upgrade { id: string; title: string; pitch: string; active: boolean; apply: (p: Project) => Project; dSlabs: number; dArea: number; /** תוספת מטר רץ. */ dRm: number }

const area = (p: Project, n: NestResult) => n.metrics.pieceArea + p.cutouts.filter((c) => c.kind === 'sink' && c.built).reduce((s, c) => s + c.w * c.h + 2 * (c.w + c.h) * 200, 0);

export function upgrades(p: Project, base: NestResult): Upgrade[] {
  const flat = p.pieces.filter((q) => !isVertical(q)), out: Omit<Upgrade, 'dSlabs' | 'dArea' | 'dRm'>[] = [];
  const islands = flat.filter((q) => q.kind === 'island'), walled = flat.filter((q) => q.kind === 'counter' && q.wall);
  const falls = (id: string) => p.pieces.filter((w) => w.kind === 'waterfall' && w.host === id);
  const splash = (id: string) => p.pieces.find((w) => w.kind === 'splash' && w.host === id);
  const ceil = Math.min(2500 - p.counterH, p.slabH - 2 * p.margin);

  if (islands.length) {
    const on = islands.every((i) => falls(i.id).length >= 2);
    out.push({ id: 'waterfall', title: 'מפל לאי', pitch: 'צדי האי יורדים עד הרצפה מאותו לוח, והגיד "נשפך" מהמשטח למטה.', active: on,
      apply: (pr) => on ? { ...pr, pieces: pr.pieces.filter((w) => !(w.kind === 'waterfall' && islands.some((i) => i.id === w.host))) }
        : { ...pr, pieces: [...pr.pieces, ...islands.flatMap((i) => (i.w >= i.h ? (['left', 'right'] as Side[]) : (['back', 'front'] as Side[])).filter((s) => !falls(i.id).some((w) => w.side === s)).map((s) => mkPiece({ kind: 'waterfall', name: `מפל · ${SIDE_HE[s]}`, w: Math.min(i.w, i.h), h: pr.counterH - pr.thickness, host: i.id, side: s })))] } });
  }
  if (walled.length) {
    const full = walled.every((q) => (splash(q.id)?.h || 0) >= ceil - 5), any = walled.some((q) => splash(q.id));
    const set = (h: number) => (pr: Project): Project => ({ ...pr, pieces: [...pr.pieces.filter((w) => !(w.kind === 'splash' && walled.some((q) => q.id === w.host))), ...(h ? walled.map((q) => mkPiece({ kind: 'splash', name: 'חיפוי קיר', w: q.wall === 'back' || q.wall === 'front' ? q.w : q.h, h, host: q.id, side: q.wall })) : [])] });
    if (!any) out.push({ id: 'splash', title: 'חיפוי קיר 60 ס"מ', pitch: 'אותה אבן ממשיכה מהמשטח אל הקיר — מראה אחיד וקל לניקוי.', active: false, apply: set(600) });
    out.push({ id: 'splash-full', title: 'חיפוי עד התקרה', pitch: 'קיר שלם מאבן מאחורי המטבח. הנוכחות הכי חזקה שיש לדגם עם גיד.', active: full, apply: set(full ? 600 : ceil) });
  }
  const sinks = p.cutouts.filter((c) => c.kind === 'sink');
  if (sinks.length) {
    const on = sinks.every((c) => c.built);
    out.push({ id: 'built-sink', title: 'כיור בנוי מאבן', pitch: 'הכיור נחתך מאותו לוח, בלי פס נירוסטה — המשטח והכיור נראים כיחידה אחת.', active: on, apply: (pr) => ({ ...pr, cutouts: pr.cutouts.map((c) => (c.kind === 'sink' ? { ...c, built: !on } : c)) }) });
  }
  const legs = flat.filter((q) => q.kind === 'counter' && q.h > q.w);
  if (legs.length) {
    const on = legs.every((q) => q.corner === 'miter');
    out.push({ id: 'miter', title: 'חיבור פינה בגרונג 45°', pitch: 'החיבור יוצא באלכסון והגיד ממשיך סביב הפינה, במקום קו ישר לרוחב המשטח.', active: on, apply: (pr) => ({ ...pr, pieces: pr.pieces.map((q) => (legs.some((l) => l.id === q.id) ? { ...q, corner: on ? 'butt' : 'miter' } : q)) }) });
  }
  if (flat.length) {
    const on = p.apronH >= 60;
    out.push({ id: 'apron', title: 'קנט עבה 60 מ"מ', pitch: 'קנט גבוה נותן למשטח מראה מסיבי ויוקרתי, עם גיד רציף בגרונג.', active: on, apply: (pr) => ({ ...pr, apronH: on ? 40 : 60 }) });
    out.push({ id: 'water', title: 'מערכת מים', pitch: 'מים מסוננים ישר מהברז. היחידה יושבת בארון הכיור.', active: !!p.water, apply: (pr) => ({ ...pr, water: !pr.water }) });
    out.push({ id: 'disposal', title: 'טוחן אשפה', pitch: 'מותקן מתחת לכיור. בלי פח רטוב ובלי ריחות.', active: !!p.disposal, apply: (pr) => ({ ...pr, disposal: !pr.disposal }) });
  }
  const a0 = area(p, base), r0 = runningMeters(p).total;
  return out.map((u) => { const q = u.apply(p), n = nest(q); return { ...u, dSlabs: n.metrics.slabs - base.metrics.slabs, dArea: +((area(q, n) - a0) / 1e6).toFixed(2), dRm: +(runningMeters(q).total - r0).toFixed(2) }; });
}
