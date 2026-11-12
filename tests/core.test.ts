import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fromLegacy, fromTemplate, piece, emptyProject, pieceLen } from '../src/core/model';
import { nest, localToSlab, splitPoints } from '../src/core/nesting';
import { check } from '../src/core/checks';
import { parseDxf, exportNestDxf } from '../src/core/dxf';

const overlap = (a: any, b: any, k: number) => a.x < b.x + b.w + k && b.x < a.x + a.w + k && a.y < b.y + b.h + k && b.y < a.y + a.h + k;

function assertValid(p: ReturnType<typeof emptyProject>) {
  const r = nest(p);
  for (const s of r.slabs) {
    for (const pl of s.placements) {
      expect(pl.block.x).toBeGreaterThanOrEqual(p.margin); expect(pl.block.y).toBeGreaterThanOrEqual(p.margin);
      expect(pl.block.x + pl.block.w).toBeLessThanOrEqual(s.w - p.margin); expect(pl.block.y + pl.block.h).toBeLessThanOrEqual(s.h - p.margin);
    }
    for (let i = 0; i < s.placements.length; i++) for (let j = i + 1; j < s.placements.length; j++) { const a = s.placements[i], b = s.placements[j]; if (a.attached === b.key || b.attached === a.key) continue; expect(overlap(a.block, b.block, p.kerf - 0.01)).toBe(false); }
  }
  return r;
}

describe('נסטינג', () => {
  it('כל תבנית משובצת בלי חפיפות ובתוך גבולות הלוח', () => {
    for (const id of ['straight', 'l', 'u', 'island', 'l-island'] as const) { const r = assertValid(fromTemplate(id)); expect(r.unplaced).toHaveLength(0); expect(r.slabs.length).toBeGreaterThan(0); }
  });
  it('סכום אורכי המקטעים שווה לאורך החלק', () => {
    const p = fromTemplate('straight'); p.pieces[0].w = 4563; const r = nest(p), main = p.pieces[0];
    const segs = r.slabs.flatMap((s) => s.placements).filter((pl) => pl.pieceId === main.id && !pl.stripOf);
    expect(segs.length).toBe(2); expect(segs.reduce((s, x) => s + x.len, 0)).toBe(4563); expect(r.joints).toHaveLength(1);
  });
  it('חיבור לא עובר דרך פתח', () => {
    expect(splitPoints(4563, 3180, [[2000, 2700]])[1]).toSatisfy((c: number) => c <= 2000 || c >= 2700);
    const p = fromTemplate('straight'); p.pieces[0].w = 4563; p.cutouts[2].x = 2100; const r = nest(p), j = r.joints[0].at, c = p.cutouts[2];
    expect(j <= c.x - 60 || j >= c.x + c.w + 60).toBe(true);
  });
  it('אפשר לבחור חיבור במרכז הכיור או הכיריים; כיור בנוי מוסיף חלקים; 45° מאריך את הרגל', () => {
    const p = fromTemplate('straight'); p.pieces[0].w = 4563; p.pieces[0].joint = 'sink';
    const sink = p.cutouts[0]; sink.x = 1900; p.cutouts[2].x = 3300; let r = nest(p);
    expect(r.joints[0].at).toBe(Math.round(sink.x + sink.w / 2));
    expect(check(p, r).some((i) => i.id.startsWith('jc-'))).toBe(true); expect(check(p, r).some((i) => i.level === 'error')).toBe(false);
    const before = r.slabs.flatMap((s) => s.placements).length; sink.built = true; r = nest(p);
    expect(r.slabs.flatMap((s) => s.placements).filter((x) => x.extra).length).toBe(5); expect(r.slabs.flatMap((s) => s.placements).length).toBe(before + 5);
    const l = fromTemplate('l'), leg = l.pieces[1], plain = nest(l).slabs.flatMap((s) => s.placements).find((x) => x.pieceId === leg.id && !x.stripOf)!.len;
    leg.corner = 'miter'; expect(nest(l).slabs.flatMap((s) => s.placements).find((x) => x.pieceId === leg.id && !x.stripOf)!.len).toBe(plain + leg.w);
  });
  it('גיד נעול: החלק לא מסתובב; קנט ארוך צמוד לחלק', () => {
    const p = fromTemplate('straight'), r = nest(p), pl = r.slabs.flatMap((s) => s.placements).find((x) => x.pieceId === p.pieces[0].id)!;
    expect(pl.rot).toBe(false); expect(pl.strips).toHaveLength(1);
    expect(pl.strips[0].rect.y).toBe(pl.body.y + pl.body.h + p.kerf); expect(pl.strips[0].rect.h).toBe(p.apronH);
  });
  it('חלק גדול מהלוח מדווח כלא משובץ', () => {
    const p = emptyProject(); p.pieces.push(piece({ kind: 'island', w: 2000, h: 1700 }));
    const r = nest(p); expect(r.unplaced).toHaveLength(1); expect(check(p, r)[0].level).toBe('error');
  });
  it('מיפוי מקומי→לוח נשאר בתוך גוף החלק', () => {
    const p = fromTemplate('l'), r = nest(p);
    for (const pl of r.slabs.flatMap((s) => s.placements).filter((x) => !x.stripOf)) {
      const q = p.pieces.find((x) => x.id === pl.pieceId)!, lx = q.kind === 'splash' || q.w >= q.h;
      const a = localToSlab(q, pl, lx ? pl.off : 0, lx ? 0 : pl.off), b = localToSlab(q, pl, lx ? pl.off + pl.len : Math.min(q.w, q.h), lx ? Math.min(q.w, q.h) : pl.off + pl.len);
      for (const pt of [a, b]) { expect(pt.x).toBeGreaterThanOrEqual(pl.body.x - 0.01); expect(pt.x).toBeLessThanOrEqual(pl.body.x + pl.body.w + 0.01); expect(pt.y).toBeGreaterThanOrEqual(pl.body.y - 0.01); expect(pt.y).toBeLessThanOrEqual(pl.body.y + pl.body.h + 0.01); }
    }
  });
  it('דוגמאות פורת מהמערכת הישנה נטענות ומשובצות', () => {
    for (const f of ['porat-4012', 'porat-4035']) {
      const p = fromLegacy(JSON.parse(readFileSync(`legacy/samples/${f}.json`, 'utf8'))); const r = assertValid(p);
      expect(r.unplaced).toHaveLength(0); expect(pieceLen(p.pieces[0])).toBeGreaterThan(1000);
    }
  });
});

