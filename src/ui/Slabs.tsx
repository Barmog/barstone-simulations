// תצוגת הנסטינג: כל לוח עם תמונת האבן האמיתית, החלקים שנחתכים ממנו ופסי הקנט.
// אפשר לגרור חלק על הלוח, לסובב אותו ולהעביר אותו ללוח אחר — שאר החלקים מסתדרים סביבו.
import { useRef, useState } from 'react';
import { letter } from '../core/model';
import { Placement } from '../core/nesting';
import { useStore } from '../store';
import { useStone } from './util';

export function Slabs({ readOnly }: { readOnly?: boolean }) {
  const project = useStore((s) => s.project)!, nest = useStore((s) => s.nest), sel = useStore((s) => s.sel), select = useStore((s) => s.select), apply = useStore((s) => s.apply);
  const stone = useStone();
  const [pick, setPick] = useState<string | null>(null), [drag, setDrag] = useState<{ key: string; dx: number; dy: number } | null>(null);
  const start = useRef<{ key: string; sx: number; sy: number; k: number; pl: Placement; moved: boolean } | null>(null);
  if (!nest?.slabs.length) return <div className="view"><div className="empty" style={{ padding: 30 }}>הלוחות יופיעו כאן אחרי שיהיו חלקים</div></div>;
  const idx = new Map(project.pieces.map((p, i) => [p.id, i])), byId = new Map(project.pieces.map((p) => [p.id, p]));
  const all = nest.slabs.flatMap((s) => s.placements), cur = all.find((p) => p.key === pick), bad = new Set(nest.overlaps), manual = project.manual || {};
  const canRot = (pl: Placement) => !!pl.extra || !!pl.stripOf || !byId.get(pl.pieceId)?.grainLock;
  const put = (pl: Placement, patch: Partial<{ slab: number; x: number; y: number; rot: boolean }>) => apply((p) => ({ ...p, manual: { ...(p.manual || {}), [pl.key]: { slab: pl.slab, x: pl.block.x, y: pl.block.y, rot: pl.rot, ...patch } } }), `nest-${pl.key}`);
  const free = (key?: string) => apply((p) => { if (!key) return { ...p, manual: undefined }; const m = { ...(p.manual || {}) }; delete m[key]; return { ...p, manual: Object.keys(m).length ? m : undefined }; });
  // הצמדה: לרשת של ס"מ, לשולי הלוח ולקצוות של חלקים אחרים (עם מרווח מסור)
  const snap = (pl: Placement, x: number, y: number) => {
    const s = nest.slabs[pl.slab], m = project.margin, kf = project.kerf, tx = [m, s.w - m - pl.block.w], ty = [m, s.h - m - pl.block.h];
    for (const o of s.placements) if (o.key !== pl.key) { tx.push(o.block.x + o.block.w + kf, o.block.x - kf - pl.block.w, o.block.x); ty.push(o.block.y + o.block.h + kf, o.block.y - kf - pl.block.h, o.block.y); }
    const near = (v: number, t: number[]) => { const h = t.find((q) => Math.abs(q - v) < 28); return h ?? Math.round(v / 10) * 10; };
    return { x: Math.max(0, Math.min(s.w - pl.block.w, near(x, tx))), y: Math.max(0, Math.min(s.h - pl.block.h, near(y, ty))) };
  };
  return (
    <div className="view">
      {!readOnly && <div className="slabbar">
        {cur ? <div className="pill">
          <button disabled={!canRot(cur)} style={{ opacity: canRot(cur) ? 1 : 0.35 }} title={canRot(cur) ? 'סיבוב ב-90°' : 'כיוון הגיד נעול'} onClick={() => put(cur, { rot: !cur.rot })}>סיבוב</button>
          <button disabled={cur.slab === 0} style={{ opacity: cur.slab ? 1 : 0.35 }} onClick={() => put(cur, { slab: cur.slab - 1 })}>ללוח הקודם</button>
          <button onClick={() => put(cur, { slab: cur.slab + 1 })}>ללוח הבא</button>
          {manual[cur.key] && <button onClick={() => free(cur.key)}>שחרר</button>}
        </div> : <span className="badge">גררו חלק כדי לסדר אותו על הלוח</span>}
        {Object.keys(manual).length > 0 && <div className="pill"><button onClick={() => { free(); setPick(null); }}>סידור אוטומטי</button></div>}
      </div>}
      <div className="slabs" style={readOnly ? undefined : { paddingTop: 44 }}>
        {nest.slabs.map((s, i) => (
          <div className="slab" key={i}>
            <svg viewBox={`0 0 ${s.w} ${s.h}`} preserveAspectRatio="xMidYMid meet" className={drag ? 'drag' : ''} style={{ touchAction: readOnly ? undefined : 'none' }}
              onPointerMove={(e) => { const st = start.current; if (!st) return; const dx = (e.clientX - st.sx) * st.k, dy = (e.clientY - st.sy) * st.k; if (!st.moved && Math.hypot(dx, dy) < 12) return; st.moved = true; const q = snap(st.pl, st.pl.block.x + dx, st.pl.block.y + dy); setDrag({ key: st.key, dx: q.x - st.pl.block.x, dy: q.y - st.pl.block.y }); }}
              onPointerUp={() => { const st = start.current; start.current = null; if (st?.moved && drag) put(st.pl, { x: st.pl.block.x + drag.dx, y: st.pl.block.y + drag.dy }); setDrag(null); }}
              onPointerCancel={() => { start.current = null; setDrag(null); }}>
              <defs><mask id={`m${i}`}><rect width={s.w} height={s.h} fill="#fff" />{s.placements.map((p, n) => <g key={n}><rect {...p.body} width={p.body.w} height={p.body.h} fill="#000" />{p.strips.map((st, m) => <rect key={m} x={st.rect.x} y={st.rect.y} width={st.rect.w} height={st.rect.h} fill="#000" />)}</g>)}</mask></defs>
              <image href={stone.url} width={s.w} height={s.h} preserveAspectRatio="none" transform={project.bookmatch === 'yes' && i % 2 ? `translate(${s.w},0) scale(-1,1)` : undefined} />
              <rect width={s.w} height={s.h} fill="rgba(245,241,234,.62)" mask={`url(#m${i})`} />
              {s.placements.map((p) => {
                const on = pick === p.key || (!pick && sel?.type === 'piece' && sel.id === p.pieceId), pi = idx.get(p.pieceId) ?? 0, small = Math.min(p.body.w, p.body.h) < 240, d = drag?.key === p.key ? drag : null, err = bad.has(p.key);
                return (
                  <g key={p.key} className={readOnly ? undefined : 'pl'} transform={d ? `translate(${d.dx},${d.dy})` : undefined} opacity={d ? 0.85 : 1}
                    onPointerDown={readOnly ? undefined : (e) => { const svg = e.currentTarget.ownerSVGElement!; svg.setPointerCapture(e.pointerId); start.current = { key: p.key, sx: e.clientX, sy: e.clientY, k: s.w / svg.getBoundingClientRect().width, pl: p, moved: false }; setPick(p.key); select({ type: 'piece', id: p.pieceId }); }}>
                    <rect x={p.body.x} y={p.body.y} width={p.body.w} height={p.body.h} fill={err ? 'rgba(229,72,77,.3)' : on ? 'rgba(180,155,116,.22)' : 'transparent'} stroke={err ? '#E5484D' : on ? '#B49B74' : p.stripOf ? '#E0428F' : p.extra ? '#5B7FD6' : '#1f8f5a'} strokeWidth={on || err ? 14 : 7} />
                    {p.strips.map((st, m) => <rect key={m} x={st.rect.x} y={st.rect.y} width={st.rect.w} height={st.rect.h} fill="rgba(224,66,143,.16)" stroke="#E0428F" strokeWidth={5} />)}
                    {manual[p.key] && <circle cx={p.body.x + 36} cy={p.body.y + 36} r={16} fill="#B49B74" stroke="#fff" strokeWidth={6} />}
                    {!small && <g style={{ direction: 'ltr' }} textAnchor="middle" pointerEvents="none">
                      <rect x={p.body.x + p.body.w / 2 - 85} y={p.body.y + p.body.h / 2 - 80} width={170} height={112} rx={30} fill="#1B1A18" />
                      <text x={p.body.x + p.body.w / 2} y={p.body.y + p.body.h / 2 + 4} fontSize={82} fontWeight="600" fill="#fff" fontFamily="var(--mono)">{p.extra ? (p.extra === 'צוקל' ? 'צ' : 'כ') : letter(pi)}{p.segs > 1 ? p.seg + 1 : ''}</text>
                      <text x={p.body.x + p.body.w / 2} y={p.body.y + p.body.h / 2 + 112} fontSize={66} fill="#1B1A18" stroke="rgba(255,255,255,.85)" strokeWidth={16} paintOrder="stroke" fontFamily="var(--mono)">{p.body.w / 10}×{p.body.h / 10}</text>
                    </g>}
                  </g>
                );
              })}
            </svg>
            <div className="lbl"><span>לוח {i + 1}{project.bookmatch === 'yes' ? (i % 2 ? ' · B (מראה)' : ' · A') : ''} · <span className="mono">{s.w / 10}×{s.h / 10}</span></span><b className="mono">{s.used}%</b></div>
          </div>
        ))}
      </div>
    </div>
  );
}
