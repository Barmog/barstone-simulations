// עורך התוכנית: מבט על חי. גרירת חלקים ופתחים, ידיות לשינוי מידות, מידות שנערכות ישירות על השרטוט.
import { PointerEvent as RPE, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CUT_HE, Cutout, Piece, Project, Side, bounds, corners, hostEdge, isVertical, letter, longIsX } from '../core/model';
import { isBody, segLocal, slabToLocalMatrix } from '../core/nesting';
import { useStore } from '../store';
import { Icon } from './icons';
import { cm, parseCm, useStone } from './util';

interface View { x: number; y: number; w: number }
type Drag =
  | { kind: 'pan'; sx: number; sy: number; v: View }
  | { kind: 'piece'; id: string; mx: number; my: number; ox: number; oy: number; moved: boolean }
  | { kind: 'cut'; id: string; mx: number; my: number; ox: number; oy: number }
  | { kind: 'resize'; id: string; side: Side; mx: number; my: number; o: Piece };
interface Dim { x1: number; y1: number; x2: number; y2: number; value: number; off: number; set?: (mm: number) => void }

const path = (p: Piece) => (p.outline ? `M${p.outline.map((q) => `${q.x},${q.y}`).join('L')}Z` : `M0,0H${p.w}V${p.h}H0Z`);

/** שינוי מידות חלק, כולל עדכון חיפוי/מפל צמודים שאורכם היה שווה לצלע. */
function resized(pr: Project, id: string, patch: Partial<Piece>): Project {
  const old = pr.pieces.find((q) => q.id === id); if (!old) return pr;
  const nu = { ...old, ...patch, outline: (patch.w ?? old.w) !== old.w || (patch.h ?? old.h) !== old.h ? undefined : old.outline };
  const len = (q: Piece, s: Side) => (s === 'back' || s === 'front' ? q.w : q.h);
  return { ...pr, pieces: pr.pieces.map((q) => (q.id === id ? nu : q.host === id && q.side && q.w === len(old, q.side) ? { ...q, w: len(nu, q.side) } : q)) };
}

