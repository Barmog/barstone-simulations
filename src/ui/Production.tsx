// טופס ייצור: מה שהמפעל צריך אחרי שההדמיה אושרה במדידה — רשימת חיתוך, חיבורים, ומיקום כל חלק על הלוח.
import { useState } from 'react';
import { CUT_HE, Piece, Project, SIDE_HE, corners, isVertical, letter, longIsX, pieceLen } from '../core/model';
import { NestResult, isBody } from '../core/nesting';
import { Issue } from '../core/checks';
import { Approval } from '../data/repo';
import { cm } from './util';

const mm = (v: number) => String(Math.round(v));
const tag = (project: Project, id: string) => letter(project.pieces.findIndex((q) => q.id === id));
const when = (s: string) => new Date(s).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });

/** כל החיבורים בהזמנה: בתוך משטח, בפינה, ומפלים. */
export function jointRows(project: Project, nest: NestResult | null) {
  const rows: { key: string; where: string; type: string; at: string; len: number; note: string }[] = [];
  for (const j of nest?.joints || []) {
    const p = project.pieces.find((q) => q.id === j.pieceId); if (!p) continue;
    const lx = longIsX(p), wid = lx ? p.h : p.w;
    const through = project.cutouts.find((c) => c.pieceId === p.id && c.kind !== 'faucet' && (lx ? j.at > c.x && j.at < c.x + c.w : j.at > c.y && j.at < c.y + c.h));
    rows.push({ key: `j-${p.id}-${j.at}`, where: `${tag(project, p.id)} · ${p.name}`, type: 'חיבור ישר', at: `${mm(j.at)} מ"מ מ${isVertical(p) ? 'תחילת החלק' : lx ? 'הקצה השמאלי' : 'הקצה האחורי'} (נשאר ${mm(pieceLen(p) - j.at)})`, len: wid,
      note: through ? `עובר במרכז ${CUT_HE[through.kind]}: אורך הדבקה קצר` : '' });
  }
  for (const c of corners(project)) rows.push({ key: `c-${c.a.id}-${c.b.id}`, where: `${tag(project, c.a.id)} ↔ ${tag(project, c.b.id)} · ${c.a.name} / ${c.b.name}`, type: c.miter ? 'פינה · גרונג 45°' : 'פינה · חיבור ישר', at: 'בפינה', len: Math.hypot(c.x2 - c.x1, c.y2 - c.y1), note: c.miter ? 'חיתוך אלכסוני בשני החלקים' : '' });
  for (const w of project.pieces.filter((q) => q.kind === 'waterfall' && q.host)) { const h = project.pieces.find((q) => q.id === w.host); if (h) rows.push({ key: `w-${w.id}`, where: `${tag(project, h.id)} ↔ ${tag(project, w.id)} · ${h.name} / ${w.name}`, type: 'מפל · גרונג 45°', at: `צד ${SIDE_HE[w.side!]}`, len: w.w, note: 'המשך גיד מהמשטח למפל' }); }
  return rows;
}