describe('בודק חכם', () => {
  it('מזהה כיור קרוב לכיריים ומתקן בלחיצה', () => {
    const p = fromTemplate('straight'); p.cutouts[2].x = p.cutouts[0].x + p.cutouts[0].w + 100;
    const is = check(p, nest(p)).find((i) => i.id.startsWith('sh-'))!; expect(is.fix).toBeTruthy();
    const fixed = is.fix!.apply(p); expect(check(fixed, nest(fixed)).some((i) => i.id.startsWith('sh-'))).toBe(false);
  });
  it('מזהה פתח קרוב לקצה ומתקן', () => {
    const p = fromTemplate('straight'); p.cutouts[0].x = 10;
    const is = check(p, nest(p)).find((i) => i.id.startsWith('end-'))!; const fixed = is.fix!.apply(p);
    expect(fixed.cutouts[0].x).toBe(60); expect(p.cutouts[0].x).toBe(10);
  });
  it('תבנית תקינה — בלי שגיאות', () => { const p = fromTemplate('l-island'); expect(check(p, nest(p)).filter((i) => i.level === 'error')).toHaveLength(0); });
});

const poly = (layer: string, pts: number[][]) => ['0', 'LWPOLYLINE', '8', layer, '90', String(pts.length), '70', '1', ...pts.flatMap(([x, y]) => ['10', String(x), '20', String(y)])].join('\n');
const line = (a: number[], b: number[]) => ['0', 'LINE', '8', '0', '10', a[0], '20', a[1], '11', b[0], '21', b[1]].join('\n');
const wrap = (body: string, units?: number) => [units ? `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${units}\n0\nENDSEC` : '', '0\nSECTION\n2\nENTITIES', body, '0\nENDSEC\n0\nEOF'].filter(Boolean).join('\n');

