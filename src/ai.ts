// לקוח ליכולות ה-AI. הקריאה למודל נעשית בפונקציית קצה ב-Supabase (המפתח נשמר שם בלבד, לא בדפדפן).
import { CABINETS, FLOORS, WALLS } from './core/catalog';
import { Cutout, CutoutKind, Piece, PieceKind, Project, Side, piece as mkP, uid } from './core/model';
import { sb } from './data/repo';

/** ייצוג קומפקטי של המטבח שהמודל קורא וכותב. מזהים קצרים (A, B, …) במקום מזהים פנימיים. */
export interface Settings { uppers?: boolean; cabinets?: boolean; cabinetColor?: string; floor?: string; wallColor?: string; light?: 'day' | 'evening'; kelvin?: number; bookmatch?: 'yes' | 'no' | 'unknown'; disposal?: boolean; water?: boolean; xray?: boolean }
export interface Draft {
  thickness?: number; apronH?: number; settings?: Settings | null;
  pieces: { ref: string; name: string; kind: PieceKind; x: number; y: number; w: number; h: number; wall?: Side | null; host?: string | null; side?: Side | null; aprons?: Side[]; grainLock?: boolean; joint?: 'auto' | 'sink' | 'cooktop' | null; corner?: 'butt' | 'miter' | null }[];
  cutouts: { piece: string; kind: CutoutKind; x: number; y: number; w: number; h: number; round?: boolean; built?: boolean | null; cabinet?: number | null; bowls?: 'single' | 'even' | 'ls' | null }[];
}
export interface AiReply { draft?: Draft; reply: string; assumptions?: string[]; missing?: string | null }

export function toDraft(p: Project): Draft {
  const ref = new Map(p.pieces.map((q, i) => [q.id, `P${i + 1}`]));
  return {
    thickness: p.thickness, apronH: p.apronH,
    settings: { uppers: p.uppers, cabinets: p.cabinets, cabinetColor: p.cabinetColor, floor: p.floor, wallColor: p.wallColor || '#f4f2ee', light: p.light || 'day', kelvin: p.kelvin || 4000, bookmatch: p.bookmatch || 'unknown', disposal: !!p.disposal, water: !!p.water, xray: !!p.xray },
    pieces: p.pieces.map((q) => ({ ref: ref.get(q.id)!, name: q.name, kind: q.kind, x: q.x, y: q.y, w: q.w, h: q.h, wall: q.wall || null, host: q.host ? ref.get(q.host) || null : null, side: q.side || null, aprons: q.aprons, grainLock: q.grainLock, joint: q.joint || 'auto', corner: q.corner || 'butt' })),
    cutouts: p.cutouts.map((c) => ({ piece: ref.get(c.pieceId)!, kind: c.kind, x: c.x, y: c.y, w: c.w, h: c.h, round: !!c.round, built: !!c.built, cabinet: c.cabinet || null, bowls: c.bowls || 'single' })),
  };
}

const KINDS: PieceKind[] = ['counter', 'island', 'splash', 'waterfall', 'panel'], CUTS: CutoutKind[] = ['sink', 'cooktop', 'faucet', 'hole'], SIDES: Side[] = ['back', 'front', 'left', 'right'];
const n = (v: unknown, lo: number, hi: number, d: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };

