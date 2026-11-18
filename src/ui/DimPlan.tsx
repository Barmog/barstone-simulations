// תוכנית מידות למסמך: מבט על, כל חלק עם האות שלו, מידת אורך בצד הקיר (או מתחת לאי), עומק, פתחים עם מרחקים, וחיבורים.
import { CUT_HE, Piece, Project, isVertical, letter, longIsX } from '../core/model';
import { NestResult } from '../core/nesting';
import { COLORS } from './drawings';

const cmTxt = (mm: number) => String(Math.round(mm) / 10);

function Dim({ x1, y1, x2, y2, off, text, fs }: { x1: number; y1: number; x2: number; y2: number; off: [number, number]; text: string; fs: number }) {
  const [ox, oy] = off, ax = x1 + ox, ay = y1 + oy, bx = x2 + ox, by = y2 + oy, mx = (ax + bx) / 2, my = (ay + by) / 2, horiz = Math.abs(by - ay) < 1, tick = fs * 0.35;
  return (
    <g stroke="#5a544b" strokeWidth={fs * 0.06} fill="none">
      <line x1={x1} y1={y1} x2={ax} y2={ay} strokeOpacity={0.45} /><line x1={x2} y1={y2} x2={bx} y2={by} strokeOpacity={0.45} />
      <line x1={ax} y1={ay} x2={bx} y2={by} />
      <line x1={ax - tick} y1={ay + tick} x2={ax + tick} y2={ay - tick} /><line x1={bx - tick} y1={by + tick} x2={bx + tick} y2={by - tick} />
      <text x={mx} y={my} dy={horiz ? -fs * 0.35 : 0} dx={horiz ? 0 : -fs * 0.35} fontSize={fs} fill="#1b1a18" stroke="none" textAnchor="middle" fontFamily="JetBrains Mono, monospace" transform={horiz ? undefined : `rotate(-90 ${mx} ${my})`} style={{ paintOrder: 'stroke' }}>{text}</text>
    </g>
  );
}

