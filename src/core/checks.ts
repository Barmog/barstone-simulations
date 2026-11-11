// הבודק החכם: כללי מקצוע דטרמיניסטיים. כל ממצא מסביר מה הבעיה, ואם אפשר — מציע תיקון בלחיצה.
import { CUT_HE, Cutout, Piece, Project, isVertical, longIsX, pieceLen, pieceWid, piece as mkPiece, SIDE_HE, Side } from './model';
import { NestResult } from './nesting';

export interface Issue {
  id: string;
  level: 'error' | 'warn' | 'tip';
  title: string;
  detail: string;
  pieceId?: string;
  cutoutId?: string;
  fix?: { label: string; apply: (p: Project) => Project };
}

const END = 60;   // מרחק מינימלי של פתח מקצה החלק / מחיבור
const RIM = 50;   // רצועת אבן מינימלית לפני/אחרי פתח (חוזק)
const SINK_HOB = 300;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const patchCut = (id: string, fn: (c: Cutout) => Partial<Cutout>) => (p: Project): Project => ({ ...p, cutouts: p.cutouts.map((c) => (c.id === id ? { ...c, ...fn(c) } : c)) });
const patchPiece = (id: string, fn: (q: Piece) => Partial<Piece>) => (p: Project): Project => ({ ...p, pieces: p.pieces.map((q) => (q.id === id ? { ...q, ...fn(q) } : q)) });

