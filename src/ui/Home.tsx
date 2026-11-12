import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Customer, Order, STATUS_HE, isLocal, repo } from '../data/repo';
import { Project, TEMPLATES, TemplateId, emptyProject, fromTemplate } from '../core/model';
import { DxfInfo, parseDxf } from '../core/dxf';
import { ai, applyDraft } from '../ai';
import { go, useStore } from '../store';
import { Icon } from './icons';
import { asset } from './util';
import { signOut } from './App';

type OrderRow = Omit<Order, 'project'>;
const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
const day = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, [onClose]);
  // דרך portal: חלון קופץ שנפתח מתוך פאנל "זכוכית" היה נכלא בתוכו
  return createPortal(
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}><h2>{title}</h2>{children}</div>
    </div>, document.body);
}

export function Home({ customerId, admin, email }: { customerId?: string; admin: boolean; email?: string }) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [newOrder, setNewOrder] = useState(false);
  const setToast = useStore((s) => s.setToast);

  const load = () => Promise.all([repo.customers(), repo.orders()]).then(([c, o]) => { setCustomers(c); setOrders(o); }).catch((e) => { setCustomers([]); setToast(e.message); });
  useEffect(() => { load(); }, []);

  const current = customers?.find((c) => c.id === customerId);
  const shown = useMemo(() => (customers || []).filter((c) => !q || `${c.name} ${c.phone || ''} ${c.address || ''}`.toLowerCase().includes(q.toLowerCase())), [customers, q]);
  const list = current ? orders.filter((o) => o.customer_id === current.id) : orders.slice(0, 12);
  const count = (id: string) => orders.filter((o) => o.customer_id === id).length;

  async function saveCustomer() {
    if (!editing?.name?.trim()) return;
    try { const fresh = !editing.id; const c = await repo.saveCustomer({ ...editing, name: editing.name.trim() }); setEditing(null); await load(); go(`/c/${c.id}`); if (fresh) setNewOrder(true); } catch (e) { setToast((e as Error).message); }
  }
  async function removeCustomer(c: Customer) {
    if (!confirm(`למחוק את "${c.name}" ואת כל ${count(c.id)} ההזמנות שלו? אי אפשר לבטל.`)) return;
    await repo.deleteCustomer(c.id); setEditing(null); go('/'); load();
  }
  async function removeOrder(o: OrderRow) { if (!confirm(`למחוק את ההזמנה "${o.title}"?`)) return; await repo.deleteOrder(o.id); load(); }

  return (
    <>
      <header className="top">
        <img className="logo" src={asset('logo.png')} alt="Barstone" onClick={() => go('/')} />
        <span className="sp" />
        {isLocal && <span className="badge sand">מצב הדגמה · נשמר בדפדפן הזה בלבד</span>}
        {admin && !isLocal && <button className="btn sm" onClick={() => go('/catalog')}><Icon.grid />קטלוג ומלאי</button>}
        {admin && !isLocal && <button className="btn sm" onClick={() => go('/team')}><Icon.team />צוות</button>}
        {email && <button className="btn sm" title={email} onClick={signOut}><Icon.out />יציאה</button>}
      </header>
      <main className="home">
        <aside className="side glass">
          <div className="row"><span className="cap">לקוחות</span><span className="sp" /><button className="btn sm primary" onClick={() => setEditing({ name: '' })}><Icon.plus />לקוח חדש</button></div>
          <input id="csearch" className="input" placeholder="חיפוש לפי שם, טלפון או כתובת" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="clist">
            {customers === null && <div className="mute" style={{ padding: 12 }}>טוען…</div>}
            {customers?.length === 0 && <div className="mute" style={{ padding: 12 }}>עוד אין לקוחות. התחילו ב"לקוח חדש".</div>}
            {shown.map((c) => (
              <button key={c.id} className={`citem ${c.id === customerId ? 'on' : ''}`} onClick={() => go(`/c/${c.id}`)}>
                <span className="avatar">{initials(c.name)}</span>
                <span style={{ minWidth: 0, flex: 1 }}><b>{c.name}</b><small>{count(c.id)} הזמנות{c.phone ? ` · ${c.phone}` : ''}</small></span>
              </button>
            ))}
          </div>
        </aside>
        <section className="col" style={{ gap: 18 }}>
          {current ? (
            <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <a className="link mute" onClick={() => go('/')} style={{ fontSize: 13, cursor: 'pointer' }}>כל ההזמנות</a>
                <h1>{current.name}</h1>
                <p className="mute">{[current.phone, current.email, current.address].filter(Boolean).join(' · ') || 'אין פרטי קשר'}</p>
              </div>
              <span className="sp" />
              <button className="btn" onClick={() => setEditing(current)}>עריכת פרטים</button>
              <button className="btn primary" onClick={() => setNewOrder(true)}><Icon.plus />הזמנה חדשה</button>
            </div>
          ) : (
            <>
              <div><h1>מה עושים היום?</h1><p className="mute">שלב ראשון: לקוח חדש, או ממשיכים הזמנה קיימת.</p></div>
              <div className="starts">
                <button className="start dark" onClick={() => setEditing({ name: '' })}><Icon.plus /><b>לקוח חדש</b><small>פרטי לקוח › מידות (תבנית, DXF או צילום) › אבן › עיצוב › מסמך</small></button>
                <button className="start" onClick={() => document.getElementById('csearch')?.focus()}><Icon.search /><b>לקוח או הזמנה קיימת</b><small>מחפשים לקוח ברשימה, או בוחרים מההזמנות האחרונות למטה</small></button>
              </div>
              {!!list.length && <span className="cap">הזמנות אחרונות</span>}
            </>
          )}
          {current?.notes && <div className="note">{current.notes}</div>}
          <div className="cards">
            {current && <button className="ocard new" onClick={() => setNewOrder(true)}><Icon.plus />הזמנה חדשה</button>}
            {list.map((o) => (
              <div key={o.id} className="ocard" role="button" tabIndex={0} onClick={() => go(`/o/${o.id}`)} onKeyDown={(e) => e.key === 'Enter' && go(`/o/${o.id}`)}>
                <div className="row"><span className={`badge ${o.status === 'approved' || o.status === 'done' ? 'ok' : o.status === 'draft' ? '' : 'sand'}`}>{STATUS_HE[o.status]}</span><span className="sp" />{o.order_no && <span className="mono mute">#{o.order_no}</span>}</div>
                <div><h3>{o.title}</h3>{!current && <span className="mute">{customers?.find((c) => c.id === o.customer_id)?.name}</span>}</div>
                <div className="nums"><div><b>{o.metrics.slabs ?? '–'}</b>לוחות</div><div><b>{o.metrics.utilization != null ? `${o.metrics.utilization}%` : '–'}</b>ניצולת</div><div><b>{o.metrics.rm ?? '–'}</b>מטר רץ</div></div>
                <div className="row mute" style={{ fontSize: 12 }}><span>עודכן {day(o.updated_at)}</span><span className="sp" />{!!o.metrics.issues && <span className="badge err">{o.metrics.issues} לבדיקה</span>}
                  <button className="link" onClick={(e) => { e.stopPropagation(); removeOrder(o); }}>מחיקה</button></div>
              </div>
            ))}
          </div>
          {!list.length && !current && customers !== null && <div className="empty glass"><h2>עדיין אין הזמנות</h2><p>צרו לקוח, ופתחו לו הזמנה מתבנית, מקובץ DXF או מצילום תוכנית.</p></div>}
        </section>
      </main>
      {editing && (
        <Modal title={editing.id ? 'פרטי לקוח' : 'לקוח חדש'} onClose={() => setEditing(null)}>
          <label className="field">שם הלקוח<input autoFocus value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && saveCustomer()} /></label>
          <div className="grid2">
            <label className="field">טלפון<input dir="ltr" value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></label>
            <label className="field">אימייל<input dir="ltr" value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></label>
          </div>
          <label className="field">כתובת<input value={editing.address || ''} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></label>
          <label className="field">הערות<textarea rows={2} value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></label>
          <div className="row">{editing.id && <button className="btn danger" onClick={() => removeCustomer(editing as Customer)}><Icon.trash />מחיקת לקוח</button>}<span className="sp" /><button className="btn" onClick={() => setEditing(null)}>ביטול</button><button className="btn primary" disabled={!editing.name?.trim()} onClick={saveCustomer}>שמירה</button></div>
        </Modal>
      )}
      {newOrder && current && <NewOrder customer={current} onClose={() => setNewOrder(false)} />}
    </>
  );
}

