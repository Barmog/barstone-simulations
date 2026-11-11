// מסמך ללקוח: סיכום ההזמנה להדפסה / שמירה כ-PDF.
import { CUT_HE, isVertical, letter } from '../core/model';
import { go, useStore } from '../store';
import { Icon } from './icons';
import { Slabs } from './Slabs';
import { useOrder } from './Studio';
import { cm, m2, useStone } from './util';
import { View3D } from './View3D';

export function Doc({ id }: { id: string }) {
  const { order, customer, missing } = useOrder(id);
  const project = useStore((s) => s.project), nest = useStore((s) => s.nest), stone = useStone();
  if (missing) return <div className="login"><div className="box glass"><h1>ההזמנה לא נמצאה</h1><button className="btn primary" onClick={() => go('/')}>חזרה</button></div></div>;
  if (!order || !project) return <div className="login"><div className="spin dark" /></div>;
  return (
    <>
      <header className="top noprint"><img className="logo" src="/logo.png" alt="Barstone" onClick={() => go('/')} /><div className="crumb"><a onClick={() => go(`/o/${id}`)}>חזרה לסטודיו</a></div><span className="sp" /><button className="btn primary" onClick={() => print()}><Icon.download />שמירה כ-PDF / הדפסה</button></header>
      <main className="doc">
        <div className="sheet">
          <div className="row"><img src="/logo.png" alt="Barstone" style={{ height: 22 }} /><span className="sp" /><span className="cap">הדמיית משטח אבן</span></div>
          <div><h1>{order.title}</h1><p className="mute" style={{ fontSize: 16 }}>{[customer?.name, customer?.address].filter(Boolean).join(' · ')}</p></div>
          <div style={{ height: 420, borderRadius: 20, overflow: 'hidden' }}><View3D still /></div>
          <div className="facts">
            <div><small>תאריך</small><b>{new Date().toLocaleDateString('he-IL')}</b></div><div><small>מספר הזמנה</small><b>{order.order_no || '—'}</b></div>
            <div><small>אבן</small><b>{stone.name || '—'}</b></div><div><small>עובי · קנט</small><b>{project.thickness} · {project.apronH || 'בלי'} מ"מ</b></div>
            <div><small>לוחות</small><b>{nest?.metrics.slabs ?? 0}</b></div><div><small>שטח משטחים</small><b>{m2(nest?.metrics.pieceArea || 0)} מ"ר</b></div>
            <div><small>חיבורים</small><b>{nest?.metrics.joints ?? 0}</b></div><div><small>מידת לוח</small><b>{cm(project.slabW)}×{cm(project.slabH)} ס"מ</b></div>
          </div>
          <table><thead><tr><th>#</th><th>חלק</th><th>מידות (ס"מ)</th><th>פתחים</th><th>קנט</th></tr></thead><tbody>
            {project.pieces.map((p, i) => <tr key={p.id}><td><span className="mono">{letter(i)}</span></td><td>{p.name}</td><td><span className="mono">{cm(p.w)} × {cm(p.h)}</span></td>
              <td>{project.cutouts.filter((c) => c.pieceId === p.id).map((c) => `${c.name || CUT_HE[c.kind]} ${c.round ? `Ø${cm(c.w)}` : `${cm(c.w)}×${cm(c.h)}`}`).join(' · ') || '—'}</td><td>{isVertical(p) || !p.aprons.length || !project.apronH ? '—' : `${p.aprons.length} צדדים`}</td></tr>)}
          </tbody></table>
          <div><span className="cap">פריסה על הלוחות</span><div className="docslabs" style={{ marginTop: 8 }}><Slabs /></div></div>
          <p className="mute" style={{ fontSize: 12 }}>ההדמיה להמחשה בלבד. גוון וגידים באבן טבעית ובפורצלן משתנים מלוח ללוח; המידות הסופיות ייקבעו במדידה בשטח.</p>
        </div>
      </main>
    </>
  );
}
