// הפאנלים של הסטודיו: מבנה ההזמנה והחלקים (ימין), בדיקה ו-AI (שמאל).
import { useState } from 'react';
import { CUT_HE, Cutout, CutoutKind, KIND_HE, Piece, Project, SIDE_HE, Side, bounds, isVertical, letter, piece as mkPiece, uid } from '../core/model';
import { OrderStatus, STATUS_HE } from '../data/repo';
import { ai, applyDraft } from '../ai';
import { useStore } from '../store';
import { FLOOR_HE } from './scene';
import { Icon } from './icons';
import { cm, m2, parseCm, useStone } from './util';

const SIDES: Side[] = ['back', 'front', 'left', 'right'];

function Num({ label, value, onChange, unit = 'ס"מ', mm, min = 0 }: { label: string; value: number; onChange: (mm: number) => void; unit?: string; mm?: boolean; min?: number }) {
  const shown = mm ? String(value) : cm(value);
  return (
    <label className="field"><span>{label}<i style={{ fontStyle: 'normal', opacity: 0.7 }}>{unit}</i></span>
      <input type="number" step={mm ? 1 : 0.1} key={shown} defaultValue={shown} onBlur={(e) => { const v = mm ? Math.round(+e.target.value) : parseCm(e.target.value); if (v != null && Number.isFinite(v) && v !== value) onChange(Math.max(min, v)); }} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
    </label>
  );
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
  st.apply((pr) => ({ ...pr, pieces: [...pr.pieces, ...fresh.map((s) => mkPiece({ kind, name: kind === 'splash' ? 'חיפוי קיר' : `מפל · ${SIDE_HE[s]}`, w: s === 'back' || s === 'front' ? host.w : host.h, h: kind === 'splash' ? 600 : pr.counterH - pr.thickness, host: host.id, side: s }))] }));
}
function addCutout(kind: CutoutKind) {
  const st = useStore.getState(), p = st.project!, sel = st.sel?.type === 'piece' ? p.pieces.find((q) => q.id === st.sel!.id) : undefined;
  const host = sel && !isVertical(sel) ? sel : flatOf(p)[0]; if (!host) return st.setToast('קודם מוסיפים משטח');
  const [w, h] = kind === 'sink' ? [760, 400] : kind === 'cooktop' ? [560, 490] : kind === 'faucet' ? [35, 35] : [100, 100];
  const sink = p.cutouts.find((c) => c.pieceId === host.id && c.kind === 'sink');
  const used = p.cutouts.filter((c) => c.pieceId === host.id && c.kind !== 'faucet');
  let x = (host.w - w) / 2, y = (host.h - h) / 2;
  if (kind === 'faucet' && sink) { x = sink.x + sink.w / 2 - 17.5; y = Math.max(25, sink.y / 2 - 17.5); }
  else if (host.w >= host.h) { const cand = [host.w * 0.25, host.w * 0.72, host.w * 0.5].map((c) => c - w / 2); x = cand.find((cx) => !used.some((u) => cx < u.x + u.w + 300 && u.x < cx + w + 300)) ?? cand[0]; }
  const c: Cutout = { id: uid('c'), pieceId: host.id, kind, x: Math.round(Math.max(0, Math.min(host.w - w, x))), y: Math.round(Math.max(0, Math.min(host.h - h, y))), w: Math.min(w, host.w), h: Math.min(h, host.h), round: kind === 'faucet' || undefined, mount: kind === 'sink' ? 'under' : undefined };
  st.apply((pr) => ({ ...pr, cutouts: [...pr.cutouts, c] })); st.select({ type: 'cutout', id: c.id });
}