/** מיזוג תשובת המודל לפרויקט, עם ניקוי וולידציה — לא סומכים על הפלט כמו שהוא. */
export function applyDraft(base: Project, d: Draft): Project {
  const prev = new Map(base.pieces.map((q, i) => [`P${i + 1}`, q]));
  const ids = new Map<string, string>();
  for (const q of d.pieces || []) ids.set(q.ref, prev.get(q.ref)?.id || uid());
  const pieces: Piece[] = (d.pieces || []).filter((q) => KINDS.includes(q.kind)).slice(0, 40).map((q) => {
    const old = prev.get(q.ref), vertical = q.kind === 'splash' || q.kind === 'waterfall';
    return {
      id: ids.get(q.ref)!, name: String(q.name || old?.name || 'חלק').slice(0, 60), kind: q.kind,
      x: n(q.x, -20000, 20000, 0), y: n(q.y, -20000, 20000, 0), w: n(q.w, 30, 12000, 600), h: n(q.h, 30, 12000, 600),
      wall: !vertical && q.wall && SIDES.includes(q.wall) ? q.wall : undefined,
      host: vertical && q.host && ids.has(q.host) ? ids.get(q.host) : undefined, side: vertical && q.side && SIDES.includes(q.side) ? q.side : undefined,
      aprons: (q.aprons || []).filter((s) => SIDES.includes(s)), grainLock: q.grainLock !== false, joint: q.joint === 'sink' || q.joint === 'cooktop' ? q.joint : undefined, corner: q.corner === 'miter' ? ('miter' as const) : undefined, outline: old && old.w === q.w && old.h === q.h ? old.outline : undefined,
    };
  }).filter((q) => !(q.kind === 'splash' || q.kind === 'waterfall') || q.host);
  const byId = new Map(pieces.map((q) => [q.id, q]));
  const cutouts: Cutout[] = (d.cutouts || []).filter((c) => CUTS.includes(c.kind) && ids.has(c.piece) && byId.has(ids.get(c.piece)!)).slice(0, 40).map((c) => {
    const host = byId.get(ids.get(c.piece)!)!, w = n(c.w, 10, host.w, 400), h = n(c.h, 10, host.h, 400);
    const old = base.cutouts.find((o) => o.pieceId === host.id && o.kind === c.kind);
    return { id: old?.id || uid('c'), pieceId: host.id, kind: c.kind, x: n(c.x, 0, host.w - w, 0), y: n(c.y, 0, host.h - h, 0), w, h, round: c.round || c.kind === 'faucet' || undefined, mount: c.kind === 'sink' ? old?.mount || 'under' : undefined, built: c.kind === 'sink' && c.built ? true : undefined, cabinet: c.kind === 'sink' && c.cabinet ? n(c.cabinet, 300, 1500, 600) : undefined, bowls: c.kind === 'sink' && (c.bowls === 'even' || c.bowls === 'ls') ? c.bowls : undefined };
  });
  const st = d.settings || {}, hex = (v: unknown, dflt: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : dflt), bool = (v: unknown, dflt: boolean) => (typeof v === 'boolean' ? v : dflt);
  return {
    ...base, thickness: n(d.thickness, 6, 60, base.thickness), apronH: n(d.apronH, 0, 200, base.apronH), pieces, cutouts,
    uppers: bool(st.uppers, base.uppers), cabinets: bool(st.cabinets, base.cabinets), cabinetColor: hex(st.cabinetColor, base.cabinetColor), wallColor: hex(st.wallColor, base.wallColor || '#f4f2ee'),
    floor: FLOORS.some((f) => f.id === st.floor) ? st.floor! : base.floor, light: st.light === 'evening' || st.light === 'day' ? st.light : base.light,
    kelvin: st.kelvin === 3000 || st.kelvin === 4000 || st.kelvin === 6000 ? st.kelvin : base.kelvin, bookmatch: st.bookmatch === 'yes' || st.bookmatch === 'no' || st.bookmatch === 'unknown' ? st.bookmatch : base.bookmatch,
    disposal: bool(st.disposal, !!base.disposal), water: bool(st.water, !!base.water), xray: bool(st.xray, !!base.xray),
  };
}

async function call(body: Record<string, unknown>): Promise<AiReply> {
  if (!sb) throw new Error('יכולות ה-AI פועלות באתר המחובר (לא במצב הדגמה מקומי).');
  const { data, error } = await sb.functions.invoke('ai', { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* נשארים עם ההודעה הכללית */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  // בקשה שהמערכת עוד לא יודעת לבצע נרשמת, כדי שנדע מה להוסיף
  if (data?.missing) sb.from('ai_requests').insert({ text: String(body.text || '').slice(0, 1000), missing: String(data.missing).slice(0, 500) }).then(() => {});
  return data as AiReply;
}

const fileB64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(new Error('קריאת הקובץ נכשלה')); r.readAsDataURL(f); });

export const ai = {
  /** צילום / PDF של תוכנית או דף מדידה → מטבח. */
  async fromPlan(file: File): Promise<AiReply> {
    if (file.size > 12 * 1024 * 1024) throw new Error('הקובץ גדול מדי (עד 12MB).');
    return call({ mode: 'plan', media_type: file.type || 'image/jpeg', data: await fileB64(file) });
  },
  /** צ'אט: שאלה, בקשה לשינוי או להזזה. history = ההודעות הקודמות בשיחה. */
  chat: (p: Project, text: string, history: { role: 'user' | 'ai'; text: string }[], facts: Record<string, unknown>) => call({ mode: 'chat', text, history: history.slice(-10), draft: toDraft(p), facts }),
  /** חוות דעת מקצועית והצעות עיצוב על בסיס ממצאי הבודק. */
  advise: (p: Project, facts: Record<string, unknown>) => call({ mode: 'advise', draft: toDraft(p), facts }),
};

