// מסמך ללקוח: סיכום ההזמנה להדפסה / שמירה כ-PDF.
import { factorHe, runningMeters } from '../core/pricing';
import { stoneLabel } from '../data/repo';
import { CUT_HE, corners, isVertical, letter } from '../core/model';
import { go, useStore } from '../store';
import { Icon } from './icons';
import { asset } from './util';
import { Slabs } from './Slabs';
import { useOrder } from './Studio';
import { cm, m2, useStone } from './util';
import { View3D } from './View3D';

export function Doc({ id }: { id: string }) {
  const { order, customer, missing } = useOrder(id);
  const project = useStore((s) => s.project), nest = useStore((s) => s.nest), stone = useStone();
  const rm = project ? runningMeters(project) : { rows: [], total: 0 };
  if (missing) return <div className="login"><div className="box glass"><h1>ההזמנה לא נמצאה</h1><button className="btn primary" onClick={() => go('/')}>חזרה</button></div></div>;
  if (!order || !project) return <div className="login"><div className="spin dark" /></div>;
  return (
    <>
      <header className="top noprint doctop"><img className="logo" src={asset('logo.png')} alt="Barstone" onClick={() => go('/')} /><div className="crumb"><a onClick={() => go(`/o/${id}`)}>חזרה לסטודיו</a></div><span className="sp" /><button className="btn primary" onClick={() => print()}><Icon.download /><span>שמירה כ-PDF / הדפסה</span></button></header>
      <main className="doc">
        <div className="sheet">
          <div className="row"><img src={asset('logo.png')} alt="Barstone" style={{ height: 22 }} /><span className="sp" /><span className="cap">הדמיית משטח אבן</span></div>
          <div><h1>{order.title}</h1><p className="mute" style={{ fontSize: 16 }}>{[customer?.name, customer?.address].filter(Boolean).join(' · ')}</p></div>
          <div className="docshot"><View3D still /></div>
          <div className="facts">
            <div><small>תאריך</small><b>{new Date().toLocaleDateString('he-IL')}</b></div><div><small>מספר הזמנה</small><b>{order.order_no || '—'}</b></div>
            <div><small>אבן</small><b>{stone.name ? stoneLabel(stone) : '—'}</b></div><div><small>עובי · קנט</small><b>{project.thickness} · {project.apronH || 'בלי'} מ"מ</b></div>
            <div><small>לוחות</small><b>{nest?.metrics.slabs ?? 0}</b></div><div><small>שטח משטחים</small><b>{m2(nest?.metrics.pieceArea || 0)} מ"ר</b></div>
            <div><small>חיבורים</small><b>{nest?.metrics.joints ?? 0}</b></div><div><small>מידת לוח</small><b>{cm(project.slabW)}×{cm(project.slabH)} ס"מ</b></div>
          </div>
          <table><thead><tr><th>#</th><th>חלק</th><th>מידות (ס"מ)</th><th>פתחים</th><th>קנט</th></tr></thead><tbody>
            {project.pieces.map((p, i) => <tr key={p.id}><td><span className="mono">{letter(i)}</span></td><td>{p.name}</td><td><span className="mono">{cm(p.w)} × {cm(p.h)}</span></td>
              <td>{project.cutouts.filter((c) => c.pieceId === p.id).map((c) => `${c.name || CUT_HE[c.kind]} ${c.round ? `Ø${cm(c.w)}` : `${cm(c.w)}×${cm(c.h)}`}`).join(' · ') || '—'}</td><td>{isVertical(p) || !p.aprons.length || !project.apronH ? '—' : `${p.aprons.length} צדדים`}</td></tr>)}
          </tbody></table>
          <div><span className="cap">מטר רץ לחישוב · סה"כ {rm.total.toFixed(2)}</span><table style={{ marginTop: 6 }}><thead><tr><th>חלק</th><th>אורך × רוחב (ס"מ)</th><th>מקדם לפי רוחב</th><th>מטר רץ</th></tr></thead><tbody>{rm.rows.map((r) => <tr key={r.id}><td>{r.name}</td><td><span className="mono">{cm(r.len)} × {cm(r.wid)}</span></td><td>{factorHe(r.factor)}</td><td><span className="mono">{r.rm.toFixed(2)}</span></td></tr>)}</tbody></table></div>
          <div><span className="cap">פריסה על הלוחות</span><div className="docslabs" style={{ marginTop: 8 }}><Slabs readOnly /></div></div>
          <div><span className="cap">חיבורים ומוצרים נלווים</span>
            <ul style={{ margin: '8px 0 0', paddingInlineStart: 18, fontSize: 13.5, lineHeight: 1.7 }}>
              {(nest?.joints || []).map((j, n) => { const q = project.pieces.find((x) => x.id === j.pieceId); return <li key={n}>חיבור ב"{q?.name}" — {Math.round(j.at / 10)} ס"מ מתחילת החלק{q?.joint === 'sink' ? ' (במרכז הכיור)' : q?.joint === 'cooktop' ? ' (במרכז הכיריים)' : ''}</li>; })}
              {corners(project).map((c) => <li key={c.b.id}>חיבור פינה {c.miter ? 'בגרונג 45°' : 'ישר'} — "{c.b.name}"</li>)}
              {!nest?.joints.length && !corners(project).length && <li>אין חיבורים</li>}
              <li>בוק־מאץ׳: {project.bookmatch === 'yes' ? 'כן' : project.bookmatch === 'no' ? 'לא' : 'לא נקבע'}</li>
              {project.cutouts.filter((c) => c.kind === 'sink').map((c) => <li key={c.id}>כיור {c.built ? 'בנוי מאבן' : 'קנוי'}{c.bowls === 'even' ? ', כפול חצי־חצי' : c.bowls === 'ls' ? ', כפול גדול + קטן' : ''}{c.cabinet ? `, ארון ${c.cabinet / 10}` : ''} — נטו משוער {cm(c.w)}×{cm(c.h)} ס"מ</li>)}
              {project.disposal && <li>טוחן אשפה</li>}{project.water && <li>מערכת מים</li>}
            </ul>
          </div>
          <div className="note"><b>אין התחייבות לגידים.</b> מיקום, כיוון וגוון הגידים בפועל משתנים מלוח ללוח, וההדמיה היא המחשה בלבד.</div>
          <p className="mute" style={{ fontSize: 12 }}>ההדמיה להמחשה בלבד. גוון וגידים באבן טבעית ובפורצלן משתנים מלוח ללוח; המידות הסופיות ייקבעו במדידה בשטח.</p>
        </div>
      </main>
    </>
  );
}