describe('DXF', () => {
  it('משטח עם כיור, כיריים וחור ברז', () => {
    const dxf = wrap([poly('0', [[0, 0], [3000, 0], [3000, 620], [0, 620]]), poly('0', [[500, 110], [1260, 110], [1260, 510], [500, 510]]), poly('0', [[2000, 65], [2560, 65], [2560, 555], [2000, 555]]), ['0', 'CIRCLE', '8', '0', '10', '880', '20', '570', '40', '17.5'].join('\n'), poly('0', [[0, 1000], [2000, 1000], [2000, 2000], [0, 2000]])].join('\n'), 4);
    const { project: p, info } = parseDxf(dxf);
    expect(info.pieces).toBe(2); expect(p.pieces.map((q) => [q.w, q.h]).sort()).toEqual([[2000, 1000], [3000, 620]]);
    const main = p.pieces.find((q) => q.w === 3000)!, cuts = p.cutouts.filter((c) => c.pieceId === main.id);
    expect(cuts.map((c) => c.kind).sort()).toEqual(['cooktop', 'faucet', 'sink']);
    const sink = cuts.find((c) => c.kind === 'sink')!; expect([sink.x, sink.w, sink.h]).toEqual([500, 760, 400]);
    // ב-DXF ציר y כלפי מעלה: הברז (y=570) קרוב לקצה האחורי = y קטן אצלנו
    expect(cuts.find((c) => c.kind === 'faucet')!.y).toBeLessThan(sink.y);
    expect(nest(p).unplaced).toHaveLength(0);
  });
  it('קווים בודדים מתחברים ללולאה; צורת L נשמרת כמתאר', () => {
    const pts = [[0, 0], [300, 0], [300, 62], [62, 62], [62, 200], [0, 200]];
    const dxf = wrap(pts.map((a, i) => line(a, pts[(i + 1) % pts.length])).join('\n'));
    const { project: p, info } = parseDxf(dxf);
    expect(info.units).toContain('ס"מ'); expect(p.pieces).toHaveLength(1); expect([p.pieces[0].w, p.pieces[0].h]).toEqual([3000, 2000]); expect(p.pieces[0].outline).toHaveLength(6);
  });
  it('פס צר באורך המשטח מזוהה כחיפוי קיר של אותו משטח', () => {
    const { project: p } = parseDxf(wrap([poly('0', [[0, 0], [3000, 0], [3000, 620], [0, 620]]), poly('0', [[0, 800], [3000, 800], [3000, 1052], [0, 1052]])].join('\n'), 4));
    const sp = p.pieces.find((q) => q.kind === 'splash')!, host = p.pieces.find((q) => q.kind === 'counter')!;
    expect([sp.w, sp.h, sp.host, sp.side]).toEqual([3000, 252, host.id, 'back']); expect(host.wall).toBe('back');
  });
  it('קובץ לא תקין זורק שגיאה ברורה', () => { expect(() => parseDxf('hello')).toThrow(/DXF/); });
  it('ייצוא נסטינג ל-DXF נקרא חזרה', () => {
    const p = fromTemplate('island'), out = exportNestDxf(nest(p).slabs); const back = parseDxf(out);
    expect(back.info.pieces).toBe(nest(p).slabs.length);
  });
});