/** מצב הדגמה (בלי חיבור): מבין כמה בקשות נפוצות, כדי שאפשר יהיה להתרשם מהצ'אט. */
export function localAssist(p: Project, text: string): { project?: Project; reply: string } {
  const flat = p.pieces.filter((q) => q.kind === 'counter' || q.kind === 'island'), num = text.match(/(\d+(?:[.,]\d+)?)/), meters = /מטר|מ׳/.test(text);
  const mm = num ? Math.round(parseFloat(num[1].replace(',', '.')) * (meters ? 1000 : 10)) : 0;
  const mk = (q: Partial<Piece> & Pick<Piece, 'kind' | 'w' | 'h'>): Piece => ({ id: uid(), name: '', x: 0, y: 0, aprons: [], grainLock: true, ...q });
  const mv = text.match(/(כיור|כיריים|ברז)/), dir = text.match(/(שמאלה|ימינה|קדימה|אחורה)/);
  if (mv && dir && mm) {
    const kind = mv[1] === 'כיור' ? 'sink' : mv[1] === 'כיריים' ? 'cooktop' : 'faucet', c = p.cutouts.find((x) => x.kind === kind), host = c && p.pieces.find((q) => q.id === c.pieceId);
    if (!c || !host) return { reply: `לא מצאתי ${mv[1]} במטבח.` };
    const dx = dir[1] === 'שמאלה' ? -mm : dir[1] === 'ימינה' ? mm : 0, dy = dir[1] === 'קדימה' ? mm : dir[1] === 'אחורה' ? -mm : 0;
    const x = Math.max(0, Math.min(host.w - c.w, c.x + dx)), y = Math.max(0, Math.min(host.h - c.h, c.y + dy));
    return { project: { ...p, cutouts: p.cutouts.map((q) => (q.id === c.id ? { ...q, x, y } : q)) }, reply: `הזזתי את ה${mv[1]} ${mm / 10} ס"מ ${dir[1]}.` };
  }
  if (/מפל/.test(text)) {
    const isl = flat.find((q) => q.kind === 'island' && !p.pieces.some((w) => w.kind === 'waterfall' && w.host === q.id));
    if (!isl) return { reply: 'אין אי בלי מפל. אפשר לבקש קודם "תוסיף אי".' };
    const sides: Side[] = isl.w >= isl.h ? ['left', 'right'] : ['back', 'front'];
    return { project: { ...p, pieces: [...p.pieces, ...sides.map((s) => mk({ kind: 'waterfall', name: 'מפל', w: Math.min(isl.w, isl.h), h: p.counterH - p.thickness, host: isl.id, side: s }))] }, reply: 'הוספתי מפל בשני צדי האי.' };
  }
  if (/חיפוי/.test(text) && /(תקרה|בלי|ללא|תוריד|ארונות)/.test(text)) { const hosts = flat.filter((q) => q.kind === 'counter' && q.wall), ids = new Set(hosts.map((q) => q.id)), rest = p.pieces.filter((q) => !(q.kind === 'splash' && q.host && ids.has(q.host))); if (/בלי|ללא|תוריד/.test(text)) return { project: { ...p, pieces: rest }, reply: 'הורדתי את חיפוי הקיר.' }; const h = /תקרה/.test(text) ? Math.min(2500 - p.counterH, p.slabH - 2 * p.margin) : 1500 - p.counterH; return { project: { ...p, pieces: [...rest, ...hosts.map((q) => mk({ kind: 'splash', name: 'חיפוי קיר', w: q.wall === 'back' || q.wall === 'front' ? q.w : q.h, h, host: q.id, side: q.wall }))] }, reply: /תקרה/.test(text) ? 'החיפוי עכשיו עד התקרה.' : 'החיפוי עכשיו עד הארונות העליונים.' }; }
  if (/חיפוי/.test(text)) {
    const host = flat.find((q) => q.wall && !p.pieces.some((w) => w.kind === 'splash' && w.host === q.id));
    if (!host) return { reply: 'לכל המשטחים שצמודים לקיר כבר יש חיפוי.' };
    return { project: { ...p, pieces: [...p.pieces, mk({ kind: 'splash', name: 'חיפוי קיר', w: host.wall === 'back' || host.wall === 'front' ? host.w : host.h, h: mm && mm <= 1500 ? mm : 600, host: host.id, side: host.wall })] }, reply: `הוספתי חיפוי קיר מעל "${host.name}".` };
  }
  if (/אי(\s|$)/.test(text) && /(הוסף|תוסיף|להוסיף|רוצה)/.test(text)) {
    const ys = flat.map((q) => q.y + q.h), xs = flat.map((q) => q.x), w = mm >= 800 && mm <= 3200 ? mm : 2000;
    return { project: { ...p, pieces: [...p.pieces, mk({ kind: 'island', name: 'אי', x: xs.length ? Math.min(...xs) : 0, y: (ys.length ? Math.max(...ys) : 0) + 1050, w, h: 1000, aprons: ['front', 'back', 'left', 'right'] })] }, reply: `הוספתי אי באורך ${w / 10} ס"מ. אפשר לגרור אותו למקום.` };
  }
  if (/ערב|לילה/.test(text)) return { project: { ...p, light: 'evening' }, reply: 'עברתי לתאורת ערב.' };
  if (/אור יום|יום/.test(text) && /תאור|אור/.test(text)) return { project: { ...p, light: 'day' }, reply: 'עברתי לאור יום.' };
  const k = text.match(/(3000|4000|6000)/); if (k) return { project: { ...p, kelvin: +k[1] as 3000 }, reply: `גוון התאורה עכשיו ${k[1]}K.` };
  if (/ארונות עליונים|ארונות למעלה/.test(text)) { const off = /בלי|להוריד|תוריד|ללא/.test(text); return { project: { ...p, uppers: !off }, reply: off ? 'הורדתי את הארונות העליונים.' : 'הוספתי ארונות עליונים.' }; }
  if (/טוחן/.test(text)) return { project: { ...p, disposal: !/בלי|תוריד/.test(text), xray: true }, reply: 'עדכנתי טוחן אשפה. פנים הארון מוצג כדי שיראו אותו.' };
  if (/מערכת מים|מים/.test(text) && /תוסיף|הוסף|רוצה|בלי|תוריד/.test(text)) return { project: { ...p, water: !/בלי|תוריד/.test(text), xray: true }, reply: 'עדכנתי מערכת מים בארון הכיור.' };
  if (/בוק/.test(text)) return { project: { ...p, bookmatch: /לא/.test(text) ? 'no' : 'yes' }, reply: /לא/.test(text) ? 'סימנתי שהדגם אינו בוק־מאץ׳.' : 'סימנתי שהדגם בוק־מאץ׳. הלוח השני מוצג במראה.' };
  if (/45|גרונג/.test(text)) { const leg = flat.find((q) => q.h > q.w); if (leg) return { project: { ...p, pieces: p.pieces.map((q) => (q.id === leg.id ? { ...q, corner: 'miter' as const } : q)) }, reply: 'חיבור הפינה עכשיו בגרונג 45°.' }; }
  if (/חיבור/.test(text) && /(כיור|כיריים)/.test(text)) { const kind = /כיור/.test(text) ? 'sink' as const : 'cooktop' as const, host = flat.find((q) => p.cutouts.some((c) => c.pieceId === q.id && c.kind === kind)); if (host) return { project: { ...p, pieces: p.pieces.map((q) => (q.id === host.id ? { ...q, joint: kind } : q)) }, reply: `אם יהיה חיבור ב"${host.name}", הוא יעבור במרכז ה${kind === 'sink' ? 'כיור' : 'כיריים'}.` }; }
  const fl = FLOORS.find((f) => text.includes(f.name)); if (fl) return { project: { ...p, floor: fl.id }, reply: `הריצוף עכשיו ${fl.name}.` };
  const cb = CABINETS.find((c) => text.includes(c.name)); if (cb && /ארונ|חזית/.test(text)) return { project: { ...p, cabinetColor: cb.hex }, reply: `צבע הארונות עכשיו ${cb.name}.` };
  const wl = WALLS.find((c) => text.includes(c.name)); if (wl && /קיר/.test(text)) return { project: { ...p, wallColor: wl.hex }, reply: `צבע הקיר עכשיו ${wl.name}.` };
  void mkP;
  return { reply: 'במצב הדגמה אני מבין בקשות בסיסיות בלבד, למשל: "תזיז את הכיור 20 ס"מ שמאלה", "תוסיף אי של 2 מטר", "תוסיף מפל", "תאורת ערב", "בלי ארונות עליונים", "חיבור בכיור", "חיבור פינה 45", "תוסיף טוחן". באתר המחובר אפשר לשאול ולבקש כל דבר בשפה חופשית.' };
}