export function Plan2D() {
  const project = useStore((s) => s.project)!, nest = useStore((s) => s.nest), sel = useStore((s) => s.sel), issues = useStore((s) => s.issues);
  const { select, patchPiece, patchCutout, apply, remove } = useStore.getState();
  const stone = useStone();
  const wrap = useRef<HTMLDivElement>(null), svg = useRef<SVGSVGElement>(null), drag = useRef<Drag | null>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [view, setView] = useState<View | null>(null);
  const [edit, setEdit] = useState<{ px: number; py: number; text: string; set: (mm: number) => void } | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current!; const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 800, h: el.clientHeight || 500 }));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const fit = () => {
    const b = bounds(project), pad = 520, ar = size.w / size.h;
    let w = b.w + 2 * pad, h = b.h + 2 * pad; if (w / h < ar) w = h * ar; else h = w / ar;
    setView({ x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w });
  };
  useEffect(() => { if (size.w > 50) fit(); }, [size.w, size.h, project.pieces.length === 0]);

  const v = view || { x: -500, y: -500, w: 5000 }, k = v.w / size.w, vh = k * size.h;
  const flat = project.pieces.filter((p) => !isVertical(p)), byId = useMemo(() => new Map(project.pieces.map((p) => [p.id, p])), [project.pieces]);
  const bad = useMemo(() => new Set(issues.filter((i) => i.level !== 'tip' && i.cutoutId).map((i) => i.cutoutId)), [issues]);
  const toMm = (e: { clientX: number; clientY: number }) => { const r = svg.current!.getBoundingClientRect(); return { x: v.x + (e.clientX - r.left) * k, y: v.y + (e.clientY - r.top) * k }; };
  const snap = (val: number, targets: number[], step = 10) => { const t = targets.find((t) => Math.abs(t - val) < 9 * k); return t ?? Math.round(val / step) * step; };

  function down(e: RPE, d: Drag) { e.stopPropagation(); svg.current!.setPointerCapture(e.pointerId); drag.current = d; setEdit(null); }
  // צביטה בשתי אצבעות = זום (טלפון וטאבלט)
  const pts = useRef(new Map<number, { x: number; y: number }>()), pinch = useRef<{ d: number; v: View; mx: number; my: number } | null>(null);
  const spread = () => { const [a, b] = [...pts.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  function touchDown(e: RPE) {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size !== 2) return;
    const [a, b] = [...pts.current.values()], m = toMm({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
    drag.current = null; pinch.current = { d: spread(), v, mx: m.x, my: m.y };
  }
  function touchUp(e: RPE) { pts.current.delete(e.pointerId); if (pts.current.size < 2) pinch.current = null; }
  function move(e: RPE) {
    if (pts.current.has(e.pointerId)) pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pz = pinch.current;
    if (pz && pts.current.size === 2) { const w = Math.min(60000, Math.max(500, pz.v.w * pz.d / Math.max(spread(), 1))), r = w / pz.v.w; return setView({ w, x: pz.mx - (pz.mx - pz.v.x) * r, y: pz.my - (pz.my - pz.v.y) * r }); }
    const d = drag.current; if (!d) return;
    if (d.kind === 'pan') return setView({ ...d.v, x: d.v.x - (e.clientX - d.sx) * k, y: d.v.y - (e.clientY - d.sy) * k });
    const m = toMm(e), dx = m.x - d.mx, dy = m.y - d.my;
    if (d.kind === 'piece') {
      if (!d.moved && Math.hypot(dx, dy) < 4 * k) return; d.moved = true;
      const me = byId.get(d.id)!, others = flat.filter((q) => q.id !== d.id);
      const xs = others.flatMap((q) => [q.x, q.x + q.w]), ys = others.flatMap((q) => [q.y, q.y + q.h]);
      let x = snap(d.ox + dx, xs); if (x === Math.round((d.ox + dx) / 10) * 10) { const r = snap(d.ox + dx + me.w, xs); if (xs.includes(r)) x = r - me.w; }
      let y = snap(d.oy + dy, ys); if (y === Math.round((d.oy + dy) / 10) * 10) { const b = snap(d.oy + dy + me.h, ys); if (ys.includes(b)) y = b - me.h; }
      patchPiece(d.id, { x, y }, `mv-${d.id}`);
    } else if (d.kind === 'cut') {
      const c = project.cutouts.find((q) => q.id === d.id)!, host = byId.get(c.pieceId)!;
      const cx = (host.w - c.w) / 2, cy = (host.h - c.h) / 2;
      patchCutout(d.id, { x: Math.max(0, Math.min(host.w - c.w, snap(d.ox + dx, [cx], 5))), y: Math.max(0, Math.min(host.h - c.h, snap(d.oy + dy, [cy], 5))) }, `mc-${d.id}`);
    } else {
      const o = d.o, others = flat.filter((q) => q.id !== o.id), xs = others.flatMap((q) => [q.x, q.x + q.w]), ys = others.flatMap((q) => [q.y, q.y + q.h]), MIN = 100;
      let patch: Partial<Piece> = {};
      if (d.side === 'right') patch = { w: Math.max(MIN, snap(o.x + o.w + dx, xs) - o.x) };
      if (d.side === 'left') { const nx = Math.min(o.x + o.w - MIN, snap(o.x + dx, xs)); patch = { x: nx, w: o.x + o.w - nx }; }
      if (d.side === 'front') patch = { h: Math.max(MIN, snap(o.y + o.h + dy, ys) - o.y) };
      if (d.side === 'back') { const ny = Math.min(o.y + o.h - MIN, snap(o.y + dy, ys)); patch = { y: ny, h: o.y + o.h - ny }; }
      apply((pr) => resized(pr, o.id, patch), `rs-${o.id}-${d.side}`);
    }
  }
  const up = () => { drag.current = null; };
  function wheel(e: React.WheelEvent) {
    const m = toMm(e), f = Math.exp(e.deltaY * 0.0012), w = Math.max(600, Math.min(40000, v.w * f)), r = w / v.w;
    setView({ x: m.x - (m.x - v.x) * r, y: m.y - (m.y - v.y) * r, w });
  }
  const zoom = (f: number) => setView({ x: v.x + (v.w * (1 - f)) / 2, y: v.y + (vh * (1 - f)) / 2, w: v.w * f });

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; if (/INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      const s = useStore.getState().sel; if (!s) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(s); }
      if (e.key === 'Escape') select(null);
      const a: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (a[e.key]) {
        e.preventDefault(); const st = e.shiftKey ? 1 : 10, pr = useStore.getState().project!;
        if (s.type === 'piece') { const q = pr.pieces.find((x) => x.id === s.id); if (q && !isVertical(q)) patchPiece(q.id, { x: q.x + a[e.key][0] * st, y: q.y + a[e.key][1] * st }, `kb-${q.id}`); }
        else { const c = pr.cutouts.find((x) => x.id === s.id), h = c && pr.pieces.find((x) => x.id === c.pieceId); if (c && h) patchCutout(c.id, { x: Math.max(0, Math.min(h.w - c.w, c.x + a[e.key][0] * st)), y: Math.max(0, Math.min(h.h - c.h, c.y + a[e.key][1] * st)) }, `kb-${c.id}`); }
      }
    };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, []);

  // ----- מידות לעריכה על השרטוט -----
  const dims: Dim[] = [];
  const selPiece = sel?.type === 'piece' ? byId.get(sel.id) : undefined;
  const selCut = sel?.type === 'cutout' ? project.cutouts.find((c) => c.id === sel.id) : undefined;
  if (selPiece && !isVertical(selPiece)) {
    const p = selPiece;
    dims.push({ x1: p.x, y1: p.y, x2: p.x + p.w, y2: p.y, value: p.w, off: -1, set: (mm) => apply((pr) => resized(pr, p.id, { w: Math.max(100, mm) })) });
    dims.push({ x1: p.x, y1: p.y, x2: p.x, y2: p.y + p.h, value: p.h, off: -1, set: (mm) => apply((pr) => resized(pr, p.id, { h: Math.max(100, mm) })) });
  }
  if (selCut) {
    const c = selCut, h = byId.get(c.pieceId);
    if (h) {
      const X = h.x + c.x, Y = h.y + c.y, my = Y + c.h / 2, mx = X + c.w / 2, cl = (val: number, max: number) => Math.max(0, Math.min(max, val));
      dims.push({ x1: h.x, y1: my, x2: X, y2: my, value: c.x, off: 0, set: (mm) => patchCutout(c.id, { x: cl(mm, h.w - c.w) }) });
      dims.push({ x1: X + c.w, y1: my, x2: h.x + h.w, y2: my, value: h.w - c.x - c.w, off: 0, set: (mm) => patchCutout(c.id, { x: cl(h.w - c.w - mm, h.w - c.w) }) });
      dims.push({ x1: mx, y1: h.y, x2: mx, y2: Y, value: c.y, off: 0, set: (mm) => patchCutout(c.id, { y: cl(mm, h.h - c.h) }) });
      dims.push({ x1: mx, y1: Y + c.h, x2: mx, y2: h.y + h.h, value: h.h - c.y - c.h, off: 0, set: (mm) => patchCutout(c.id, { y: cl(h.h - c.h - mm, h.h - c.h) }) });
      dims.push({ x1: X, y1: Y + c.h, x2: X + c.w, y2: Y + c.h, value: c.w, off: 0.6, set: c.round ? undefined : (mm) => patchCutout(c.id, { w: Math.max(20, Math.min(h.w - c.x, mm)) }) });
    }
  }
  const openEdit = (d: Dim, e: React.MouseEvent) => { if (!d.set) return; e.stopPropagation(); const r = wrap.current!.getBoundingClientRect(); setEdit({ px: e.clientX - r.left, py: e.clientY - r.top, text: cm(d.value), set: d.set }); };

  const fs = 12.5 * k, placements = (id: string) => (nest?.slabs.flatMap((s) => s.placements) || []).filter((pl) => pl.pieceId === id && isBody(pl));
  const sideLine = (p: Piece, s: Side, inset: number) => { const e = hostEdge(p, s); return { x1: e.x - e.nx * inset, y1: e.y - e.ny * inset, x2: e.x + e.dx * e.len - e.nx * inset, y2: e.y + e.dy * e.len - e.ny * inset }; };
  const handle = (p: Piece, s: Side) => { const e = hostEdge(p, s); return { x: e.x + (e.dx * e.len) / 2, y: e.y + (e.dy * e.len) / 2, horiz: e.dx === 1 }; };

  return (
    <div className="view" ref={wrap}>
      <span className="tag badge">שרטוט · מבט על</span>
      <div className="tools"><div className="pill"><button title="הקטנה" onClick={() => zoom(1.25)}>−</button><button title="התאמה למסך" onClick={fit}><Icon.fit /></button><button title="הגדלה" onClick={() => zoom(0.8)}>+</button></div></div>
      <svg ref={svg} viewBox={`${v.x} ${v.y} ${v.w} ${vh}`} onPointerDownCapture={touchDown} onPointerMove={move} onPointerUp={(e) => { touchUp(e); up(); }} onPointerCancel={(e) => { touchUp(e); up(); }} onWheel={wheel}
        onPointerDown={(e) => { select(null); setEdit(null); svg.current!.setPointerCapture(e.pointerId); drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, v }; }} style={{ cursor: 'grab' }}>
        <defs>
          <pattern id="dots" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r={1.1 * k} fill="rgba(27,26,24,.22)" /></pattern>
          <pattern id="wall" width={7 * k} height={7 * k} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width={7 * k} height={7 * k} fill="#d8d0c3" /><line x1="0" y1="0" x2="0" y2={7 * k} stroke="#b9ae9c" strokeWidth={2 * k} /></pattern>
          {flat.map((p) => <clipPath key={p.id} id={`o-${p.id}`}><path d={path(p)} /></clipPath>)}
          {flat.flatMap((p) => placements(p.id).map((pl) => { const s = segLocal(p, pl); return <clipPath key={`${p.id}-${pl.seg}`} id={`s-${p.id}-${pl.seg}`}><rect x={s.x} y={s.y} width={s.w} height={s.h} /></clipPath>; }))}
        </defs>
        <rect x={v.x} y={v.y} width={v.w} height={vh} fill="url(#dots)" />

        {/* קירות */}
        {flat.filter((p) => p.wall).map((p) => { const e = hostEdge(p, p.wall!), t = 90; return <rect key={`w-${p.id}`} x={Math.min(e.x, e.x + e.nx * t) - (e.dx ? 60 : 0)} y={Math.min(e.y, e.y + e.ny * t) - (e.dy ? 60 : 0)} width={e.dx ? e.len + 120 : t} height={e.dy ? e.len + 120 : t} fill="url(#wall)" rx={3 * k} />; })}

        {flat.map((p, i) => {
          const on = sel?.type === 'piece' && sel.id === p.id, pls = placements(p.id), idx = project.pieces.indexOf(p);
          return (
            <g key={p.id} transform={`translate(${p.x},${p.y})`}>
              <path d={path(p)} fill="rgba(0,0,0,.18)" transform={`translate(0,${7 * k})`} style={{ filter: `blur(${5 * k}px)` }} />
              <g clipPath={`url(#o-${p.id})`} onPointerDown={(e) => { select({ type: 'piece', id: p.id }); down(e, { kind: 'piece', id: p.id, ...(() => { const m = toMm(e); return { mx: m.x, my: m.y }; })(), ox: p.x, oy: p.y, moved: false }); }} style={{ cursor: 'move' }}>
                <path d={path(p)} fill="#e9e4da" />
                {pls.map((pl) => <g key={pl.seg} clipPath={`url(#s-${p.id}-${pl.seg})`}><image href={stone.url} width={project.slabW} height={project.slabH} preserveAspectRatio="none" transform={slabToLocalMatrix(p, pl) + (project.bookmatch === 'yes' && pl.slab % 2 ? ` translate(${project.slabW},0) scale(-1,1)` : '')} /></g>)}
                {!pls.length && <path d={path(p)} fill="rgba(229,72,77,.25)" />}
              </g>
              {/* חיבורים */}
              {(nest?.joints || []).filter((j) => j.pieceId === p.id).map((j) => (longIsX(p) ? <line key={j.at} x1={j.at} y1={0} x2={j.at} y2={p.h} /> : <line key={j.at} x1={0} y1={j.at} x2={p.w} y2={j.at} />)).map((l, n) => <g key={n} stroke="var(--cut)" strokeWidth={2 * k} strokeDasharray={`${7 * k} ${5 * k}`} pointerEvents="none">{l}</g>)}
              <path d={path(p)} fill="none" stroke={on ? 'var(--sand)' : 'rgba(27,26,24,.55)'} strokeWidth={(on ? 2.6 : 1.1) * k} pointerEvents="none" />
              {on && <path d={path(p)} fill="none" stroke="var(--sand)" strokeOpacity=".28" strokeWidth={9 * k} pointerEvents="none" />}
              {/* פתחים */}
              {project.cutouts.filter((c) => c.pieceId === p.id).map((c) => <CutoutShape key={c.id} c={c} k={k} on={sel?.type === 'cutout' && sel.id === c.id} bad={bad.has(c.id)}
                onDown={(e) => { select({ type: 'cutout', id: c.id }); const m = toMm(e); down(e, { kind: 'cut', id: c.id, mx: m.x, my: m.y, ox: c.x, oy: c.y }); }} />)}
              <g pointerEvents="none" textAnchor="middle" style={{ direction: 'ltr' }}>
                <rect x={p.w / 2 - 12 * k} y={p.h / 2 - 22 * k} width={24 * k} height={19 * k} rx={6 * k} fill="var(--ink)" opacity={Math.min(p.w, p.h) > 44 * k ? 1 : 0} />
                {Math.min(p.w, p.h) > 44 * k && <><text x={p.w / 2} y={p.h / 2 - 8.5 * k} fontSize={11 * k} fontWeight="600" fill="#fff" fontFamily="var(--mono)">{letter(idx)}</text>
                  <text x={p.w / 2} y={p.h / 2 + 13 * k} fontSize={fs} fontWeight="500" fill="var(--ink)" fontFamily="var(--mono)" stroke="rgba(255,255,255,.85)" strokeWidth={3.5 * k} paintOrder="stroke">{cm(p.w)}×{cm(p.h)}</text></>}
              </g>
            </g>
          );
        })}

        {/* חיבורי פינה */}
        {corners(project).map((c) => <line key={`cr-${c.b.id}`} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="var(--cut)" strokeWidth={2.2 * k} strokeDasharray={`${7 * k} ${5 * k}`} pointerEvents="none" />)}

        {/* קנטים */}
        {project.apronH > 0 && flat.flatMap((p) => p.aprons.map((s) => { const l = sideLine(p, s, 2.2 * k); return <line key={`${p.id}-${s}`} {...l} stroke="var(--edge)" strokeWidth={3 * k} strokeLinecap="round" pointerEvents="none" />; }))}

        {/* חיפוי ומפל: פס לאורך הצלע */}
        {project.pieces.filter(isVertical).map((q) => {
          const host = q.host ? byId.get(q.host) : undefined; if (!host || !q.side) return null;
          const e = hostEdge(host, q.side), t = q.kind === 'splash' ? 46 : 34, on = sel?.type === 'piece' && sel.id === q.id, len = Math.min(q.w, e.len);
          const x = e.nx < 0 ? e.x - t : e.x, y = e.ny < 0 ? e.y - t : e.y;
          return <g key={q.id} onPointerDown={(ev) => { ev.stopPropagation(); select({ type: 'piece', id: q.id }); }} style={{ cursor: 'pointer' }}>
            <rect x={x} y={y} width={e.dx ? len : t} height={e.dy ? len : t} fill={q.kind === 'splash' ? '#c8b592' : '#9c8a69'} stroke={on ? 'var(--sand)' : 'rgba(27,26,24,.5)'} strokeWidth={(on ? 2.6 : 1) * k} rx={2 * k} />
            {on && <rect x={x} y={y} width={e.dx ? len : t} height={e.dy ? len : t} fill="none" stroke="var(--sand)" strokeOpacity=".3" strokeWidth={9 * k} />}
          </g>;
        })}

        {/* ידיות שינוי גודל */}
        {selPiece && !isVertical(selPiece) && (['left', 'right', 'back', 'front'] as Side[]).map((s) => { const h = handle(selPiece, s), a = 22 * k, b = 7 * k; return <rect key={s} x={h.x - (h.horiz ? a : b) / 2} y={h.y - (h.horiz ? b : a) / 2} width={h.horiz ? a : b} height={h.horiz ? b : a} rx={3.5 * k} fill="#fff" stroke="var(--ink)" strokeWidth={1.4 * k} style={{ cursor: h.horiz ? 'ns-resize' : 'ew-resize' }} onPointerDown={(e) => { const m = toMm(e); down(e, { kind: 'resize', id: selPiece.id, side: s, mx: m.x, my: m.y, o: selPiece }); }} />; })}

        {/* קווי מידה */}
        {dims.filter((d) => d.value > 0.5).map((d, i) => {
          const horiz = Math.abs(d.y2 - d.y1) < 0.01, o = d.off * 34 * k, x1 = d.x1 + (horiz ? 0 : o), x2 = d.x2 + (horiz ? 0 : o), y1 = d.y1 + (horiz ? o : 0), y2 = d.y2 + (horiz ? o : 0), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, tw = (cm(d.value).length * 7.6 + 14) * k;
          return <g key={i} style={{ direction: 'ltr' }}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeWidth={1 * k} strokeDasharray={d.off ? undefined : `${3 * k} ${3 * k}`} pointerEvents="none" />
            {[[x1, y1], [x2, y2]].map(([x, y], n) => <line key={n} x1={x - (horiz ? 0 : 5 * k)} y1={y - (horiz ? 5 * k : 0)} x2={x + (horiz ? 0 : 5 * k)} y2={y + (horiz ? 5 * k : 0)} stroke="var(--ink)" strokeWidth={1.2 * k} pointerEvents="none" />)}
            <g onPointerDown={(e) => e.stopPropagation()} onClick={(e) => openEdit(d, e)} style={{ cursor: d.set ? 'text' : 'default' }}>
              <rect x={mx - tw / 2} y={my - 10 * k} width={tw} height={20 * k} rx={10 * k} fill="var(--ink)" />
              <text x={mx} y={my + 4.2 * k} textAnchor="middle" fontSize={12 * k} fontWeight="500" fill="#fff" fontFamily="var(--mono)">{cm(d.value)}</text>
            </g>
          </g>;
        })}
      </svg>
      {edit && <input className="plan-edit" autoFocus style={{ left: edit.px, top: edit.py }} defaultValue={edit.text} onFocus={(e) => e.target.select()} onBlur={() => setEdit(null)}
        onKeyDown={(e) => { if (e.key === 'Enter') { const mm = parseCm(e.currentTarget.value); if (mm != null) edit.set(mm); setEdit(null); } if (e.key === 'Escape') setEdit(null); e.stopPropagation(); }} />}
      <span className="hint">גררו חלקים ופתחים · לחצו על מידה כדי להקליד · גלגלת לזום · המידות בס"מ</span>
      {!flat.length && <div className="empty" style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', pointerEvents: 'none' }}><h2>אין עדיין חלקים</h2><p>הוסיפו משטח מהפאנל בצד</p></div>}
    </div>
  );
}

