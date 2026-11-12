// הפאנלים של הסטודיו. ימין: השלב הנוכחי במסלול (מידות › אבן › עיצוב › בדיקה › סיכום). שמאל: צ'אט ובודק חכם.
import { ReactNode, useEffect, useRef, useState } from 'react';
import { CABINETS, FAUCETS, FINISHES, FLOORS, GLASS, Swatch, WALLS, faucetById } from '../core/catalog';
import { factorHe, runningMeters } from '../core/pricing';
import { exportNestDxf } from '../core/dxf';
import { CUT_HE, Cutout, CutoutKind, KIND_HE, Piece, Project, SEAT_DEPTH, SIDE_HE, Side, UPPER_HE, UpperStyle, bounds, chairCount, cornerExt, setSplash, isVertical, letter, piece as mkPiece, pieceLen, sinkNet, uid, upperBottom } from '../core/model';
import { upgrades } from '../core/upgrades';
import { OrderStatus, STATUS_HE, isLocal, stoneLabel } from '../data/repo';
import { Compare } from './Compare';
import { ai, applyDraft, localAssist } from '../ai';
import { Step, go, useStore } from '../store';
import { Icon } from './icons';
import { cm, m2, parseCm, useStone } from './util';

const SIDES: Side[] = ['back', 'front', 'left', 'right'];
export const STEPS: { id: Step; name: string; hint: string }[] = [
  { id: 'dims', name: 'מידות', hint: 'בודקים את המשטחים והפתחים. גוררים בשרטוט או מקלידים מידה.' },
  { id: 'stone', name: 'אבן', hint: 'בוחרים לוח, עובי וקנט.' },
  { id: 'design', name: 'עיצוב', hint: 'צבע ארונות, ריצוף וקיר — כדי שהלקוח יראה את המטבח שלו.' },
  { id: 'check', name: 'בדיקה ונסטינג', hint: 'עוברים על ההתראות ועל פריסת החלקים בלוחות.' },
  { id: 'summary', name: 'סיכום', hint: 'פרטי ההזמנה ומסמך ללקוח.' },
];