const SHAPES: Record<TemplateId, string> = {
  straight: '<rect x="4" y="6" width="46" height="9" rx="1.5"/>', l: '<path d="M4 6h46v28h-9V15H4z"/>', u: '<path d="M4 6h46v28h-9V15H13v19H4z"/>',
  island: '<rect x="4" y="6" width="46" height="9" rx="1.5"/><rect x="14" y="24" width="26" height="10" rx="1.5"/>', 'l-island': '<path d="M4 6h46v28h-9V15H4z"/><rect x="6" y="24" width="26" height="10" rx="1.5"/>',
};

function NewOrder({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const [way, setWay] = useState<'template' | 'dxf' | 'plan' | 'photo'>('template');
  const [tpl, setTpl] = useState<TemplateId>('straight');
  const [title, setTitle] = useState('מטבח'), [no, setNo] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [dxf, setDxf] = useState<{ text: string; name: string; project: Project; info: DxfInfo } | null>(null);
  const [plan, setPlan] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const setToast = useStore((s) => s.setToast);

  async function pick(f: File | undefined) {
    if (!f) return; setErr('');
    if (way === 'dxf') {
      if (!/\.dxf$/i.test(f.name)) return setErr('צריך קובץ בסיומת ‎.dxf (אם יש לכם DWG — ייצאו אותו ל-DXF).');
      try { const text = await f.text(); setDxf({ text, name: f.name, ...parseDxf(text, title) }); if (title === 'מטבח') setTitle(f.name.replace(/\.dxf$/i, '')); } catch (e) { setDxf(null); setErr((e as Error).message); }
    } else setPlan(f);
  }
  function pickWay(w: typeof way) { setWay(w); setPlan(null); setErr('');
  }
  const rescale = (scale: number) => { if (dxf) try { setDxf({ ...dxf, ...parseDxf(dxf.text, title, scale || undefined) }); } catch (e) { setErr((e as Error).message); } };

  async function create() {
    setBusy(true); setErr('');
    try {
      let project: Project;
      if (way === 'template') project = fromTemplate(tpl, title);
      else if (way === 'dxf') { if (!dxf) throw new Error('בחרו קובץ DXF.'); project = { ...dxf.project, name: title }; }
      else {
        if (!plan) throw new Error('בחרו צילום או PDF של התוכנית.');
        const r = await ai.fromPlan(plan, way === 'photo');
        if (!r.draft?.pieces?.length) throw new Error(r.reply || 'לא הצלחתי לזהות משטחים.');
        project = { ...applyDraft(emptyProject(title), r.draft), source: 'plan', notes: [r.reply, ...(r.assumptions || []).map((a) => `• ${a}`)].filter(Boolean).join('\n') };
      }
      const o = await repo.createOrder({ customer_id: customer.id, title: title.trim() || 'מטבח', order_no: no.trim() || undefined, project });
      if (way === 'plan') setToast('התוכנית זוהתה — כדאי לעבור על המידות');
      if (way === 'photo') setToast('המידות מהצילום משוערות — חובה לאמת במדידה');
      go(`/o/${o.id}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Modal title={`הזמנה חדשה · ${customer.name}`} onClose={onClose} wide>
      <div className="grid2">
        <label className="field">שם ההזמנה<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="field">מספר הזמנה (לא חובה)<input dir="ltr" value={no} onChange={(e) => setNo(e.target.value)} /></label>
      </div>
      <div className="ways">
        <button className={`way ${way === 'template' ? 'on' : ''}`} onClick={() => pickWay('template')}><Icon.grid /><b>התחלה מתבנית</b><small>בוחרים צורה ומשנים מידות בגרירה</small></button>
        <button className={`way ${way === 'dxf' ? 'on' : ''}`} onClick={() => pickWay('dxf')}><Icon.file /><b>מדידה קיימת · DXF</b><small>כל המידות והפתחים נקראים מהקובץ, ישר לנסטינג</small></button>
        <button className={`way ${way === 'plan' ? 'on' : ''}`} onClick={() => pickWay('plan')}><Icon.camera /><b>צילום תוכנית</b><small>מצלמים תוכנית או דף מדידה, והמטבח נבנה לבד</small></button>
        <button className={`way ${way === 'photo' ? 'on' : ''}`} onClick={() => pickWay('photo')}><Icon.user /><b>צילום המטבח הקיים</b><small>הלקוח שולח תמונה, ומקבלים נקודת התחלה משוערת עוד לפני המדידה</small></button>
      </div>
      {way === 'template' && <div className="shapes">{TEMPLATES.map((t) => (
        <button key={t.id} className={`shape ${tpl === t.id ? 'on' : ''}`} onClick={() => setTpl(t.id)}><svg viewBox="0 0 54 40" fill="#D9C7A6" stroke="#8a744d" strokeWidth="1" dangerouslySetInnerHTML={{ __html: SHAPES[t.id] }} />{t.name}</button>
      ))}</div>}
      {way !== 'template' && (
        <>
          <input ref={input} type="file" hidden accept={way === 'dxf' ? '.dxf' : 'image/*,application/pdf'} onChange={(e) => pick(e.target.files?.[0])} />
          <div className={`drop ${over ? 'over' : ''}`} onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}>
            {way === 'dxf' ? (dxf ? <b>{dxf.name}</b> : <>גררו לכאן קובץ <b>DXF</b> או לחצו לבחירה</>) : plan ? <b>{plan.name}</b> : way === 'photo' ? <>גררו לכאן <b>תמונה של המטבח הקיים</b>, או לחצו לבחירה</> : <>גררו לכאן <b>צילום או PDF</b> של התוכנית, או לחצו לבחירה</>}
          </div>
        </>
      )}
      {way === 'dxf' && dxf && (
        <div className="col">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <span className="badge ok">{dxf.info.pieces} חלקים</span><span className="badge">{dxf.info.cutouts} פתחים</span><span className="badge">יחידות: {dxf.info.units}</span><span className="sp" />
            <label className="row mute" style={{ fontSize: 12 }}>המידות לא נכונות?
              <select className="input" style={{ width: 'auto', padding: '4px 8px', fontSize: 12.5 }} defaultValue="" onChange={(e) => rescale(+e.target.value)}><option value="">זיהוי אוטומטי</option><option value="1">מ"מ</option><option value="10">ס"מ</option><option value="1000">מטר</option><option value="25.4">אינץ׳</option></select>
            </label>
          </div>
          <div className="mono mute" style={{ fontSize: 12 }}>{dxf.project.pieces.map((p) => `${p.w}×${p.h}`).join('  ·  ')}</div>
          {dxf.info.warnings.map((w) => <div key={w} className="note">{w}</div>)}
        </div>
      )}
      {way === 'photo' && <div className="note">מהתמונה מזהים את צורת המטבח ומעריכים מידות לפי גודל הארונות. זו הערכה בלבד (פלוס־מינוס 10–15 ס"מ) — חובה לאמת במדידה.</div>}
      {way === 'plan' && <div className="note">הזיהוי נעשה בבינה מלאכותית ונמשך כחצי דקה. תמיד עוברים על המידות אחרי — במיוחד בצילום של כתב יד.</div>}
      {err && <div className="note err">{err}</div>}
      <div className="row"><span className="sp" /><button className="btn" onClick={onClose}>ביטול</button>
        <button className="btn primary" disabled={busy || (way === 'dxf' && !dxf?.info.pieces) || ((way === 'plan' || way === 'photo') && !plan)} onClick={create}>{busy ? <><span className="spin" />{way === 'plan' ? 'מזהה את התוכנית…' : way === 'photo' ? 'מנתח את התמונה…' : 'יוצר…'}</> : 'פתיחת הסטודיו'}</button></div>
    </Modal>
  );
}