export function CutList({ project, nest, stoneName }: { project: Project; nest: NestResult | null; stoneName: string }) {
  const segs = (p: Piece) => (nest?.joints || []).filter((j) => j.pieceId === p.id).length + 1;
  return (
    <table className="parts"><thead><tr><th>#</th><th>חלק</th><th>אורך × רוחב (מ"מ)</th><th>מקטעים</th><th>קנט</th><th>פתחים (מ"מ, מיקום מהפינה)</th><th>גיד</th><th>הערות</th></tr></thead><tbody>
      {project.pieces.map((p, i) => { const cuts = project.cutouts.filter((c) => c.pieceId === p.id), ap = !isVertical(p) && p.aprons.length && project.apronH ? project.apronH : 0; return (
        <tr key={p.id}><td><b className="mono">{letter(i)}</b></td><td>{p.name}</td><td className="mono">{mm(p.w)} × {mm(p.h)}</td><td className="mono">{segs(p)}</td>
          <td>{ap ? `גרונג ${ap} · ${p.aprons.map((s) => SIDE_HE[s]).join(', ')}` : isVertical(p) ? '—' : 'ישר'}</td>
          <td>{cuts.map((c) => `${c.name || CUT_HE[c.kind]}${c.built ? ' בנוי' : ''} ${c.round ? `Ø${mm(c.w)}` : `${mm(c.w)}×${mm(c.h)}`} @ ${mm(c.x)},${mm(c.y)}`).join(' · ') || '—'}</td>
          <td>{p.grainLock ? 'נעול' : 'חופשי'}</td>
          <td>{[p.chamfers?.length ? `צורה קטומה: ${p.chamfers.map((c) => `נשאר ${mm(p.w - c.x)}/${mm(p.h - c.y)}`).join(', ')}` : p.outline ? 'צורה לא מלבנית (לפי DXF)' : '', p.kind === 'waterfall' ? 'גרונג 45° למשטח' : '', p.corner === 'miter' ? 'פינה 45°' : ''].filter(Boolean).join(' · ') || '—'}</td></tr>); })}
      <tr className="sum"><td /><td>{project.pieces.length} חלקים · {stoneName} · {project.thickness} מ"מ</td><td /><td /><td /><td>{project.cutouts.length} פתחים</td><td /><td /></tr>
    </tbody></table>
  );
}

export function JointTable({ project, nest }: { project: Project; nest: NestResult | null }) {
  const rows = jointRows(project, nest);
  if (!rows.length) return <p className="fine">אין חיבורים בהזמנה הזו: כל חלק נחתך מלוח אחד, ואין פינות.</p>;
  return (
    <table className="parts"><thead><tr><th>#</th><th>בין / בתוך</th><th>סוג החיבור</th><th>מיקום</th><th>אורך החיבור (מ"מ)</th><th>הערות</th></tr></thead><tbody>
      {rows.map((r, i) => <tr key={r.key}><td className="mono">{i + 1}</td><td>{r.where}</td><td>{r.type}</td><td>{r.at}</td><td className="mono">{mm(r.len)}</td><td>{r.note || '—'}</td></tr>)}
    </tbody></table>
  );
}

/** טבלת מיקומים לכל לוח: מאיפה נחתך כל חלק (X מהקצה השמאלי, Y מהקצה העליון של הלוח). */
export function SlabTable({ project, nest, slab }: { project: Project; nest: NestResult; slab: number }) {
  const s = nest.slabs[slab], body = s.placements.filter(isBody), other = s.placements.filter((p) => !isBody(p));
  return (
    <table className="parts tight"><thead><tr><th>חלק</th><th>מידה על הלוח</th><th>X</th><th>Y</th><th>כיוון</th></tr></thead><tbody>
      {body.map((pl) => { const p = project.pieces.find((q) => q.id === pl.pieceId); return <tr key={pl.key}><td><b className="mono">{tag(project, pl.pieceId)}{pl.segs > 1 ? pl.seg + 1 : ''}</b> {p?.name}{pl.attached ? ' · צמוד למשטח' : ''}</td><td className="mono">{mm(pl.body.w)}×{mm(pl.body.h)}{pl.strips.length ? ` +${pl.strips.length} קנט` : ''}</td><td className="mono">{mm(pl.body.x)}</td><td className="mono">{mm(pl.body.y)}</td><td>{pl.rot ? 'מסובב 90°' : 'לאורך'}</td></tr>; })}
      {other.map((pl) => <tr key={pl.key}><td>{pl.extra || `קנט ${SIDE_HE[pl.stripOf!]}`} · <span className="mono">{tag(project, pl.pieceId)}</span></td><td className="mono">{mm(pl.block.w)}×{mm(pl.block.h)}</td><td className="mono">{mm(pl.block.x)}</td><td className="mono">{mm(pl.block.y)}</td><td>—</td></tr>)}
      <tr className="sum"><td>לוח {slab + 1} · {cm(s.w)}×{cm(s.h)} ס"מ</td><td>ניצולת {s.used}%</td><td /><td /><td /></tr>
    </tbody></table>
  );
}