function CutoutShape({ c, k, on, bad, onDown }: { c: Cutout; k: number; on: boolean; bad: boolean; onDown: (e: RPE) => void }) {
  const stroke = bad ? 'var(--err)' : on ? 'var(--sand)' : 'rgba(27,26,24,.7)', sw = (on || bad ? 2.4 : 1.2) * k;
  const common = { onPointerDown: onDown, style: { cursor: 'move' as const } };
  if (c.round) return <g {...common}><circle cx={c.x + c.w / 2} cy={c.y + c.h / 2} r={c.w / 2} fill="#2a2a2a" stroke={stroke} strokeWidth={sw} /><circle cx={c.x + c.w / 2} cy={c.y + c.h / 2} r={Math.max(c.w / 2, 11 * k)} fill="transparent" /></g>;
  if (c.kind === 'cooktop') {
    const r = Math.min(c.w, c.h) * 0.17;
    return <g {...common}><rect x={c.x} y={c.y} width={c.w} height={c.h} rx={14} fill="#1c1c1e" stroke={stroke} strokeWidth={sw} />
      {[[0.28, 0.3], [0.72, 0.3], [0.28, 0.72], [0.72, 0.72]].map(([fx, fy], i) => <circle key={i} cx={c.x + c.w * fx} cy={c.y + c.h * fy} r={i % 3 ? r : r * 0.8} fill="none" stroke="#6a6a6e" strokeWidth={Math.max(3, 1.2 * k)} />)}</g>;
  }
  const g = `g-${c.id}`;
  return <g {...common}>
    <defs><linearGradient id={g} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4f5f6" /><stop offset="1" stopColor="#b9bdc2" /></linearGradient></defs>
    <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={c.kind === 'sink' ? 26 : 6} fill={c.kind === 'sink' ? (c.built ? '#d9d2c4' : `url(#${g})`) : 'rgba(255,255,255,.6)'} stroke={stroke} strokeWidth={sw} strokeDasharray={c.kind === 'hole' ? `${5 * k} ${4 * k}` : undefined} />
    {c.kind === 'sink' && c.bowls && c.bowls !== 'single' && (c.w >= c.h ? <line x1={c.x + c.w * (c.bowls === 'even' ? 0.5 : 0.6)} y1={c.y + 6} x2={c.x + c.w * (c.bowls === 'even' ? 0.5 : 0.6)} y2={c.y + c.h - 6} stroke="#6d7177" strokeWidth={14} /> : <line x1={c.x + 6} y1={c.y + c.h * (c.bowls === 'even' ? 0.5 : 0.6)} x2={c.x + c.w - 6} y2={c.y + c.h * (c.bowls === 'even' ? 0.5 : 0.6)} stroke="#6d7177" strokeWidth={14} />)}
    {c.kind === 'sink' && <><rect x={c.x + 22} y={c.y + 22} width={Math.max(1, c.w - 44)} height={Math.max(1, c.h - 44)} rx={18} fill="none" stroke="rgba(0,0,0,.18)" strokeWidth={Math.max(2, k)} /><circle cx={c.x + c.w / 2} cy={c.y + c.h / 2} r={24} fill="#8d9197" /></>}
    {c.w > 70 * k && <text x={c.x + c.w / 2} y={c.y + c.h / 2 + (c.kind === 'sink' ? 62 : 4 * k)} textAnchor="middle" fontSize={10.5 * k} fill={c.kind === 'sink' ? '#5a5e63' : 'var(--ink2)'} pointerEvents="none">{c.name || CUT_HE[c.kind]}</text>}
  </g>;
}
