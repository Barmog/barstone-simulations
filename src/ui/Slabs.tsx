// תצוגת הנסטינג: כל לוח עם תמונת האבן האמיתית, החלקים שנחתכים ממנו ופסי הקנט.
import { letter } from '../core/model';
import { useStore } from '../store';
import { useStone } from './util';

export function Slabs() {
  const project = useStore((s) => s.project)!, nest = useStore((s) => s.nest), sel = useStore((s) => s.sel), select = useStore((s) => s.select);
  const stone = useStone();
  if (!nest?.slabs.length) return <div className="view"><div className="empty" style={{ padding: 30 }}>הלוחות יופיעו כאן אחרי שיהיו חלקים</div></div>;
  const idx = new Map(project.pieces.map((p, i) => [p.id, i]));
  return (
    <div className="view">
      <div className="slabs">
        {nest.slabs.map((s, i) => (
          <div className="slab" key={i}>
            <svg viewBox={`0 0 ${s.w} ${s.h}`} preserveAspectRatio="xMidYMid meet">
              <defs><mask id={`m${i}`}><rect width={s.w} height={s.h} fill="#fff" />{s.placements.map((p, n) => <g key={n}><rect {...p.body} width={p.body.w} height={p.body.h} fill="#000" />{p.strips.map((st, m) => <rect key={m} x={st.rect.x} y={st.rect.y} width={st.rect.w} height={st.rect.h} fill="#000" />)}</g>)}</mask></defs>
              <image href={stone.url} width={s.w} height={s.h} preserveAspectRatio="none" transform={project.bookmatch === 'yes' && i % 2 ? `translate(${s.w},0) scale(-1,1)` : undefined} />
              <rect width={s.w} height={s.h} fill="rgba(245,241,234,.62)" mask={`url(#m${i})`} />
              {s.placements.map((p, n) => {
                const on = sel?.type === 'piece' && sel.id === p.pieceId, pi = idx.get(p.pieceId) ?? 0, small = Math.min(p.body.w, p.body.h) < 240;
                return (
                  <g key={n} onClick={() => select({ type: 'piece', id: p.pieceId })} style={{ cursor: 'pointer' }}>
                    <rect x={p.body.x} y={p.body.y} width={p.body.w} height={p.body.h} fill={on ? 'rgba(180,155,116,.22)' : 'transparent'} stroke={on ? '#B49B74' : p.stripOf ? '#E0428F' : p.extra ? '#5B7FD6' : '#1f8f5a'} strokeWidth={on ? 14 : 7} />
                    {p.strips.map((st, m) => <rect key={m} x={st.rect.x} y={st.rect.y} width={st.rect.w} height={st.rect.h} fill="rgba(224,66,143,.16)" stroke="#E0428F" strokeWidth={5} />)}
                    {!small && <g style={{ direction: 'ltr' }} textAnchor="middle" pointerEvents="none">
                      <rect x={p.body.x + p.body.w / 2 - 85} y={p.body.y + p.body.h / 2 - 80} width={170} height={112} rx={30} fill="#1B1A18" />
                      <text x={p.body.x + p.body.w / 2} y={p.body.y + p.body.h / 2 + 4} fontSize={82} fontWeight="600" fill="#fff" fontFamily="var(--mono)">{p.extra ? 'כ' : letter(pi)}{p.segs > 1 ? p.seg + 1 : ''}</text>
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