/** החותמת של הטופס: מאושר (מי ומתי), או טיוטה. */
export function Stamp({ approval, valid }: { approval?: Approval | null; valid: boolean }) {
  if (approval && valid) return <div className="stamp ok"><b>מאושר לייצור</b><span>אחרי מדידה · {approval.by}</span><span>{when(approval.at)}</span></div>;
  return <div className="stamp"><b>טיוטה · לא מאושר</b><span>{approval ? 'ההזמנה שונתה אחרי האישור' : 'ממתין לאישור אחרי מדידה'}</span></div>;
}

/** אישור אחרי מדידה: בדיקות חוסמות, שם המאשר, והצהרה שהמידות אומתו בשטח. */
export function ApprovePanel({ issues, nest, approval, valid, signedBy, defaultName, busy, onApprove, onRevoke }: { issues: Issue[]; nest: NestResult | null; approval?: Approval | null; valid: boolean; signedBy?: string | null; defaultName: string; busy: boolean; onApprove: (by: string, note: string) => void; onRevoke: () => void }) {
  const [by, setBy] = useState(defaultName), [note, setNote] = useState(''), [sure, setSure] = useState(false);
  const errors = issues.filter((i) => i.level === 'error'), warns = issues.filter((i) => i.level === 'warn');
  const blocks = [...errors.map((e) => e.title), ...(nest?.overlaps.length ? ['חלקים חופפים או חורגים מהלוח בפריסה'] : []), ...(nest?.unplaced.length ? [`${nest.unplaced.length} חלקים לא נכנסים ללוח`] : [])];
  if (approval && valid) return (
    <div className="approve ok noprint"><div><b>✓ ההזמנה מאושרת לייצור</b><p>אושרה אחרי מדידה על ידי {approval.by}, {when(approval.at)}.{approval.note ? ` הערה: ${approval.note}` : ''} כל שינוי במידות, בחיבורים או בפריסה יבטל את האישור.</p></div><button className="link" disabled={busy} onClick={onRevoke}>ביטול האישור</button></div>
  );
  return (
    <div className="approve noprint">
      <div><b>{approval ? 'ההזמנה שונתה אחרי האישור: צריך לאשר שוב' : 'אישור אחרי מדידה'}</b><p>הטופס למפעל יוצא רק אחרי אישור. מאשרים כשהמידות בהזמנה הן המידות שנמדדו בשטח.</p></div>
      <ul>
        <li className={blocks.length ? 'bad' : 'good'}>{blocks.length ? `חוסם: ${blocks.join(' · ')}` : 'אין שגיאות בבדיקה, וכל החלקים נכנסים ללוחות'}</li>
        {!!warns.length && <li className="warn">{warns.length} התראות לבדיקה (לא חוסם): {warns.slice(0, 3).map((w) => w.title).join(' · ')}{warns.length > 3 ? '…' : ''}</li>}
        <li className={signedBy ? 'good' : 'warn'}>{signedBy ? `הלקוח אישר את ההדמיה בחתימה (${signedBy})` : 'הלקוח עוד לא חתם על ההדמיה (לא חוסם)'}</li>
      </ul>
      <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '1 1 180px' }}>שם המאשר<input className="input" value={by} onChange={(e) => setBy(e.target.value)} /></label>
        <label className="field" style={{ flex: '2 1 240px' }}>הערה למפעל (לא חובה)<input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      </div>
      <label className="row chk"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />המידות, הפתחים והחיבורים אומתו במדידה בשטח</label>
      <button className="btn primary big" disabled={busy || !sure || by.trim().length < 2 || blocks.length > 0} onClick={() => onApprove(by.trim(), note.trim())}>{busy ? <span className="spin" /> : 'אישור לייצור והפקת הטופס'}</button>
    </div>
  );
}