export function LeftPanel() {
  const project = useStore((s) => s.project)!, order = useStore((s) => s.order)!, sel = useStore((s) => s.sel), stones = useStore((s) => s.stones);
  const { apply, select, patchOrder } = useStore.getState();
  const stone = useStone(), set = (patch: Partial<Project>, key?: string) => apply((p) => ({ ...p, ...patch }), key);
  const flat = project.pieces.filter((p) => !isVertical(p));
  return (
    <aside className="panel glass">
      <Inspector />
      <section>
        <span className="cap">הזמנה</span>
        <label className="field">שם<input value={order.title} onChange={(e) => patchOrder({ title: e.target.value })} /></label>
        <div className="grid2">
          <label className="field">מס׳ הזמנה<input dir="ltr" value={order.order_no || ''} onChange={(e) => patchOrder({ order_no: e.target.value })} /></label>
          <label className="field">סטטוס<select value={order.status} onChange={(e) => patchOrder({ status: e.target.value as OrderStatus })}>{Object.entries(STATUS_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
      </section>
      <section>
        <span className="cap">אבן</span>
        <select className="input" value={String(stone.id)} onChange={(e) => { const s = stones.find((x) => String(x.id) === e.target.value); set({ stoneId: s ? s.id : null }); }}>{stones.map((s) => <option key={s.id} value={String(s.id)}>{s.name}{s.slab ? '' : ' (אריח)'}</option>)}</select>
        <div style={{ height: 62, borderRadius: 12, background: `#ddd url("${stone.url}") center/cover`, boxShadow: 'inset 0 0 0 .5px rgba(0,0,0,.2)' }} />
        <div className="grid2">
          <Num label="עובי" unit='מ"מ' mm value={project.thickness} min={6} onChange={(v) => set({ thickness: v })} />
          <Num label="גובה קנט" unit='מ"מ' mm value={project.apronH} onChange={(v) => set({ apronH: v })} />
          <Num label="אורך לוח" value={project.slabW} min={500} onChange={(v) => set({ slabW: v })} />
          <Num label="רוחב לוח" value={project.slabH} min={500} onChange={(v) => set({ slabH: v })} />
        </div>
      </section>
      <section>
        <div className="row"><span className="cap">חלקים</span><span className="sp" /><span className="mute mono" style={{ fontSize: 12 }}>{project.pieces.length}</span></div>
        <div className="plist">
          {flat.map((p) => [p, ...project.pieces.filter((q) => q.host === p.id)]).flat().concat(project.pieces.filter((q) => isVertical(q) && !flat.some((f) => f.id === q.host))).map((p) => (
            <button key={p.id} className={`pitem ${sel?.type === 'piece' && sel.id === p.id ? 'on' : ''}`} style={isVertical(p) ? { paddingInlineStart: 22 } : undefined} onClick={() => select({ type: 'piece', id: p.id })}>
              <i className={isVertical(p) ? 'sub' : ''}>{letter(project.pieces.indexOf(p))}</i><span>{p.name}</span><em>{cm(p.w)}×{cm(p.h)}</em>
            </button>
          ))}
        </div>
        <div className="chips">
          <button className="chip" onClick={() => addPiece('counter')}>+ משטח</button><button className="chip" onClick={() => addPiece('island')}>+ אי</button>
          <button className="chip" onClick={() => addVertical('splash')}>+ חיפוי</button><button className="chip" onClick={() => addVertical('waterfall')}>+ מפל</button>
          <button className="chip" onClick={() => addCutout('sink')}>+ כיור</button><button className="chip" onClick={() => addCutout('cooktop')}>+ כיריים</button><button className="chip" onClick={() => addCutout('faucet')}>+ ברז</button>
        </div>
      </section>
      <section>
        <span className="cap">סביבה בהדמיה</span>
        <div className="chips">
          <button className={`chip ${project.cabinets ? 'on' : ''}`} onClick={() => set({ cabinets: !project.cabinets })}>ארונות תחתונים</button>
          <button className={`chip ${project.uppers ? 'on' : ''}`} onClick={() => set({ uppers: !project.uppers })}>ארונות עליונים</button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {['#f2efe9', '#e4dccd', '#c9b79a', '#8c6f52', '#7d8b74', '#4d5a66', '#2c3440', '#1e1d1c'].map((c) => <button key={c} title="צבע ארונות" onClick={() => set({ cabinetColor: c })} style={{ width: 24, height: 24, borderRadius: '50%', border: 0, cursor: 'pointer', background: c, boxShadow: project.cabinetColor === c ? '0 0 0 2px #fff, 0 0 0 3.5px var(--ink)' : 'inset 0 0 0 .5px rgba(0,0,0,.25)' }} />)}
        </div>
        <label className="field">ריצוף<select value={project.floor} onChange={(e) => set({ floor: e.target.value })}>{Object.entries(FLOOR_HE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </section>
    </aside>
  );
}

function Inspector() {
  const project = useStore((s) => s.project)!, sel = useStore((s) => s.sel);
  const { patchPiece, patchCutout, remove, apply } = useStore.getState();
  if (!sel) return null;
  if (sel.type === 'piece') {
    const p = project.pieces.find((q) => q.id === sel.id); if (!p) return null;
    const vert = isVertical(p), up = (patch: Partial<Piece>) => patchPiece(p.id, patch);
    const resize = (patch: Partial<Piece>) => apply((pr) => ({ ...pr, pieces: pr.pieces.map((q) => (q.id === p.id ? { ...q, ...patch, outline: undefined } : q.host === p.id && q.side && q.w === (q.side === 'back' || q.side === 'front' ? p.w : p.h) ? { ...q, w: q.side === 'back' || q.side === 'front' ? patch.w ?? p.w : patch.h ?? p.h } : q)) }));
    return (
      <section style={{ background: '#fff', margin: '0 -4px', padding: 12, borderRadius: 16, boxShadow: 'var(--sh1), inset 0 0 0 1px var(--sand2)' }}>
        <div className="row"><span className="cap">{KIND_HE[p.kind]} · {letter(project.pieces.indexOf(p))}</span><span className="sp" /><button className="btn sm icon danger" title="מחיקה" onClick={() => remove(sel)}><Icon.trash /></button></div>
        <label className="field">שם<input value={p.name} onChange={(e) => patchPiece(p.id, { name: e.target.value }, `nm-${p.id}`)} /></label>
        <div className="grid2"><Num label={vert ? 'אורך' : 'אורך (ימין-שמאל)'} value={p.w} min={30} onChange={(v) => resize({ w: v })} /><Num label={vert ? 'גובה' : 'עומק'} value={p.h} min={30} onChange={(v) => resize({ h: v })} /></div>
        {!vert && <>
          {p.kind === 'counter' && <div className="field"><span>הצד שצמוד לקיר</span><div className="chips">{SIDES.map((s) => <button key={s} className={`chip ${p.wall === s ? 'on' : ''}`} onClick={() => up({ wall: p.wall === s ? undefined : s })}>{SIDE_HE[s]}</button>)}</div></div>}
          <div className="field"><span>קנט בצדדים</span><div className="chips">{SIDES.map((s) => <button key={s} className={`chip ${p.aprons.includes(s) ? 'on' : ''}`} onClick={() => up({ aprons: p.aprons.includes(s) ? p.aprons.filter((x) => x !== s) : [...p.aprons, s] })}>{SIDE_HE[s]}</button>)}</div></div>
        </>}
        <div className="chips"><button className={`chip ${p.grainLock ? 'on' : ''}`} onClick={() => up({ grainLock: !p.grainLock })}><span className="row" style={{ gap: 5 }}>{p.grainLock ? 'כיוון גיד נעול' : 'גיד חופשי (מותר לסובב)'}</span></button></div>
        {p.outline && <div className="note">החלק בצורה לא מלבנית (מה-DXF). שינוי מידות יהפוך אותו למלבן.</div>}
      </section>
    );
  }
  const c = project.cutouts.find((q) => q.id === sel.id), host = c && project.pieces.find((q) => q.id === c.pieceId); if (!c || !host) return null;
  const up = (patch: Partial<Cutout>) => patchCutout(c.id, patch), cl = (v: number, max: number) => Math.max(0, Math.min(max, v));
  return (
    <section style={{ background: '#fff', margin: '0 -4px', padding: 12, borderRadius: 16, boxShadow: 'var(--sh1), inset 0 0 0 1px var(--sand2)' }}>
      <div className="row"><span className="cap">{CUT_HE[c.kind]} · ב{host.name}</span><span className="sp" /><button className="btn sm icon danger" title="מחיקה" onClick={() => remove(sel)}><Icon.trash /></button></div>
      <div className="chips">{(['sink', 'cooktop', 'faucet', 'hole'] as CutoutKind[]).map((k) => <button key={k} className={`chip ${c.kind === k ? 'on' : ''}`} onClick={() => up({ kind: k, round: k === 'faucet' ? true : c.round && k === 'hole' ? true : undefined, mount: k === 'sink' ? 'under' : undefined })}>{CUT_HE[k]}</button>)}</div>
      <label className="field">דגם / תיאור<input value={c.name || ''} placeholder={c.kind === 'sink' ? 'לדוגמה: כיור בלנקו 76' : ''} onChange={(e) => patchCutout(c.id, { name: e.target.value }, `cn-${c.id}`)} /></label>
      <div className="grid2">
        <Num label={c.round ? 'קוטר' : 'רוחב הפתח'} value={c.w} min={10} onChange={(v) => up(c.round ? { w: v, h: v } : { w: Math.min(v, host.w - c.x) })} />
        {!c.round && <Num label="עומק הפתח" value={c.h} min={10} onChange={(v) => up({ h: Math.min(v, host.h - c.y) })} />}
        <Num label="מרחק משמאל" value={c.x} onChange={(v) => up({ x: cl(v, host.w - c.w) })} /><Num label="מרחק מהגב" value={c.y} onChange={(v) => up({ y: cl(v, host.h - c.h) })} />
      </div>
      {c.kind === 'sink' && <div className="field"><span>התקנה</span><div className="seg">{([['under', 'תחתונה'], ['flush', 'שטוחה'], ['top', 'עליונה']] as const).map(([k, v]) => <button key={k} className={c.mount === k ? 'on' : ''} onClick={() => up({ mount: k })}>{v}</button>)}</div></div>}
    </section>
  );
}

export function RightPanel() {
  const project = useStore((s) => s.project)!, nest = useStore((s) => s.nest), issues = useStore((s) => s.issues);
  const { apply, select, setToast } = useStore.getState();
  const [text, setText] = useState(''), [busy, setBusy] = useState<'' | 'edit' | 'advise'>(''), [reply, setReply] = useState('');
  const m = nest?.metrics;

  async function run(mode: 'edit' | 'advise') {
    if (mode === 'edit' && !text.trim()) return;
    setBusy(mode); setReply('');
    try {
      const r = mode === 'edit' ? await ai.edit(project, text.trim()) : await ai.advise(project, { slabs: m?.slabs, utilization: m?.utilization, joints: nest?.joints, perSlab: nest?.slabs.map((s) => s.used), slab: [project.slabW, project.slabH], issues: issues.map((i) => ({ level: i.level, title: i.title, detail: i.detail })) });
      if (r.draft && mode === 'edit') { apply((p) => applyDraft(p, r.draft!)); setText(''); setToast('השינוי בוצע · אפשר לבטל עם Ctrl+Z'); }
      setReply([r.reply, ...(r.assumptions || []).map((a) => `• ${a}`)].filter(Boolean).join('\n'));
    } catch (e) { setReply(`לא הצלחתי: ${(e as Error).message}`); }
    setBusy('');
  }

  return (
    <aside className="panel glass right">
      <section>
        <span className="cap">סיכום</span>
        <div className="metrics">
          <div className="metric"><small>לוחות</small><b>{m?.slabs ?? 0}</b></div><div className="metric"><small>ניצולת</small><b>{m?.utilization ?? 0}%</b></div>
          <div className="metric"><small>שטח חלקים · מ"ר</small><b>{m2(m?.pieceArea || 0)}</b></div><div className="metric"><small>קנט · מטר</small><b>{((m?.apronLen || 0) / 1000).toFixed(2)}</b></div>
        </div>
      </section>
      <section className="ai">
        <div className="row"><span className="spark"><Icon.spark /></span><b style={{ fontWeight: 600 }}>עריכה בשפה חופשית</b></div>
        <textarea value={text} placeholder={'כתבו מה לשנות, למשל:\n"תוסיף אי של 2 מטר עם מפל ותזיז את הכיור 20 ס"מ שמאלה"'} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run('edit'); }} />
        <div className="row"><button className="btn sm primary" disabled={!!busy || !text.trim()} onClick={() => run('edit')}>{busy === 'edit' ? <><span className="spin" />חושב…</> : 'בצע'}</button>
          <button className="btn sm" disabled={!!busy} onClick={() => run('advise')}>{busy === 'advise' ? <><span className="spin dark" />בודק…</> : 'חוות דעת מקצועית'}</button></div>
        {reply && <div className="reply">{reply}</div>}
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
      {project.notes && <section><span className="cap">הערות מהזיהוי</span><div className="note" style={{ whiteSpace: 'pre-wrap' }}>{project.notes}</div></section>}
    </aside>
  );
}