describe('מטר רץ, סידור ידני, צוקל וחיבורים ידניים', () => {
  it('מקדם המטר הרץ לפי רוחב', async () => {
    const { rmFactor, runningMeters } = await import('../src/core/pricing');
    expect(rmFactor(200)).toBeCloseTo(1 / 3); expect(rmFactor(250)).toBe(0.5); expect(rmFactor(300)).toBe(0.5); expect(rmFactor(620)).toBe(1); expect(rmFactor(700)).toBe(1); expect(rmFactor(1000)).toBe(2);
    const p = emptyProject(); p.pieces.push(piece({ kind: 'counter', w: 3000, h: 620 }), piece({ kind: 'island', w: 2000, h: 1000 }));
    expect(runningMeters(p).total).toBeCloseTo(3 + 4);
  });
  it('חלק שסודר ידנית נשאר במקומו, והשאר לא עולים עליו', () => {
    const p = fromTemplate('l-island'), r0 = nest(p), own = r0.slabs.flatMap((s) => s.placements).filter((q) => !q.attached && q.block.w < 2500 && q.block.h < 1200), pl = own[0];
    p.manual = { [pl.key]: { slab: 0, x: 500, y: 300 } };
    const r = nest(p), moved = r.slabs.flatMap((s) => s.placements).find((q) => q.key === pl.key)!;
    expect(moved.block.x).toBe(500); expect(moved.block.y).toBe(300); expect(r.unplaced.length).toBe(0); expect(r.overlaps.length).toBe(0);
    for (const s of r.slabs) for (let i = 0; i < s.placements.length; i++) for (let j = i + 1; j < s.placements.length; j++) { const a = s.placements[i], b = s.placements[j]; if (a.attached === b.key || b.attached === a.key) continue; expect(overlap(a.block, b.block, -1)).toBe(false); }
    // שני חלקים ידניים באותו מקום: מדווח כחפיפה
    const other = own[1]; p.manual[other.key] = { slab: 0, x: 520, y: 320 };
    expect(nest(p).overlaps.length).toBeGreaterThan(0);
    expect(check(p, nest(p)).some((i) => i.id === 'manual-overlap')).toBe(true);
  });
  it('צוקל מאבן מוסיף חלקים, וחיבור ידני קובע את נקודת החיבור', () => {
    const p = fromTemplate('straight'), n0 = nest(p).slabs.flatMap((s) => s.placements).length;
    p.plinthStone = true; expect(nest(p).slabs.flatMap((s) => s.placements).filter((q) => q.extra === 'צוקל').length).toBe(1);
    expect(nest(p).slabs.flatMap((s) => s.placements).length).toBe(n0 + 1);
    p.pieces[0].w = 4200; p.pieces[0].jointAt = [1500];
    expect(nest(p).joints.map((j) => j.at)).toEqual([1500]);
  });
});

describe('המשכיות גידים: חיפוי, בוק־מאץ׳ ופינה', () => {
  const sameSlab = (p: any, r: any, id: string) => r.slabs.flatMap((s: any) => s.placements).filter((q: any) => q.pieceId === id);
  it('החיפוי נחתך צמוד לצלע הקיר של המשטח, והשורה התחתונה שלו ממשיכה את השורה האחורית', () => {
    for (const id of ['straight', 'l', 'u'] as const) {
      const p = fromTemplate(id), r = assertValid(p), sp = p.pieces.find((q) => q.kind === 'splash')!, host = p.pieces.find((q) => q.id === sp.host)!;
      const s = sameSlab(p, r, sp.id)[0], h = sameSlab(p, r, host.id).find((q: any) => q.key === s.attached);
      expect(s.slab).toBe(h.slab);
      // נקודה בתחתית החיפוי ונקודה בגב המשטח, באותו מקום לאורך — רחוקות זו מזו רק בעובי המסור
      const a = localToSlab(sp, s, 500, sp.h), b = localToSlab(host, h, 500, 0);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(p.kerf, 3);
    }
  });
  it('בוק־מאץ׳: המקטע השני יושב בלוח המראה, במקום המשלים', () => {
    const p = fromTemplate('straight'); p.pieces[0].w = 4400; p.bookmatch = 'yes';
    const r = assertValid(p), segs = sameSlab(p, r, p.pieces[0].id).sort((x: any, y: any) => x.seg - y.seg);
    expect(segs[1].slab).toBe(segs[0].slab + 1); expect(segs[0].slab % 2).toBe(0);
    // הקצה של מקטע A על הלוח הוא תמונת המראה של תחילת מקטע B
    expect(segs[0].body.x + segs[0].body.w).toBe(p.slabW - segs[1].body.x); expect(segs[0].body.y).toBe(segs[1].body.y);
  });
  it('חיפוי הרגל ממשיך עד הפינה', async () => {
    const { setSplash } = await import('../src/core/model');
    const p = setSplash(fromTemplate('l'), '60'), leg = p.pieces.find((q) => q.name === 'משטח L')!, sp = p.pieces.find((q) => q.kind === 'splash' && q.host === leg.id)!;
    expect(sp.off).toBe(-(620 - p.thickness)); expect(sp.w).toBe(leg.h + 620 - p.thickness);
    assertValid(p);
  });
});
