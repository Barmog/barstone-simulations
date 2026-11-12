// משובים מהצוות: כפתור קבוע בכל מסך ("משוב"), שנשמר עם המסך המדויק שבו נכתב — וכך אפשר לשפר כל הזמן.
// המנהל רואה את כל ההערות במסך "משובים", מסמן "בטיפול" / "שופר" וכותב תשובה.
import { useEffect, useMemo, useState } from 'react';
import { FB_KIND_HE, FB_STATUS_HE, FbKind, FbStatus, Feedback, repo } from '../data/repo';
import { Route, go, useStore } from '../store';
import { STEPS } from './Panels';
import { Modal } from './Home';
import { asset } from './util';

/** שם המסך בעברית (כולל השלב בסטודיו), כדי שכל הערה תגיע עם ההקשר שלה. */
export function screenName(route: Route, step?: string): string {
  switch (route.name) {
    case 'studio': return `סטודיו · ${STEPS.find((s) => s.id === step)?.name || ''}`;
    case 'doc': return 'מסמך ללקוח';
    case 'home': return route.customer ? 'כרטיס לקוח' : 'הזמנות';
    case 'catalog': return 'קטלוג ומלאי';
    case 'team': return 'צוות';
    case 'fireberry': return 'פיירברי';
    case 'feedback': return 'משובים';
    default: return route.name;
  }
}

export function FeedbackButton({ route, email }: { route: Route; email?: string }) {
  const [open, setOpen] = useState(false), [kind, setKind] = useState<FbKind>('idea'), [text, setText] = useState(''), [busy, setBusy] = useState(false);
  const step = useStore((s) => s.step), order = useStore((s) => s.order), setToast = useStore((s) => s.setToast);
  const screen = screenName(route, step);
  async function send() {
    if (text.trim().length < 2) return; setBusy(true);
    try {
      await repo.sendFeedback({ kind, text: text.trim(), route: location.hash || '#/', screen, order_id: route.name === 'studio' || route.name === 'doc' ? order?.id || null : null, email });
      setText(''); setOpen(false); setToast('תודה! ההערה נשמרה ותיכנס לשיפור הבא');
    } catch (e) { setToast(`השליחה נכשלה: ${(e as Error).message}`); }
    setBusy(false);
  }
  return (
    <>
      <button className="fb-fab noprint" onClick={() => setOpen(true)} title="הערה, תקלה או רעיון על המסך הזה">💬 משוב</button>
      {open && <Modal title="משוב על המסך הזה" onClose={() => setOpen(false)}>
        <span className="badge sand" style={{ alignSelf: 'flex-start' }}>{screen}</span>
        <div className="chips">{(Object.keys(FB_KIND_HE) as FbKind[]).map((k) => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{FB_KIND_HE[k]}</button>)}</div>
        <textarea className="input" rows={5} autoFocus placeholder="מה לא נוח, מה חסר, מה היה עוזר לכם? גם הערה קטנה עוזרת." value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && send()} />
        <small className="mute">ההערה נשמרת יחד עם המסך{order && (route.name === 'studio' || route.name === 'doc') ? ` וההזמנה "${order.title}"` : ''}, כדי שנדע בדיוק על מה מדובר.</small>
        <div className="row"><span className="sp" /><button className="btn" onClick={() => setOpen(false)}>ביטול</button><button className="btn primary" disabled={busy || text.trim().length < 2} onClick={send}>{busy ? <span className="spin" /> : 'שליחה'}</button></div>
      </Modal>}
    </>
  );
}

export function FeedbackPage({ admin }: { admin: boolean }) {
  const [list, setList] = useState<Feedback[] | null>(null), [filter, setFilter] = useState<FbStatus | 'all' | 'open'>('open'), [kind, setKind] = useState<FbKind | 'all'>('all');
  const setToast = useStore((s) => s.setToast);
  const load = () => repo.feedback().then(setList).catch((e) => { setToast((e as Error).message); setList([]); });
  useEffect(() => { load(); }, []);
  const shown = useMemo(() => (list || []).filter((f) => (filter === 'all' || (filter === 'open' ? f.status === 'new' || f.status === 'doing' : f.status === filter)) && (kind === 'all' || f.kind === kind)), [list, filter, kind]);
  const count = (st: FbStatus) => (list || []).filter((f) => f.status === st).length;
  async function patch(f: Feedback, p: Partial<Pick<Feedback, 'status' | 'reply'>>) { await repo.updateFeedback(f.id, p).catch((e) => setToast((e as Error).message)); setList((l) => (l || []).map((x) => (x.id === f.id ? { ...x, ...p } : x))); }
  return (
    <>
      <header className="top"><img className="logo" src={asset('logo.png')} alt="Barstone" onClick={() => go('/')} /><div className="crumb"><a onClick={() => go('/')}>הזמנות</a><i>›</i><b>משובים</b></div></header>
      <main className="doc">
        <div className="sheet">
          <div><h1 style={{ fontSize: 26 }}>משובים מהצוות</h1><p className="mute">כל הערה שנכתבה בכפתור "משוב", עם המסך שבו נכתבה. {count('new')} חדשות · {count('doing')} בטיפול · {count('done')} שופרו.</p></div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="seg">{([['open', 'פתוחות'], ['new', 'חדשות'], ['doing', 'בטיפול'], ['done', 'שופרו'], ['all', 'הכול']] as const).map(([k, v]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{v}</button>)}</div>
            <div className="chips">{(['all', ...Object.keys(FB_KIND_HE)] as (FbKind | 'all')[]).map((k) => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{k === 'all' ? 'כל הסוגים' : FB_KIND_HE[k]}</button>)}</div>
          </div>
          {list === null ? <span className="spin dark" /> : !shown.length ? <div className="mute">אין הערות כאן.</div> : <div className="fblist">{shown.map((f) => (
            <div key={f.id} className={`fbitem ${f.status}`}>
              <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
                <span className={`badge ${f.kind === 'bug' ? 'err' : f.kind === 'idea' ? 'ok' : 'sand'}`}>{FB_KIND_HE[f.kind]}</span><span className="badge">{f.screen || f.route}</span>
                {f.order_id && <a className="link" onClick={() => go(`/o/${f.order_id}`)}>להזמנה</a>}<span className="sp" />
                <small className="mute">{f.email || ''} · {new Date(f.created_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</small>
              </div>
              <p>{f.text}</p>
              {admin ? <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div className="seg">{(Object.keys(FB_STATUS_HE) as FbStatus[]).map((st) => <button key={st} className={f.status === st ? 'on' : ''} onClick={() => patch(f, { status: st })}>{FB_STATUS_HE[st]}</button>)}</div>
                <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="תשובה לצוות (לא חובה)" defaultValue={f.reply || ''} onBlur={(e) => e.target.value !== (f.reply || '') && patch(f, { reply: e.target.value })} />
              </div> : <div className="row"><span className="badge">{FB_STATUS_HE[f.status]}</span>{f.reply && <span className="mute">{f.reply}</span>}</div>}
            </div>))}</div>}
        </div>
      </main>
    </>
  );
}