function Num({ label, value, onChange, unit = 'ס"מ', mm, min = 0 }: { label: string; value: number; onChange: (mm: number) => void; unit?: string; mm?: boolean; min?: number }) {
  const shown = mm ? String(value) : cm(value);
  return (
    <label className="field"><span>{label}<i style={{ fontStyle: 'normal', opacity: 0.7 }}>{unit}</i></span>
      <input type="number" step={mm ? 1 : 0.1} key={shown} defaultValue={shown} onBlur={(e) => { const v = mm ? Math.round(+e.target.value) : parseCm(e.target.value); if (v != null && Number.isFinite(v) && v !== value) onChange(Math.max(min, v)); }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    </label>
  );
}
function Swatches({ items, value, onPick, big }: { items: Swatch[]; value: string; onPick: (hex: string) => void; big?: boolean }) {
  return <div className={`swatches ${big ? 'big' : ''}`}>{items.map((c) => <button key={c.id} className={`sw ${value.toLowerCase() === c.hex.toLowerCase() ? 'on' : ''}`} title={c.name} onClick={() => onPick(c.hex)}><i style={{ background: c.hex }} /><span>{c.name}</span></button>)}</div>;
}

// ----- פעולות הוספה -----
const flatOf = (p: Project) => p.pieces.filter((q) => !isVertical(q));
function addPiece(kind: 'counter' | 'island') {
  const st = useStore.getState(); let id = '';
  st.apply((p) => { const b = bounds(p), has = flatOf(p).length > 0; const q = kind === 'counter' ? mkPiece({ kind, name: has ? 'משטח נוסף' : 'משטח ראשי', x: has ? b.x + b.w + 300 : 0, y: b.y, w: 2000, h: 620, wall: 'back', aprons: ['front'] }) : mkPiece({ kind, name: 'אי', x: b.x, y: has ? b.y + b.h + 1000 : 0, w: 2000, h: 1000, aprons: ['front', 'back', 'left', 'right'] }); id = q.id; return { ...p, pieces: [...p.pieces, q] }; });
  if (id) st.select({ type: 'piece', id });
}
function addVertical(kind: 'splash' | 'waterfall') {
  const st = useStore.getState(), p = st.project!, sel = st.sel?.type === 'piece' ? p.pieces.find((q) => q.id === st.sel!.id) : undefined;
  const host = sel && !isVertical(sel) ? sel : flatOf(p).find((q) => (kind === 'splash' ? q.wall : q.kind === 'island')) || flatOf(p)[0];
  if (!host) return st.setToast('קודם מוסיפים משטח');
  const sides: Side[] = kind === 'splash' ? [host.wall || 'back'] : host.w >= host.h ? ['left', 'right'] : ['back', 'front'];
  const fresh = sides.filter((s) => !p.pieces.some((q) => q.kind === kind && q.host === host.id && q.side === s));
  if (!fresh.length) return st.setToast(kind === 'splash' ? 'כבר יש חיפוי לצד הזה' : 'כבר יש מפלים לחלק הזה');
  st.apply((pr) => ({ ...pr, pieces: [...pr.pieces, ...fresh.map((s) => { const ce = kind === 'splash' && s === host.wall ? cornerExt(pr, host) : { lead: 0, tail: 0 }, a = ce.lead ? ce.lead - pr.thickness : 0, b = ce.tail ? ce.tail - pr.thickness : 0; return mkPiece({ kind, name: kind === 'splash' ? 'חיפוי קיר' : `מפל · ${SIDE_HE[s]}`, off: a ? -a : undefined, w: (s === 'back' || s === 'front' ? host.w : host.h) + a + b, h: kind === 'splash' ? 600 : pr.counterH - pr.thickness, host: host.id, side: s }); })] }));
}
function addCutout(kind: CutoutKind, built = false) {
  const st = useStore.getState(), p = st.project!, sel = st.sel?.type === 'piece' ? p.pieces.find((q) => q.id === st.sel!.id) : undefined;
  const host = sel && !isVertical(sel) ? sel : flatOf(p)[0]; if (!host) return st.setToast('קודם מוסיפים משטח');
  const [w, h] = kind === 'sink' ? [760, 400] : kind === 'cooktop' ? [560, 490] : kind === 'faucet' ? [35, 35] : [100, 100];
  const sink = p.cutouts.find((c) => c.pieceId === host.id && c.kind === 'sink');
  const used = p.cutouts.filter((c) => c.pieceId === host.id && c.kind !== 'faucet');
  let x = (host.w - w) / 2, y = (host.h - h) / 2;
  if (kind === 'faucet' && sink) { x = sink.x + sink.w / 2 - 17.5; y = Math.max(25, sink.y / 2 - 17.5); }
  else if (host.w >= host.h) { const cand = [host.w * 0.25, host.w * 0.72, host.w * 0.5].map((c) => c - w / 2); x = cand.find((cx) => !used.some((u) => cx < u.x + u.w + 300 && u.x < cx + w + 300)) ?? cand[0]; }
  const c: Cutout = { id: uid('c'), pieceId: host.id, kind, x: Math.round(Math.max(0, Math.min(host.w - w, x))), y: Math.round(Math.max(0, Math.min(host.h - h, y))), w: Math.min(w, host.w), h: Math.min(h, host.h), round: kind === 'faucet' || undefined, mount: kind === 'sink' ? 'under' : undefined, built: built || undefined, cabinet: built ? 800 : undefined };
  st.apply((pr) => ({ ...pr, cutouts: [...pr.cutouts, c] })); st.select({ type: 'cutout', id: c.id });
}

export { setSplash } from '../core/model';
const NOTE_VEINS = 'ההדמיה להמחשה בלבד — אין התחייבות לגידים. מיקום וכיוון הגידים בפועל משתנים מלוח ללוח.';

export function LeftPanel() {
  const project = useStore((s) => s.project)!, order = useStore((s) => s.order)!, sel = useStore((s) => s.sel), stones = useStore((s) => s.stones), step = useStore((s) => s.step), nest = useStore((s) => s.nest), issues = useStore((s) => s.issues);
  const { apply, select, patchOrder, setStep, flush } = useStore.getState();
  const stone = useStone(), set = (patch: Partial<Project>, key?: string) => apply((p) => ({ ...p, ...patch }), key);
  const [cmp, setCmp] = useState(false), [q, setQ] = useState('');
  const norm = (t?: string | null) => (t || '').toLowerCase().replace(/[׳'"\s-]/g, '');
  const shown = stones.filter((s) => !q.trim() || [s.name, s.en, s.novo].some((t) => norm(t).includes(norm(q))));
  const flat = project.pieces.filter((p) => !isVertical(p)), i = STEPS.findIndex((s) => s.id === step), cur = STEPS[i], m = nest?.metrics;
  const errors = issues.filter((x) => x.level === 'error').length, warns = issues.filter((x) => x.level === 'warn').length;
  const dxf = () => { if (!nest) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportNestDxf(nest.slabs)], { type: 'application/dxf' })); a.download = `${order.title}-nesting.dxf`; a.click(); URL.revokeObjectURL(a.href); };

  const rm = runningMeters(project);
  let body: ReactNode;
  if (step === 'dims') body = <>
    <Inspector />
    <section>
      <div className="row"><span className="cap">חלקים</span><span className="sp" /><span className="mute mono" style={{ fontSize: 12 }}>{project.pieces.length}</span></div>
      <div className="plist">
        {flat.map((p) => [p, ...project.pieces.filter((q) => q.host === p.id)]).flat().concat(project.pieces.filter((q) => isVertical(q) && !flat.some((f) => f.id === q.host))).map((p) => (
          <button key={p.id} className={`pitem ${sel?.type === 'piece' && sel.id === p.id ? 'on' : ''}`} style={isVertical(p) ? { paddingInlineStart: 22 } : undefined} onClick={() => select({ type: 'piece', id: p.id })}>
            <i className={isVertical(p) ? 'sub' : ''}>{letter(project.pieces.indexOf(p))}</i><span>{p.name}</span><em>{cm(p.w)}×{cm(p.h)}</em>
          </button>
        ))}
      </div>
    </section>
    <section>
      <span className="cap">הוספה</span>
      <div className="chips">
        <button className="chip" onClick={() => addPiece('counter')}>+ משטח</button><button className="chip" onClick={() => addPiece('island')}>+ אי</button>
        <button className="chip" onClick={() => addVertical('splash')}>+ חיפוי</button><button className="chip" onClick={() => addVertical('waterfall')}>+ מפל</button>
        <button className="chip" onClick={() => addCutout('sink')}>+ כיור</button><button className="chip" onClick={() => addCutout('sink', true)}>+ כיור בנוי</button><button className="chip" onClick={() => addCutout('cooktop')}>+ כיריים</button><button className="chip" onClick={() => addCutout('faucet')}>+ ברז</button>
      </div>
    </section>
  </>;
  else if (step === 'stone') body = <>
    <section>
      <span className="cap">לוח</span>
      <input className="input" type="search" placeholder="חיפוש דגם: שם בעברית, באנגלית או השם הקודם…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="stonegrid">{shown.map((s) => <button key={s.id} className={`stone ${String(s.id) === String(stone.id) ? 'on' : ''}`} title={stoneLabel(s)} onClick={() => set({ stoneId: s.id })}>
        <i style={{ backgroundImage: s.hasImage ? `url("${s.thumb || s.url}")` : undefined }}>{!s.hasImage && 'אין תמונה'}</i>
        <b>{s.name}</b><small>{s.en || ' '}{s.stock === 'no' ? ' · אין במלאי' : ''}</small>
      </button>)}{!shown.length && <div className="mute" style={{ fontSize: 13 }}>לא נמצא דגם בשם הזה.</div>}</div>
      <div className="row"><b style={{ fontSize: 14 }}>{stoneLabel(stone)}</b></div>
      <div style={{ height: 120, borderRadius: 14, background: `#ddd url("${stone.url}") center/cover`, boxShadow: 'inset 0 0 0 .5px rgba(0,0,0,.2)' }} />
      {stone.stock === 'no' && <div className="note err">הדגם הזה מסומן "אין במלאי". כדאי להציע ללקוח דגם דומה.</div>}
      {!stone.hasImage && <div className="note">לדגם הזה אין עדיין תמונת לוח, ולכן ההדמיה מציגה אבן כללית.</div>}
      <button className="btn sm" onClick={() => setCmp(true)}><Icon.grid />השוואת דגמים זה לצד זה</button>
      
    </section>
    <section>
      <span className="cap">האם הדגם בוק־מאץ׳?</span>
      <div className="seg">{([['yes', 'כן'], ['no', 'לא'], ['unknown', 'לא ידוע']] as const).map(([k, v]) => <button key={k} className={(project.bookmatch || 'unknown') === k ? 'on' : ''} onClick={() => set({ bookmatch: k })}>{v}</button>)}</div>
      <div className="mute" style={{ fontSize: 12.5 }}>{project.bookmatch === 'yes' ? 'הלוחות מגיעים בזוגות מראה (A / B), ואפשר להתאים גידים בין לוח ללוח. הלוח השני מוצג במראה.' : project.bookmatch === 'no' ? 'כל לוח עומד בפני עצמו. רצף גידים אפשרי רק בתוך אותו לוח.' : 'כדאי לוודא מול המלאי לפני שמבטיחים ללקוח התאמת גידים.'}</div>
      <div className="note">{NOTE_VEINS}</div>
    </section>
    <section>
      <span className="cap">עובי וקנט</span>
      <div className="chips">{[12, 20, 30].map((t) => <button key={t} className={`chip ${project.thickness === t ? 'on' : ''}`} onClick={() => set({ thickness: t })}>{t} מ"מ</button>)}</div>
      <div className="field"><span>גובה הקנט הנראה</span><div className="chips">{[0, 30, 40, 60, 80].map((t) => <button key={t} className={`chip ${project.apronH === t ? 'on' : ''}`} onClick={() => set({ apronH: t })}>{t ? `${t} מ"מ` : 'בלי קנט'}</button>)}</div></div>
    </section>
    <section>
      <span className="cap">מידת הלוח</span>
      <div className="grid2"><Num label="אורך" value={project.slabW} min={500} onChange={(v) => set({ slabW: v })} /><Num label="רוחב" value={project.slabH} min={500} onChange={(v) => set({ slabH: v })} /></div>
    </section>
  </>;
  else if (step === 'design') body = <>
    <section>
      <div className="row"><span className="cap">צבע ארונות</span><span className="sp" /><span className="mute" style={{ fontSize: 12 }}>{CABINETS.find((c) => c.hex.toLowerCase() === project.cabinetColor.toLowerCase())?.name || 'מותאם'}</span></div>
      <Swatches items={CABINETS} value={project.cabinetColor} onPick={(hex) => set({ cabinetColor: hex })} />
      <label className="row" style={{ fontSize: 12.5, color: 'var(--mute)' }}>גוון אחר<input type="color" value={project.cabinetColor} onChange={(e) => set({ cabinetColor: e.target.value }, 'cab')} style={{ width: 34, height: 26, border: 0, background: 'none', padding: 0 }} /></label>
      <div className="chips">
        <button className={`chip ${project.cabinets ? 'on' : ''}`} onClick={() => set({ cabinets: !project.cabinets })}>ארונות תחתונים</button>
        <button className={`chip ${project.uppers ? 'on' : ''}`} onClick={() => set({ uppers: !project.uppers })}>ארונות עליונים</button>
        <button className={`chip ${project.plinthStone ? 'on' : ''}`} onClick={() => set({ plinthStone: !project.plinthStone })}>צוקל מאבן</button>
      </div>
    </section>
    {project.uppers && <section>
      <span className="cap">ארונות עליונים</span>
      <div className="chips">{(Object.keys(UPPER_HE) as UpperStyle[]).map((k) => <button key={k} className={`chip ${(project.upperStyle || 'doors') === k ? 'on' : ''}`} onClick={() => set({ upperStyle: k })}>{UPPER_HE[k]}</button>)}</div>
      <div className="grid2">
        <Num label="גובה הארון" value={project.upperH || 700} min={300} onChange={(v) => apply((p) => { const was = upperBottom(p), np = { ...p, upperH: Math.min(1200, v) }; return { ...np, pieces: p.pieces.map((q) => (q.kind === 'splash' && q.h === was - p.counterH ? { ...q, h: upperBottom(np) - p.counterH } : q)) }; })} />
        <div className="field"><span>מרווח מעל המשטח</span><div className="input mono" style={{ background: 'rgba(27,26,24,.04)' }}>{cm(upperBottom(project) - project.counterH)}</div></div>
      </div>
      <div className="row"><span className="mute" style={{ fontSize: 12 }}>צבע החזיתות העליונות</span><span className="sp" />{project.upperColor && <button className="link" style={{ fontSize: 12 }} onClick={() => set({ upperColor: undefined })}>כמו התחתונים</button>}</div>
      <Swatches items={CABINETS} value={project.upperColor || project.cabinetColor} onPick={(hex) => set({ upperColor: hex })} />
      {project.upperStyle === 'glass' && <><span className="mute" style={{ fontSize: 12 }}>גוון הזכוכית</span><Swatches items={GLASS} value={project.glassTint || GLASS[0].hex} onPick={(hex) => set({ glassTint: hex })} /></>}
      {project.upperStyle !== 'shelves' && <div className="chips"><button className={`chip ${project.underLight !== false ? 'on' : ''}`} onClick={() => set({ underLight: project.underLight === false })}>תאורה מתחת לארונות</button></div>}
    </section>}
    <section>
      <div className="row"><span className="cap">ריצוף</span><span className="sp" /><span className="mute" style={{ fontSize: 12 }}>{FLOORS.find((f) => f.id === project.floor)?.name}</span></div>
      <div className="swatches">{FLOORS.map((f) => <button key={f.id} className={`sw ${project.floor === f.id ? 'on' : ''}`} title={f.name} onClick={() => set({ floor: f.id })}><i style={{ background: f.type === 'checker' ? `conic-gradient(${f.a} 25%, ${f.b} 0 50%, ${f.a} 0 75%, ${f.b} 0) 0 0/50% 50%` : f.type === 'plank' ? `repeating-linear-gradient(0deg, ${f.a} 0 7px, ${f.b} 7px 14px)` : f.type === 'tile' ? `linear-gradient(${f.line} 1px, transparent 1px) 0 0/50% 50%, linear-gradient(90deg, ${f.line} 1px, ${f.a} 1px) 0 0/50% 50%` : `radial-gradient(${f.b} 15%, ${f.a} 16%) 0 0/9px 9px` }} /><span>{f.name}</span></button>)}</div>
    </section>
    <section>
      <span className="cap">חיפוי קיר</span>
      <div className="chips">{([['none', 'בלי'], ['60', '60 ס"מ'], ['uppers', 'עד הארונות'], ['ceiling', 'עד התקרה']] as const).map(([k, v]) => <button key={k} className="chip" onClick={() => apply((p) => setSplash(p, k))}>{v}</button>)}</div>
      {project.pieces.some((q) => q.kind === 'splash') && <Num label="גובה החיפוי (חופשי)" value={project.pieces.find((q) => q.kind === 'splash')!.h} min={50} onChange={(v) => set({ pieces: project.pieces.map((q) => (q.kind === 'splash' ? { ...q, h: Math.min(v, project.slabH - 2 * project.margin) } : q)) })} />}
    </section>
    <section>
      <span className="cap">ברז</span>
      <select className="input" value={faucetById(project.faucet).id} onChange={(e) => { const f = faucetById(e.target.value); set({ faucet: f.id, faucetFinish: f.finishes.includes(project.faucetFinish || '') ? project.faucetFinish : f.finishes[0], water: f.water ? true : project.water }); }}>{FAUCETS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
      <div className="chips">{faucetById(project.faucet).finishes.map((k) => <button key={k} className={`chip ${(project.faucetFinish || faucetById(project.faucet).finishes[0]) === k ? 'on' : ''}`} onClick={() => set({ faucetFinish: k })}><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: FINISHES[k].hex, marginInlineEnd: 5, boxShadow: 'inset 0 0 0 .5px rgba(0,0,0,.3)' }} />{FINISHES[k].name}</button>)}</div>
    </section>
    <section>
      <span className="cap">תאורה</span>
      <div className="seg">{([['day', 'אור יום'], ['evening', 'ערב']] as const).map(([k, v]) => <button key={k} className={(project.light || 'day') === k ? 'on' : ''} onClick={() => set({ light: k })}>{v}</button>)}</div>
      <div className="chips">{([[3000, '3000K · חם'], [4000, '4000K · ניטרלי'], [6000, '6000K · קר']] as const).map(([k, v]) => <button key={k} className={`chip ${(project.kelvin || 4000) === k ? 'on' : ''}`} onClick={() => set({ kelvin: k })}>{v}</button>)}</div>
    </section>
    <section>
      <span className="cap">מוצרים נלווים</span>
      <div className="chips">
        <button className={`chip ${project.disposal ? 'on' : ''}`} onClick={() => set({ disposal: !project.disposal })}>טוחן אשפה</button>
        <button className={`chip ${project.water ? 'on' : ''}`} onClick={() => set({ water: !project.water })}>מערכת מים</button>
        <button className={`chip ${project.xray ? 'on' : ''}`} onClick={() => set({ xray: !project.xray })}>הצג את פנים הארון</button>
      </div>
      <div className="mute" style={{ fontSize: 12.5 }}>טוחן נובו (1 כ"ס) תלוי בקו התחתון של הכיור, עם כפתור אוויר על המשטח. מערכת המים: מחמם, מקרר ומסנן בארון הכיור, וברז ייעודי על המשטח. "פנים הארון" הופך לשקופות רק את הדלתות של ארון הכיור.</div>
      {project.cutouts.some((c) => c.kind === 'sink') && <button className="btn sm" onClick={() => dispatchEvent(new CustomEvent('bs-focus-sink'))}><Icon.max />זום לכיור</button>}
    </section>
    <section>
      <span className="cap">צבע קיר</span>
      <Swatches items={WALLS} value={project.wallColor || '#f4f2ee'} onPick={(hex) => set({ wallColor: hex })} />
    </section>
  </>;
  else if (step === 'check') body = <>
    <section>
      <span className="cap">נסטינג</span>
      <div className="metrics">
        <div className="metric"><small>לוחות</small><b>{m?.slabs ?? 0}</b></div><div className="metric"><small>ניצולת</small><b>{m?.utilization ?? 0}%</b></div>
        <div className="metric"><small>חיבורים</small><b>{m?.joints ?? 0}</b></div><div className="metric"><small>קנט · מטר</small><b>{((m?.apronLen || 0) / 1000).toFixed(2)}</b></div>
      </div>
      {nest?.slabs.map((s, n) => <div key={n} className="row" style={{ fontSize: 13 }}><span>לוח {n + 1}</span><div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(27,26,24,.08)' }}><div style={{ width: `${s.used}%`, height: '100%', borderRadius: 3, background: s.used < 25 ? 'var(--warn)' : 'var(--cut)' }} /></div><span className="mono">{s.used}%</span></div>)}
    </section>
    <section>
      <span className="cap">הגדרות חיתוך</span>
      <div className="grid2"><Num label="עובי מסור" unit='מ"מ' mm value={project.kerf} onChange={(v) => set({ kerf: Math.min(20, v) })} /><Num label="שוליים בלוח" unit='מ"מ' mm value={project.margin} onChange={(v) => set({ margin: Math.min(100, v) })} /></div>
      <div className="chips">
        <button className="chip" onClick={() => set({ pieces: project.pieces.map((q) => ({ ...q, grainLock: true })) })}>נעל גיד בכל החלקים</button>
        <button className="chip" onClick={() => set({ pieces: project.pieces.map((q) => ({ ...q, grainLock: false })) })}>שחרר גיד (חיסכון)</button>
      </div>
      <button className="btn sm" onClick={dxf}><Icon.download />ייצוא תוכנית החיתוך ל-DXF</button>
    </section>
    <section>
      <span className="cap">מצב</span>
      <div className="note">{NOTE_VEINS}</div>
      {errors ? <div className="note err">{errors} שגיאות שחייבים לתקן לפני ייצור — מפורטות בצד שמאל.</div> : warns ? <div className="note">{warns} אזהרות לבדיקה — מפורטות בצד שמאל.</div> : <div className="note" style={{ background: 'rgba(47,176,112,.12)', color: '#1f6e45' }}>אין שגיאות. אפשר להמשיך לסיכום.</div>}
    </section>
  </>;
  else body = <>
    <section>
      <span className="cap">פרטי ההזמנה</span>
      <label className="field">שם<input value={order.title} onChange={(e) => patchOrder({ title: e.target.value })} /></label>
      <div className="grid2">
        <label className="field">מס׳ הזמנה<input dir="ltr" value={order.order_no || ''} onChange={(e) => patchOrder({ order_no: e.target.value })} /></label>
        <label className="field">סטטוס<select value={order.status} onChange={(e) => patchOrder({ status: e.target.value as OrderStatus })}>{Object.entries(STATUS_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <label className="field">הערות<textarea rows={3} value={project.notes} onChange={(e) => set({ notes: e.target.value }, 'notes')} /></label>
    </section>
    <section>
      <span className="cap">הצעות שדרוג ללקוח</span>
      {nest && upgrades(project, nest).map((u) => (
        <div key={u.id} className={`upg ${u.active ? 'on' : ''}`}>
          <div className="row"><b>{u.title}</b><span className="sp" /><button className={`btn sm ${u.active ? '' : 'primary'}`} onClick={() => apply(u.apply)}>{u.active ? 'הסר' : 'הוסף'}</button></div>
          <p>{u.pitch}</p>
          <span className="mute mono" style={{ fontSize: 11.5 }}>{u.dRm ? `${u.dRm > 0 ? '+' : ''}${u.dRm} מטר רץ` : u.dArea ? 'אבן לכיור בנוי' : 'בלי אבן נוספת'}{u.dSlabs ? ` · ${u.dSlabs > 0 ? '+' : ''}${u.dSlabs} לוח` : u.dArea > 0 ? ' · בלי לוח נוסף' : ''}</span>
        </div>
      ))}
    </section>
    <section>
      <div className="row"><span className="cap">מטר רץ לחישוב</span><span className="sp" /><b className="mono">{rm.total.toFixed(2)}</b></div>
      <table className="rm"><tbody>{rm.rows.map((r) => <tr key={r.id}><td>{r.name}</td><td className="mono">{cm(r.len)}×{cm(r.wid)}</td><td>{factorHe(r.factor)}</td><td className="mono">{r.rm.toFixed(2)}</td></tr>)}</tbody></table>
      <div className="mute" style={{ fontSize: 12 }}>לפי רוחב: עד 20 ס"מ שליש · 20–30 חצי · 31–70 רגיל · 70–150 כפול.</div>
    </section>
    <section>
      <span className="cap">סיכום</span>
      <div className="metrics">
        <div className="metric"><small>לוחות</small><b>{m?.slabs ?? 0}</b></div><div className="metric"><small>מטר רץ</small><b>{rm.total.toFixed(2)}</b></div>
        <div className="metric"><small>חלקים</small><b>{project.pieces.length}</b></div><div className="metric"><small>לבדיקה</small><b>{errors + warns}</b></div>
      </div>
      <div className="mute" style={{ fontSize: 13 }}>{stoneLabel(stone)} · {project.thickness} מ"מ · {project.apronH ? `קנט ${project.apronH} מ"מ` : 'בלי קנט'}</div>
    </section>
    <button className="btn primary" onClick={() => { flush(); go(`/o/${order.id}/doc`); }}><Icon.doc />מסמך ללקוח</button>
  </>;

  return (
    <aside className="panel glass">
      {cmp && <Compare onClose={() => setCmp(false)} />}
      <div className="stephead"><span className="cap">שלב {i + 1} מתוך {STEPS.length}</span><h2>{cur.name}</h2><p>{cur.hint}</p></div>
      {body}
      <span className="sp" />
      <div className="stepnav">
        {i > 0 && <button className="btn" onClick={() => setStep(STEPS[i - 1].id)}>הקודם</button>}
        {i < STEPS.length - 1 && <button className="btn primary" style={{ flex: 1 }} onClick={() => setStep(STEPS[i + 1].id)}>הבא · {STEPS[i + 1].name}</button>}
      </div>
    </aside>
  );
}

function Inspector() {
  const project = useStore((s) => s.project)!, sel = useStore((s) => s.sel), nest = useStore((s) => s.nest);
  const { patchPiece, patchCutout, remove, apply } = useStore.getState();
  if (!sel) return <div className="note">לחצו על חלק או על פתח בשרטוט כדי לשנות אותו.</div>;
  const card = { background: '#fff', margin: '0 -4px', padding: 12, borderRadius: 16, boxShadow: 'var(--sh1), inset 0 0 0 1px var(--sand2)' };
  if (sel.type === 'piece') {
    const p = project.pieces.find((q) => q.id === sel.id); if (!p) return null;
    const vert = isVertical(p), up = (patch: Partial<Piece>) => patchPiece(p.id, patch);
    const resize = (patch: Partial<Piece>) => apply((pr) => ({ ...pr, pieces: pr.pieces.map((q) => (q.id === p.id ? { ...q, ...patch, outline: undefined } : q.host === p.id && q.side && q.w === (q.side === 'back' || q.side === 'front' ? p.w : p.h) ? { ...q, w: q.side === 'back' || q.side === 'front' ? patch.w ?? p.w : patch.h ?? p.h } : q)) }));
    return (
      <section style={card}>
        <div className="row"><span className="cap">{KIND_HE[p.kind]} · {letter(project.pieces.indexOf(p))}</span><span className="sp" /><button className="btn sm icon danger" title="מחיקה" onClick={() => remove(sel)}><Icon.trash /></button></div>
        <label className="field">שם<input value={p.name} onChange={(e) => patchPiece(p.id, { name: e.target.value }, `nm-${p.id}`)} /></label>
        <div className="grid2"><Num label={vert ? 'אורך' : 'אורך (ימין-שמאל)'} value={p.w} min={30} onChange={(v) => resize({ w: v })} /><Num label={vert ? 'גובה' : 'עומק'} value={p.h} min={30} onChange={(v) => resize({ h: v })} /></div>
        {!vert && <>
          {p.kind === 'counter' && <div className="field"><span>הצד שצמוד לקיר</span><div className="chips">{SIDES.map((s) => <button key={s} className={`chip ${p.wall === s ? 'on' : ''}`} onClick={() => up({ wall: p.wall === s ? undefined : s })}>{SIDE_HE[s]}</button>)}</div></div>}
          <div className="field"><span>קנט בצדדים</span><div className="chips">{SIDES.map((s) => <button key={s} className={`chip ${p.aprons.includes(s) ? 'on' : ''}`} onClick={() => up({ aprons: p.aprons.includes(s) ? p.aprons.filter((x) => x !== s) : [...p.aprons, s] })}>{SIDE_HE[s]}</button>)}</div></div>
        </>}
        {!vert && p.kind === 'counter' && <>
          <div className="field"><span>אם צריך חיבור (חלק מעל אורך הלוח)</span><div className="chips">{([['auto', 'אוטומטי'], ['sink', 'במרכז הכיור'], ['cooktop', 'במרכז הכיריים']] as const).map(([k, v]) => <button key={k} className={`chip ${(p.joint || 'auto') === k ? 'on' : ''}`} onClick={() => up({ joint: k })}>{v}</button>)}</div></div>
          <div className="field"><span>חיבור פינה עם המשטח הסמוך</span><div className="chips">{([['butt', 'ישר'], ['miter', 'גרונג 45°']] as const).map(([k, v]) => <button key={k} className={`chip ${(p.corner || 'butt') === k ? 'on' : ''}`} onClick={() => up({ corner: k })}>{v}</button>)}</div></div>
        </>}
        {!vert && <div className="field"><span>ישיבה (בליטה לכיסאות){Math.min(p.w, p.h) > 800 && !p.seat ? ' · מומלץ מעל 80 ס"מ' : ''}</span><div className="chips"><button className={`chip ${!p.seat ? 'on' : ''}`} onClick={() => up({ seat: undefined, chairs: undefined })}>בלי</button>{SIDES.filter((s) => s !== p.wall).map((s) => <button key={s} className={`chip ${p.seat === s ? 'on' : ''}`} onClick={() => up({ seat: s, chairs: undefined })}>{SIDE_HE[s]}</button>)}</div></div>}
        {!vert && p.seat && <div className="grid2"><Num label="עומק הבליטה" value={p.seatDepth || SEAT_DEPTH} min={150} onChange={(v) => up({ seatDepth: Math.min(600, v) })} /><label className="field"><span>כיסאות<i style={{ fontStyle: 'normal', opacity: 0.7 }}>60 ס"מ לכיסא</i></span><input type="number" min={0} max={12} key={chairCount(p)} defaultValue={chairCount(p)} onBlur={(e) => up({ chairs: Math.max(0, Math.min(12, Math.round(+e.target.value))) })} /></label></div>}
        {(() => { const js = (nest?.joints || []).filter((j) => j.pieceId === p.id).map((j) => j.at); if (!js.length && !p.jointAt?.length) return null; return <div className="field"><span>מיקום החיבורים (ס"מ מתחילת החלק)</span><div className="grid2">{js.map((at, n) => <Num key={n} label={`חיבור ${n + 1}`} value={at} min={30} onChange={(v) => up({ jointAt: js.map((x, i) => (i === n ? Math.min(pieceLen(p) - 30, v) : x)) })} />)}</div><div className="row">{p.jointAt?.length ? <button className="link" style={{ fontSize: 12.5 }} onClick={() => up({ jointAt: undefined })}>חזרה לחיבור אוטומטי</button> : <span className="mute" style={{ fontSize: 12 }}>שינוי המיקום מעדכן מיד את הלוחות למטה.</span>}</div></div>; })()}
        <div className="chips"><button className={`chip ${p.grainLock ? 'on' : ''}`} onClick={() => up({ grainLock: !p.grainLock })}>{p.grainLock ? 'כיוון גיד נעול' : 'גיד חופשי (מותר לסובב)'}</button></div>
        {p.outline && <div className="note">החלק בצורה לא מלבנית (מה-DXF). שינוי מידות יהפוך אותו למלבן.</div>}
      </section>
    );
  }
  const c = project.cutouts.find((q) => q.id === sel.id), host = c && project.pieces.find((q) => q.id === c.pieceId); if (!c || !host) return null;
  const up = (patch: Partial<Cutout>) => patchCutout(c.id, patch), cl = (v: number, max: number) => Math.max(0, Math.min(max, v));
  return (
    <section style={card}>
      <div className="row"><span className="cap">{CUT_HE[c.kind]} · ב{host.name}</span><span className="sp" /><button className="btn sm icon danger" title="מחיקה" onClick={() => remove(sel)}><Icon.trash /></button></div>
      <div className="chips">{(['sink', 'cooktop', 'faucet', 'hole'] as CutoutKind[]).map((k) => <button key={k} className={`chip ${c.kind === k ? 'on' : ''}`} onClick={() => up({ kind: k, round: k === 'faucet' ? true : c.round && k === 'hole' ? true : undefined, mount: k === 'sink' ? 'under' : undefined })}>{CUT_HE[k]}</button>)}</div>
      <label className="field">דגם / תיאור<input value={c.name || ''} placeholder={c.kind === 'sink' ? 'לדוגמה: כיור בלנקו 76' : ''} onChange={(e) => patchCutout(c.id, { name: e.target.value }, `cn-${c.id}`)} /></label>
      <div className="grid2">
        <Num label={c.round ? 'קוטר' : 'רוחב הפתח'} value={c.w} min={10} onChange={(v) => up(c.round ? { w: v, h: v } : { w: Math.min(v, host.w - c.x) })} />
        {!c.round && <Num label="עומק הפתח" value={c.h} min={10} onChange={(v) => up({ h: Math.min(v, host.h - c.y) })} />}
        <Num label="מרחק משמאל" value={c.x} onChange={(v) => up({ x: cl(v, host.w - c.w) })} /><Num label="מרחק מהגב" value={c.y} onChange={(v) => up({ y: cl(v, host.h - c.h) })} />
      </div>
      {c.kind === 'sink' && <>
        <div className="field"><span>סוג הכיור</span><div className="seg"><button className={!c.built ? 'on' : ''} onClick={() => up({ built: false })}>כיור קנוי</button><button className={c.built ? 'on' : ''} onClick={() => up({ built: true, mount: 'under' })}>בנוי מאבן</button></div></div>
        <div className="field"><span>רוחב ארון הכיור</span><div className="chips">{[600, 700, 800, 900].map((w) => <button key={w} className={`chip ${c.cabinet === w ? 'on' : ''}`} onClick={() => { const n = sinkNet(w, !!c.built, project.thickness), nw = Math.min(n.w, host.w - 120); up({ cabinet: w, w: nw, h: Math.min(n.h, host.h - 100), x: cl(c.x + (c.w - nw) / 2, host.w - nw) }); }}>{w / 10}</button>)}</div></div>
        <div className="field"><span>קערות</span><div className="chips">{([['single', 'אחת'], ['even', 'כפול חצי־חצי'], ['ls', 'כפול גדול + קטן']] as const).map(([k, v]) => <button key={k} className={`chip ${(c.bowls || 'single') === k ? 'on' : ''}`} onClick={() => up({ bowls: k })}>{v}</button>)}</div></div>
        {c.built && <div className="chips"><button className={`chip ${c.drainCover ? 'on' : ''}`} onClick={() => up({ drainCover: !c.drainCover })}>ונטיל מאבן (מכסה ניקוז)</button><button className="chip" onClick={() => dispatchEvent(new CustomEvent('bs-focus-sink', { detail: c.id }))}>זום לכיור בהדמיה</button></div>}
        <div className="note">נטו משוער: <span className="mono">{cm(c.w)}×{cm(c.h)}</span> ס"מ{c.bowls === 'even' ? ` · כל קערה כ-${cm((c.w - 14) / 2)}` : c.bowls === 'ls' ? ` · כ-${cm(c.w * 0.6 - 7)} + ${cm(c.w * 0.4 - 7)}` : ''}{c.cabinet ? ` · ארון ${c.cabinet / 10}` : ''}. {c.built ? 'כיור בנוי בהתקנה תחתונה: ארבע דפנות ותחתית נחתכות מהלוח ונכנסות לנסטינג.' : 'פלוס־מינוס, תלוי בדגם הכיור.'}</div>
      </>}
      {c.kind === 'faucet' && <div className="mute" style={{ fontSize: 12.5 }}>בשדה "דגם" אפשר לרשום את הברז (למשל ברז מערכת מים 3 דרכים).</div>}
      {c.kind === 'sink' && <div className="field"><span>התקנה</span><div className="seg">{([['under', 'תחתונה'], ['flush', 'שטוחה'], ['top', 'עליונה']] as const).map(([k, v]) => <button key={k} className={c.mount === k ? 'on' : ''} onClick={() => up({ mount: k })}>{v}</button>)}</div></div>}
    </section>
  );
}

const QUICK = ['מטבח L 3.2 על 2.4 מטר', 'תוסיף אי של 2 מטר', 'ישיבה עם 3 כיסאות', 'כיור בנוי עם ונטיל', 'צוקל מאבן', 'תאורת ערב'];

export function RightPanel({ onClose }: { onClose?: () => void }) {
  const project = useStore((s) => s.project)!, nest = useStore((s) => s.nest), issues = useStore((s) => s.issues), chat = useStore((s) => s.chat);
  const { apply, select, setToast, say } = useStore.getState();
  const [text, setText] = useState(''), [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { log.current?.scrollTo({ top: 1e6 }); }, [chat.length, busy]);
  const facts = () => ({ slabs: nest?.metrics.slabs, utilization: nest?.metrics.utilization, joints: nest?.joints, perSlab: nest?.slabs.map((s) => s.used), slab: [project.slabW, project.slabH], issues: issues.map((i) => ({ level: i.level, title: i.title, detail: i.detail })) });

  async function send(raw: string, advise = false) {
    const t = raw.trim(); if ((!t && !advise) || busy) return;
    const history = useStore.getState().chat;
    say({ role: 'user', text: advise ? 'חוות דעת מקצועית על המטבח' : t }); setText(''); setBusy(true);
    try {
      if (isLocal) { const r = advise ? { reply: 'חוות דעת מקצועית פועלת באתר המחובר. בינתיים הבודק החכם למטה מציג את כל הממצאים.' } : localAssist(project, t); if ('project' in r && r.project) apply(() => r.project!); say({ role: 'ai', text: r.reply }); }
      else {
        const r = advise ? await ai.advise(project, facts()) : await ai.chat(project, t, history, facts());
        if (r.draft && !advise) { apply((p) => applyDraft(p, r.draft!)); setToast('השינוי בוצע · אפשר לבטל עם Ctrl+Z'); }
        say({ role: 'ai', text: [r.reply, ...(r.assumptions || []).map((a) => `• ${a}`)].filter(Boolean).join('\n') });
      }
    } catch (e) { say({ role: 'ai', text: `לא הצלחתי: ${(e as Error).message}` }); }
    setBusy(false);
  }

  return (
    <aside className="panel glass right">
      {onClose && <button className="grab" aria-label="סגירה" onClick={onClose}><i /></button>}
      <section className="ai">
        <div className="row"><span className="spark"><Icon.spark /></span><b style={{ fontWeight: 600 }}>העוזר</b><span className="sp" /><button className="link" style={{ fontSize: 12.5 }} disabled={busy} onClick={() => send('', true)}>חוות דעת מקצועית</button></div>
        <div className="chatlog" ref={log}>
          {!chat.length && <div className="mute" style={{ fontSize: 13 }}>אפשר לשאול, לבקש שינוי או להזיז דברים — בשפה רגילה.</div>}
          {chat.map((m, n) => <div key={n} className={`bubble ${m.role}`}>{m.text}</div>)}
          {busy && <div className="bubble ai"><span className="spin dark" /></div>}
        </div>
        {!chat.length && <div className="chips">{QUICK.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}</div>}
        <div className="chatin"><textarea rows={1} value={text} placeholder="כתבו כאן, למשל: מטבח ישר 3.5 מטר עם אי…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }} /><button className="btn sm primary icon" title="שליחה" disabled={busy || !text.trim()} onClick={() => send(text)}><Icon.back /></button></div>
      </section>
      <section>
        <div className="row"><span className="cap">בודק חכם</span><span className="sp" />{issues.some((i) => i.level === 'error') ? <span className="badge err">{issues.filter((i) => i.level === 'error').length} שגיאות</span> : issues.some((i) => i.level === 'warn') ? <span className="badge warn">{issues.filter((i) => i.level === 'warn').length} אזהרות</span> : <span className="badge ok">תקין</span>}</div>
        {!issues.length && <div className="issue" style={{ borderColor: 'var(--cut)' }}><b>הכול נראה טוב</b><p>אין חריגות, והחלקים משובצים בלוחות.</p></div>}
        {issues.map((i) => (
          <div key={i.id} className={`issue ${i.level}`} onClick={() => (i.cutoutId ? select({ type: 'cutout', id: i.cutoutId }) : i.pieceId && select({ type: 'piece', id: i.pieceId }))}>
            <b>{i.level === 'tip' ? '💡 ' : ''}{i.title}</b><p>{i.detail}</p>
            {i.fix && <div><button className="btn sm" onClick={(e) => { e.stopPropagation(); apply(i.fix!.apply); setToast('תוקן · אפשר לבטל עם Ctrl+Z'); }}><Icon.check />{i.fix.label}</button></div>}
          </div>
        ))}
      </section>
    </aside>
  );
}