export function DimPlan({ project, nest }: { project: Project; nest: NestResult | null }) {
  const flat = project.pieces.filter((p) => !isVertical(p));
  if (!flat.length) return null;
  const x0 = Math.min(...flat.map((p) => p.x)), y0 = Math.min(...flat.map((p) => p.y)), x1 = Math.max(...flat.map((p) => p.x + p.w)), y1 = Math.max(...flat.map((p) => p.y + p.h));
  const span = Math.max(x1 - x0, y1 - y0), fs = Math.max(55, span / 55), pad = fs * 7;
  const splashOf = (p: Piece) => project.pieces.filter((q) => q.kind === 'splash' && q.host === p.id);
  return (
    <svg viewBox={`${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`} style={{ width: '100%', height: '100%' }} fontFamily="Heebo, Arial">
      {flat.map((p) => {
        const i = project.pieces.indexOf(p), lx = longIsX(p), cuts = project.cutouts.filter((c) => c.pieceId === p.id);
        // צד המידה הארוכה: צד הקיר, ובאי — מתחת
        const side = p.wall || (lx ? 'front' : 'right'), g = fs * 2.2;
        const long = lx
          ? <Dim x1={p.x} y1={side === 'back' ? p.y : p.y + p.h} x2={p.x + p.w} y2={side === 'back' ? p.y : p.y + p.h} off={[0, side === 'back' ? -g : g]} text={cmTxt(p.w)} fs={fs} />
          : <Dim x1={side === 'left' ? p.x : p.x + p.w} y1={p.y} x2={side === 'left' ? p.x : p.x + p.w} y2={p.y + p.h} off={[side === 'left' ? -g : g, 0]} text={cmTxt(p.h)} fs={fs} />;
        const depth = lx
          ? <text x={p.x + fs * 0.9} y={p.y + p.h / 2} fontSize={fs * 0.8} fill="#5a544b" fontFamily="JetBrains Mono, monospace" textAnchor="middle" transform={`rotate(-90 ${p.x + fs * 0.9} ${p.y + p.h / 2})`}>↕ {cmTxt(p.h)}</text>
          : <text x={p.x + p.w / 2} y={p.y + fs * 1.3} fontSize={fs * 0.8} fill="#5a544b" fontFamily="JetBrains Mono, monospace" textAnchor="middle">↔ {cmTxt(p.w)}</text>;
        return (
          <g key={p.id}>
            {splashOf(p).map((q) => { const s = q.side!; const t = fs * 0.45; return s === 'back' ? <rect key={q.id} x={p.x + (q.off || 0)} y={p.y - t} width={q.w} height={t} fill="#c9b99c" /> : s === 'front' ? <rect key={q.id} x={p.x + (q.off || 0)} y={p.y + p.h} width={q.w} height={t} fill="#c9b99c" /> : <rect key={q.id} x={s === 'left' ? p.x - t : p.x + p.w} y={p.y + (q.off || 0)} width={t} height={q.w} fill="#c9b99c" />; })}
            {p.outline ? <path d={`M${p.outline.map((q) => `${p.x + q.x},${p.y + q.y}`).join('L')}Z`} fill="#f3eee6" stroke="#1b1a18" strokeWidth={fs * 0.07} /> : <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#f3eee6" stroke="#1b1a18" strokeWidth={fs * 0.07} />}
            {/* קיטום: מה שנשאר ישר בכל צלע, כמו בסקיצה */}
            {(p.chamfers || []).map((c) => { const L = c.corner[1] === 'l', T0 = c.corner[0] === 't', hx = L ? p.x + c.x : p.x, hx2 = L ? p.x + p.w : p.x + p.w - c.x, ey = T0 ? p.y : p.y + p.h, vy = T0 ? p.y + c.y : p.y, vy2 = T0 ? p.y + p.h : p.y + p.h - c.y, ex = L ? p.x : p.x + p.w;
              return <g key={c.corner}>{p.w - c.x > 0 && <Dim x1={hx} y1={ey} x2={hx2} y2={ey} off={[0, T0 ? -fs * 2.2 : fs * 2.2]} text={cmTxt(p.w - c.x)} fs={fs * 0.8} />}{p.h - c.y > 0 && <Dim x1={ex} y1={vy} x2={ex} y2={vy2} off={[L ? -fs * 2.2 : fs * 2.2, 0]} text={cmTxt(p.h - c.y)} fs={fs * 0.8} />}</g>; })}
            {!p.chamfers?.length && p.aprons.map((s) => { const w = fs * 0.12; return <rect key={s} fill={COLORS.miter} x={s === 'right' ? p.x + p.w - w : p.x} y={s === 'front' ? p.y + p.h - w : p.y} width={s === 'left' || s === 'right' ? w : p.w} height={s === 'back' || s === 'front' ? w : p.h} />; })}
            {p.seat && (() => { const s = p.seat, d = p.seatDepth || 300; return <rect x={s === 'right' ? p.x + p.w - d : p.x} y={s === 'front' ? p.y + p.h - d : p.y} width={s === 'left' || s === 'right' ? d : p.w} height={s === 'back' || s === 'front' ? d : p.h} fill="none" stroke="#8a7a5c" strokeWidth={fs * 0.05} strokeDasharray={`${fs * 0.4} ${fs * 0.3}`} />; })()}
            {cuts.map((c) => {
              const cx = p.x + c.x, cy = p.y + c.y, along = lx ? c.x : c.y;
              return (
                <g key={c.id}>
                  {c.round ? <circle cx={cx + c.w / 2} cy={cy + c.h / 2} r={c.w / 2} fill="#fff" stroke="#1b1a18" strokeWidth={fs * 0.05} /> : <rect x={cx} y={cy} width={c.w} height={c.h} rx={c.kind === 'sink' ? fs * 0.3 : 0} fill="#fff" stroke="#1b1a18" strokeWidth={fs * 0.05} />}
                  {!c.round && <text x={cx + c.w / 2} y={cy + c.h / 2} fontSize={fs * 0.62} textAnchor="middle" dominantBaseline="middle" fill="#1b1a18">{c.name || CUT_HE[c.kind]} {cmTxt(c.w)}×{cmTxt(c.h)}</text>}
                  {c.kind !== 'faucet' && (lx
                    ? <Dim x1={p.x} y1={p.y + p.h} x2={cx} y2={p.y + p.h} off={[0, -fs * 0.9]} text={cmTxt(along)} fs={fs * 0.7} />
                    : <Dim x1={p.x + p.w} y1={p.y} x2={p.x + p.w} y2={cy} off={[-fs * 0.9, 0]} text={cmTxt(along)} fs={fs * 0.7} />)}
                </g>
              );
            })}
            {(nest?.joints || []).filter((j) => j.pieceId === p.id).map((j, n) => { const jx = lx ? p.x + j.at : p.x, jy = lx ? p.y : p.y + j.at, a = fs * 0.5; return (
              <g key={n} fill={COLORS.joint}>
                <line x1={jx} y1={jy} x2={lx ? jx : jx + p.w} y2={lx ? jy + p.h : jy} stroke={COLORS.joint} strokeWidth={fs * 0.06} strokeDasharray={`${fs * 0.3} ${fs * 0.2}`} />
                {lx ? <><path d={`M${jx - a} ${jy - a * 1.6}L${jx + a} ${jy - a * 1.6}L${jx} ${jy - a * 0.2}Z`} /><path d={`M${jx - a} ${jy + p.h + a * 1.6}L${jx + a} ${jy + p.h + a * 1.6}L${jx} ${jy + p.h + a * 0.2}Z`} /></>
                  : <><path d={`M${jx - a * 1.6} ${jy - a}L${jx - a * 1.6} ${jy + a}L${jx - a * 0.2} ${jy}Z`} /><path d={`M${jx + p.w + a * 1.6} ${jy - a}L${jx + p.w + a * 1.6} ${jy + a}L${jx + p.w + a * 0.2} ${jy}Z`} /></>}
              </g>); })}
            <g>
              <rect x={p.x + p.w / 2 - fs * 0.85} y={p.y + p.h / 2 - fs * (cuts.some((c) => !c.round) ? 2.6 : 0.75)} width={fs * 1.7} height={fs * 1.5} rx={fs * 0.4} fill="#1b1a18" />
              <text x={p.x + p.w / 2} y={p.y + p.h / 2 - fs * (cuts.some((c) => !c.round) ? 1.85 : 0)} fontSize={fs} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight={600}>{letter(i)}</text>
            </g>
            {long}{depth}
          </g>
        );
      })}
    </svg>
  );
}