export function check(p: Project, nest: NestResult): Issue[] {
  const out: Issue[] = [];
  const byId = Object.fromEntries(p.pieces.map((q) => [q.id, q]));
  const flat = p.pieces.filter((q) => !isVertical(q));

  // --- חלקים שלא נכנסים בלוח ---
  for (const u of nest.unplaced) {
    const q = byId[u.pieceId]; if (!q) continue;
    out.push({
      id: `fit-${q.id}`, level: 'error', pieceId: q.id, title: `"${q.name}" לא נכנס בלוח`,
      detail: `החלק ${u.len}×${u.wid} מ"מ (כולל קנט) גדול מלוח ${p.slabW}×${p.slabH}. ${q.grainLock ? 'כיוון הגיד נעול, ולכן אי אפשר לסובב אותו.' : ''}`,
      fix: q.grainLock ? { label: 'שחרר את כיוון הגיד', apply: patchPiece(q.id, () => ({ grainLock: false })) } : undefined,
    });
  }

  // --- חפיפה בין חלקים בתוכנית ---
  for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) {
    const a = flat[i], b = flat[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 2 && oy > 2) out.push({ id: `ov-${a.id}-${b.id}`, level: 'error', pieceId: b.id, title: `"${a.name}" ו"${b.name}" חופפים`, detail: `יש חפיפה של ${Math.round(ox)}×${Math.round(oy)} מ"מ בתוכנית. גררו אחד מהם או תקנו מידות.` });
  }

  // --- פתחים ---
  for (const c of p.cutouts) {
    const q = byId[c.pieceId]; if (!q) continue;
    const name = c.name || CUT_HE[c.kind], lx = longIsX(q), len = pieceLen(q), wid = pieceWid(q);
    const a0 = lx ? c.x : c.y, aLen = lx ? c.w : c.h, b0 = lx ? c.y : c.x, bLen = lx ? c.h : c.w;
    const setAlong = (v: number) => (lx ? { x: Math.round(v) } : { y: Math.round(v) });
    const setAcross = (v: number) => (lx ? { y: Math.round(v) } : { x: Math.round(v) });
    if (c.kind === 'faucet' || c.kind === 'hole') {
      if (b0 < 25 || b0 + bLen > wid - 25 || a0 < 25 || a0 + aLen > len - 25) out.push({ id: `hole-${c.id}`, level: 'warn', cutoutId: c.id, pieceId: q.id, title: `${name} קרוב מדי לקצה`, detail: 'נדרשים לפחות 25 מ"מ אבן סביב קידוח כדי שלא ייסדק.', fix: { label: 'הזז פנימה', apply: patchCut(c.id, () => ({ ...setAlong(clamp(a0, 25, len - aLen - 25)), ...setAcross(clamp(b0, 25, wid - bLen - 25)) })) } });
      continue;
    }
    if (aLen > len - 2 * END || bLen > wid - 2 * 20) { out.push({ id: `big-${c.id}`, level: 'error', cutoutId: c.id, pieceId: q.id, title: `ה${name} גדול מהחלק`, detail: `פתח ${aLen}×${bLen} מ"מ לא נכנס ב"${q.name}" (${len}×${wid}). צריך משטח עמוק יותר או ${name} קטן יותר.` }); continue; }
    if (a0 < END || a0 + aLen > len - END) out.push({ id: `end-${c.id}`, level: 'warn', cutoutId: c.id, pieceId: q.id, title: `ה${name} קרוב מדי לקצה המשטח`, detail: `נשארים פחות מ-${END / 10} ס"מ אבן בצד — נקודת שבר בהובלה ובהתקנה.`, fix: { label: `הזז ל-${END / 10} ס"מ מהקצה`, apply: patchCut(c.id, () => setAlong(clamp(a0, END, len - aLen - END))) } });
    const front = wid - b0 - bLen;
    if (b0 < RIM || front < RIM) out.push({ id: `rim-${c.id}`, level: 'warn', cutoutId: c.id, pieceId: q.id, title: `רצועת אבן צרה ליד ה${name}`, detail: `נשארים ${Math.round(Math.min(b0, front))} מ"מ בלבד ${b0 < front ? 'מאחורי' : 'לפני'} הפתח. מומלץ לפחות ${RIM} מ"מ, אחרת הרצועה נשברת.`, fix: bLen + 2 * RIM <= wid ? { label: 'מרכז את הפתח', apply: patchCut(c.id, () => setAcross((wid - bLen) / 2)) } : undefined });
    // חיבור שעובר דרך פתח
    for (const j of nest.joints.filter((j) => j.pieceId === q.id)) if (j.at > a0 - END && j.at < a0 + aLen + END) {
      const left = j.at - aLen - END, right = j.at + END, can = [left, right].filter((v) => v >= END && v + aLen <= len - END).sort((m, n) => Math.abs(m - a0) - Math.abs(n - a0));
      out.push({ id: `joint-${c.id}`, level: 'error', cutoutId: c.id, pieceId: q.id, title: `חיבור עובר דרך ה${name}`, detail: `המשטח ארוך מהלוח ולכן יש חיבור ב-${Math.round(j.at / 10)} ס"מ, בדיוק באזור הפתח. חיבור ליד פתח נחלש ונראה לעין.`, fix: can.length ? { label: `הזז את ה${name} ${can[0] < a0 ? 'ימינה' : 'שמאלה'} מהחיבור`, apply: patchCut(c.id, () => setAlong(can[0])) } : undefined });
    }
  }

  // --- כיור מול כיריים ---
  for (const s of p.cutouts.filter((c) => c.kind === 'sink')) for (const h of p.cutouts.filter((c) => c.kind === 'cooktop' && c.pieceId === s.pieceId)) {
    const q = byId[s.pieceId]; if (!q) continue;
    const lx = longIsX(q), sa = lx ? s.x : s.y, sl = lx ? s.w : s.h, ha = lx ? h.x : h.y, hl = lx ? h.w : h.h, len = pieceLen(q);
    const gap = ha > sa ? ha - (sa + sl) : sa - (ha + hl);
    if (gap < SINK_HOB) {
      const target = ha > sa ? sa + sl + SINK_HOB : sa - SINK_HOB - hl, ok = target >= END && target + hl <= len - END;
      out.push({ id: `sh-${s.id}-${h.id}`, level: 'warn', cutoutId: h.id, pieceId: q.id, title: 'הכיור והכיריים קרובים מדי', detail: `המרחק ביניהם ${Math.round(gap / 10)} ס"מ. מומלץ לפחות ${SINK_HOB / 10} ס"מ — גם לנוחות עבודה וגם לחוזק הרצועה שביניהם.`, fix: ok ? { label: `הרחק את הכיריים ל-${SINK_HOB / 10} ס"מ`, apply: patchCut(h.id, () => (lx ? { x: Math.round(target) } : { y: Math.round(target) })) } : undefined });
    }
  }

  // --- ברז ---
  for (const s of p.cutouts.filter((c) => c.kind === 'sink')) {
    const q = byId[s.pieceId]; if (!q || !longIsX(q)) continue;
    const has = p.cutouts.some((c) => c.kind === 'faucet' && c.pieceId === q.id);
    if (!has && s.y >= 85) out.push({ id: `fa-${s.id}`, level: 'tip', cutoutId: s.id, pieceId: q.id, title: 'אין חור ברז', detail: 'לכיור אין קידוח לברז. אם הברז יוצא מהמשטח (ולא מהקיר) — כדאי להוסיף.', fix: { label: 'הוסף חור ברז Ø35', apply: (pr) => ({ ...pr, cutouts: [...pr.cutouts, { id: `c${Date.now().toString(36)}`, pieceId: q.id, kind: 'faucet', x: Math.round(s.x + s.w / 2 - 17.5), y: Math.round(s.y / 2 - 17.5), w: 35, h: 35, round: true }] }) } });
    if (!has && s.y < 85) out.push({ id: `fa2-${s.id}`, level: 'tip', cutoutId: s.id, pieceId: q.id, title: 'אין מקום לברז מאחורי הכיור', detail: `מאחורי הכיור נשארים ${Math.round(s.y)} מ"מ. מומלץ ברז קיר, או להזיז את הכיור קדימה.` });
  }

  // --- חיבורים ---
  for (const j of nest.joints) {
    const q = byId[j.pieceId]; if (!q) continue;
    if (out.some((i) => i.id.startsWith('joint-') && i.pieceId === q.id)) continue;
    out.push({ id: `j-${q.id}-${j.at}`, level: 'tip', pieceId: q.id, title: `חיבור ב"${q.name}"`, detail: `החלק (${pieceLen(q) / 10} ס"מ) ארוך מהלוח, ולכן יהיה חיבור ב-${Math.round(j.at / 10)} ס"מ. שני המקטעים נחתכים ברצף מאותו גיד כדי שהחיבור כמעט לא ייראה.` });
  }

  // --- הצעות עיצוב ---
  for (const isl of flat.filter((q) => q.kind === 'island')) {
    const falls = p.pieces.filter((w) => w.kind === 'waterfall' && w.host === isl.id);
    if (!falls.length && nest.metrics.utilization < 70) out.push({
      id: `wf-${isl.id}`, level: 'tip', pieceId: isl.id, title: 'מפל לאי — מראה יוקרתי', detail: 'צדי האי יכולים לרדת עד הרצפה מאותו לוח, כך שהגיד "נשפך" מהמשטח למטה ברצף. יש מספיק מקום פנוי בלוחות.',
      fix: { label: 'הוסף מפל בשני הצדדים', apply: (pr) => { const lx = longIsX(isl); const sides: Side[] = lx ? ['left', 'right'] : ['back', 'front']; return { ...pr, pieces: [...pr.pieces, ...sides.map((s) => mkPiece({ kind: 'waterfall', name: `מפל · ${SIDE_HE[s]}`, w: pieceWid(isl), h: pr.counterH - pr.thickness, host: isl.id, side: s }))] }; } },
    });
    if (pieceWid(isl) > 1250) out.push({ id: `deep-${isl.id}`, level: 'tip', pieceId: isl.id, title: 'אי עמוק מאוד', detail: `עומק ${pieceWid(isl) / 10} ס"מ קשה לניקוי במרכז, ומשאיר שארית קטנה בלוח. 100–120 ס"מ הוא הטווח הנוח.` });
  }
  for (const q of flat.filter((q) => q.kind === 'counter' && q.wall)) {
    if (!p.pieces.some((s) => s.kind === 'splash' && s.host === q.id)) out.push({
      id: `sp-${q.id}`, level: 'tip', pieceId: q.id, title: `חיפוי קיר מעל "${q.name}"`, detail: 'חיפוי מאותה אבן יוצר מראה אחיד וממשיך את הגיד מהמשטח אל הקיר.',
      fix: { label: 'הוסף חיפוי 60 ס"מ', apply: (pr) => ({ ...pr, pieces: [...pr.pieces, mkPiece({ kind: 'splash', name: 'חיפוי קיר', w: sideLenOf(q, q.wall!), h: 600, host: q.id, side: q.wall })] }) },
    });
  }
  if (p.apronH === 0 && p.thickness <= 12 && flat.length) out.push({ id: 'apron', level: 'tip', title: 'משטח 12 מ"מ בלי קנט', detail: 'בלי קנט המשטח נראה דק מאוד וחושף את הארון. קנט 40 מ"מ בגרונג נותן מראה מלא עם גיד רציף.', fix: { label: 'הוסף קנט 40 מ"מ', apply: (pr) => ({ ...pr, apronH: 40 }) } });
  if (flat.some((q) => !q.grainLock) && flat.some((q) => q.grainLock)) out.push({ id: 'grain', level: 'tip', title: 'כיווני גיד מעורבים', detail: 'בחלק מהמשטחים הגיד משוחרר וייתכן שיסתובב ב-90° על הלוח. באבן עם גיד בולט זה ייראה בפינות.', fix: { label: 'נעל גיד בכל החלקים', apply: (pr) => ({ ...pr, pieces: pr.pieces.map((q) => ({ ...q, grainLock: true })) }) } });

  // --- ניצולת ---
  const last = nest.slabs[nest.slabs.length - 1];
  if (nest.slabs.length > 1 && last && last.used < 18) out.push({ id: 'waste', level: 'tip', title: `הלוח האחרון מנוצל רק ב-${last.used}%`, detail: 'קיצור קטן של אחד החלקים, ויתור על קנט בצד נסתר, או שחרור כיוון גיד בחלק קטן — עשויים לחסוך לוח שלם.' });

  const rank = { error: 0, warn: 1, tip: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

const sideLenOf = (q: Piece, s: Side) => (s === 'front' || s === 'back' ? q.w : q.h);
