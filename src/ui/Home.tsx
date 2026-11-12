import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Customer, Order, STATUS_HE, exitDemo, isDemoOnLive, isLocal, repo } from '../data/repo';
import { Project, TEMPLATES, TemplateId, emptyProject, fromTemplate } from '../core/model';
import { DxfInfo, parseDxf } from '../core/dxf';
import { ai, applyDraft } from '../ai';
import { go, useStore } from '../store';
import { Icon } from './icons';
import { asset } from './util';
import { signOut } from './App';
import { FbAccount, FbFile, FbMeasure, FbOrder, FbRecord, fireberry } from '../data/fireberry';

type OrderRow = Omit<Order, 'project'>;
const norm = (x?: string | null) => (x || '').replace(/[\s"'׳״.,\-()]/g, '').toLowerCase();
const tail = (x?: string | null) => (x || '').replace(/\D/g, '').slice(-9);
/** לקוח קיים במערכת שמתאים ללקוח מפיירברי: לפי הקישור, לפי טלפון או לפי שם זהה. */
function matchLocal(list: Customer[], a: FbAccount | null): { c: Customer; how: 'fb' | 'phone' | 'name' } | null {
  if (!a) return null;
  const byFb = list.find((x) => x.fb_id === a.id); if (byFb) return { c: byFb, how: 'fb' };
  const t = tail(a.phone), byPhone = t.length >= 9 ? list.find((x) => tail(x.phone) === t) : undefined; if (byPhone) return { c: byPhone, how: 'phone' };
  const n = norm(a.name), byName = n.length >= 3 ? list.find((x) => norm(x.name) === n) : undefined; return byName ? { c: byName, how: 'name' } : null;
}
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
  const [newOrder, setNewOrder] = useState<boolean | FbRecord>(false), [find, setFind] = useState(false);
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
        {isLocal && <span className="badge sand"><span className="demo-long">מצב הדגמה · נתוני דוגמה, נשמר בדפדפן הזה בלבד</span><span className="demo-short">דמו</span></span>}
        {isDemoOnLive && <button className="link" onClick={exitDemo}>יציאה מהדמו</button>}
        {admin && !isLocal && <button className="btn sm" onClick={() => go('/catalog')}><Icon.grid />קטלוג ומלאי</button>}
        {!isLocal && <button className="btn sm primary" onClick={() => setFind(true)}><Icon.link />פתיחה מהזמנה בפיירברי</button>}
        {!isLocal && <button className="btn sm" onClick={() => go('/fireberry')}>פיירברי</button>}
        <button className="btn sm" onClick={() => go('/feedback')}>משובים</button>
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
          {!isLocal && !editing.id && <FbPicker onPick={(a) => setEditing({ ...editing, name: a.name, phone: a.phone || editing.phone, email: a.email || editing.email, address: a.address || editing.address, fb_id: a.id })} />}
          {editing.fb_id && <span className="badge ok" style={{ alignSelf: 'flex-start' }}>מקושר ללקוח בפיירברי</span>}
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
      {newOrder && current && <NewOrder customer={current} preset={typeof newOrder === 'object' ? newOrder : undefined} onClose={() => setNewOrder(false)} />}
      {find && <FbFind customers={customers || []} onClose={() => setFind(false)} onOpen={async (o) => {
        // הזמנה שכבר נפתחה במערכת — נכנסים אליה; אחרת: הלקוח (קיים או חדש) והזמנה חדשה מקושרת
        const exist = orders.find((x) => (x as { fb_id?: string }).fb_id === o.id); if (exist) { setFind(false); go(`/o/${exist.id}`); return; }
        const hit = matchLocal(customers || [], o.account); let c = hit?.c;
        if (c && o.account && !c.fb_id) c = await repo.saveCustomer({ ...c, fb_id: o.account.id, phone: c.phone || o.account.phone || null, address: c.address || o.account.address || null });
        if (!c && o.account) c = await repo.saveCustomer({ name: o.account.name || 'לקוח מפיירברי', phone: o.account.phone || null, email: o.account.email || null, address: o.account.address || null, fb_id: o.account.id });
        if (!c) { setToast('להזמנה הזו אין לקוח בפיירברי.'); return; }
        await load(); setFind(false); go(`/c/${c.id}`); setNewOrder({ id: o.id, title: o.title, number: o.number, date: o.date });
      }} onAccount={async (a) => {
        const hit = matchLocal(customers || [], a); let c = hit?.c;
        if (c && !c.fb_id) c = await repo.saveCustomer({ ...c, fb_id: a.id, phone: c.phone || a.phone || null, address: c.address || a.address || null });
        if (!c) c = await repo.saveCustomer({ name: a.name, phone: a.phone || null, email: a.email || null, address: a.address || null, fb_id: a.id });
        await load(); setFind(false); go(`/c/${c.id}`); setNewOrder(true);
      }} />}
    </>
  );
}

const SHAPES: Record<TemplateId, string> = {
  straight: '<rect x="4" y="6" width="46" height="9" rx="1.5"/>', l: '<path d="M4 6h46v28h-9V15H4z"/>', u: '<path d="M4 6h46v28h-9V15H13v19H4z"/>',
  island: '<rect x="4" y="6" width="46" height="9" rx="1.5"/><rect x="14" y="24" width="26" height="10" rx="1.5"/>', 'l-island': '<path d="M4 6h46v28h-9V15H4z"/><rect x="6" y="24" width="26" height="10" rx="1.5"/>',
};

function NewOrder({ customer, onClose, preset }: { customer: Customer; onClose: () => void; preset?: FbRecord }) {
  const [way, setWay] = useState<'template' | 'dxf' | 'plan' | 'photo'>('template');
  const [tpl, setTpl] = useState<TemplateId>('straight');
  const [title, setTitle] = useState(preset?.title || 'מטבח'), [no, setNo] = useState(preset?.number || '');
  const [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const [dxf, setDxf] = useState<{ text: string; name: string; project: Project; info: DxfInfo } | null>(null);
  const [plan, setPlan] = useState<File | null>(null);
  const [fbObj, setFbObj] = useState<number | null>(null), [fbRecs, setFbRecs] = useState<FbRecord[] | null>(null), [fbRec, setFbRec] = useState<FbRecord | null>(preset || null), [fbErr, setFbErr] = useState('');
  useEffect(() => {
    if (!customer.fb_id || !fireberry.available()) return;
    fireberry.settings().then((st) => { if (!st.object) return; setFbObj(st.object); return fireberry.records(st.object, customer.fb_id!).then((r) => setFbRecs(preset && !r.some((x) => x.id === preset.id) ? [preset, ...r] : r)); }).catch((e) => setFbErr((e as Error).message));
  }, [customer.fb_id]);
  // מדידות של הלקוח בפיירברי, עם הקבצים שלהן — קובץ נבחר נכנס ישר לבניית המטבח
  const [meas, setMeas] = useState<FbMeasure[] | null>(null), [measObj, setMeasObj] = useState(1001), [measErr, setMeasErr] = useState(''), [measBusy, setMeasBusy] = useState(''), [measNote, setMeasNote] = useState('');
  useEffect(() => {
    if (!customer.fb_id || !fireberry.available()) return;
    setMeas(null); setMeasErr('');
    fireberry.settings().then((st) => { const mo = st.measureObject || 1001; setMeasObj(mo); return fireberry.measures(mo, customer.fb_id!, fbRec?.id); }).then(setMeas).catch((e) => setMeasErr((e as Error).message));
  }, [customer.fb_id, fbRec?.id]);
  async function fromMeasure(m: FbMeasure, f: FbFile) {
    setMeasBusy(f.id || f.url); setErr('');
    try {
      const file = await fireberry.file(measObj, m.id, f);
      if (/\.dxf$/i.test(file.name)) { const text = await file.text(); setWay('dxf'); setPlan(null); setDxf({ text, name: file.name, ...parseDxf(text, title) }); }
      else if (/\.dwg$/i.test(file.name)) throw new Error('קובץ DWG: צריך לייצא אותו ל-DXF. אפשר גם לצלם את התוכנית.');
      else { setWay('plan'); setDxf(null); setPlan(file); }
      setMeasNote(`מדידה מפיירברי: ${m.title} · ${file.name}`);
    } catch (e) { setErr((e as Error).message); }
    setMeasBusy('');
  }
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
      if (measNote) project = { ...project, notes: [measNote, project.notes].filter(Boolean).join('\n') };
      const o = await repo.createOrder({ customer_id: customer.id, title: title.trim() || 'מטבח', order_no: no.trim() || undefined, project, ...(fbRec && fbObj ? { fb_object: fbObj, fb_id: fbRec.id } : {}) });
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
      {customer.fb_id && fireberry.available() && <div className="col">
        <span className="cap">הזמנה בפיירברי</span>
        {fbErr ? <div className="note err">{fbErr}</div> : !fbObj ? <div className="note">כדי לקשר להזמנה בפיירברי, המנהל בוחר במסך "פיירברי" מאיזה אובייקט לוקחים הזמנות.</div>
          : fbRecs === null ? <span className="spin dark" /> : !fbRecs.length ? <div className="mute" style={{ fontSize: 13 }}>אין רשומות ללקוח הזה בפיירברי.</div>
          : <div className="chips">{fbRecs.map((r) => <button key={r.id} className={`chip ${fbRec?.id === r.id ? 'on' : ''}`} onClick={() => { setFbRec(fbRec?.id === r.id ? null : r); if (fbRec?.id !== r.id) { if (r.title && title === 'מטבח') setTitle(r.title); if (r.number && !no) setNo(r.number); } }}>{r.title || r.number || 'רשומה'}{r.number && r.title ? ` · ${r.number}` : ''}</button>)}</div>}
      </div>}
      {customer.fb_id && fireberry.available() && <div className="col">
        <span className="cap">מדידות בפיירברי</span>
        {measErr ? <div className="note err">{measErr}</div> : meas === null ? <span className="spin dark" />
          : !meas.some((m) => m.files.length) ? <div className="mute" style={{ fontSize: 13 }}>{meas.length ? 'יש מדידות ללקוח, אבל בלי קבצי PDF / DXF / תמונה. אפשר להתחיל מתבנית או לצלם את דף המדידה.' : 'אין מדידות ללקוח הזה בפיירברי. מתחילים מתבנית, מ-DXF או מצילום.'}</div>
          : <div className="fbfind">{meas.filter((m) => m.files.length).map((m) => m.files.map((f) => (
            <button key={m.id + (f.id || f.url)} className="fbrow" disabled={!!measBusy} onClick={() => fromMeasure(m, f)}>
              <span className="num">{/\.dxf/i.test(f.name) ? 'DXF' : /\.pdf/i.test(f.name) ? 'PDF' : 'תמונה'}</span>
              <div><b>{f.name || 'קובץ'}</b><small>{[m.title, m.order ? 'מקושר להזמנה הזו' : '', (f.date || m.date) && new Date(f.date || m.date).toLocaleDateString('he-IL')].filter(Boolean).join(' · ')}</small></div>
              {measBusy === (f.id || f.url) ? <span className="spin dark" /> : <span className="go">שימוש בקובץ ›</span>}
            </button>)))}</div>}
        {measNote && <span className="badge ok" style={{ alignSelf: 'flex-start' }}>✓ {measNote}</span>}
      </div>}
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

/** חיפוש לקוח בפיירברי לפי שם או טלפון, ומילוי הפרטים בלחיצה. */
function FbPicker({ onPick }: { onPick: (a: FbAccount) => void }) {
  const [q, setQ] = useState(''), [res, setRes] = useState<FbAccount[] | null>(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(() => { setBusy(true); setErr(''); fireberry.search(q.trim()).then(setRes).catch((e) => { setErr((e as Error).message); setRes(null); }).finally(() => setBusy(false)); }, 400);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="col fbpick">
      <label className="field">ייבוא מפיירברי<input placeholder="שם הלקוח או טלפון" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      {busy && <span className="spin dark" />}
      {err && <div className="note err">{err}{/טוקן|חיברת/.test(err) && <> · <a className="link" onClick={() => go('/fireberry')}>חיבור פיירברי</a></>}</div>}
      {res && (res.length ? <div className="fbres">{res.map((a) => <button key={a.id} className="citem" onClick={() => { onPick(a); setQ(''); setRes(null); }}><div><b>{a.name}</b><small>{[a.phone, a.address].filter(Boolean).join(' · ')}</small></div></button>)}</div>
        : <div className="mute" style={{ fontSize: 13 }}>לא נמצא לקוח בשם הזה בפיירברי.</div>)}
    </div>
  );
}

/** חיפוש אחד בפיירברי: שם לקוח, טלפון או מספר הזמנה. בוחרים הזמנה — והיא נפתחת כבר מקושרת. */
function FbFind({ customers, onClose, onOpen, onAccount }: { customers: Customer[]; onClose: () => void; onOpen: (o: FbOrder) => Promise<void>; onAccount: (a: FbAccount) => Promise<void> }) {
  const [q, setQ] = useState(''), [obj, setObj] = useState<number | null | undefined>(undefined), [res, setRes] = useState<{ orders: FbOrder[]; accounts: FbAccount[] } | null>(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [opening, setOpening] = useState('');
  useEffect(() => { fireberry.settings().then((s) => setObj(s.object || null)).catch(() => setObj(null)); }, []);
  useEffect(() => {
    if (!obj || q.trim().length < 2) { setRes(null); return; }
    const t = setTimeout(() => { setBusy(true); setErr(''); fireberry.find(obj, q.trim()).then(setRes).catch((e) => { setErr((e as Error).message); setRes(null); }).finally(() => setBusy(false)); }, 450);
    return () => clearTimeout(t);
  }, [q, obj]);
  const run = async (key: string, f: () => Promise<void>) => { setOpening(key); try { await f(); } catch (e) { setErr((e as Error).message); } setOpening(''); };
  return (
    <Modal title="פתיחה מהזמנה בפיירברי" onClose={onClose} wide>
      {obj === null ? <div className="note">המנהל צריך לבחור פעם אחת במסך "פיירברי" באיזה אובייקט נמצאות ההזמנות. <a className="link" onClick={() => go('/fireberry')}>למסך פיירברי</a></div> : <>
        <input className="input" autoFocus placeholder="שם לקוח, טלפון או מספר הזמנה" value={q} onChange={(e) => setQ(e.target.value)} />
        {busy && <span className="spin dark" />}
        {err && <div className="note err">{err}{/טוקן|חיברת/.test(err) && <> · <a className="link" onClick={() => go('/fireberry')}>חיבור פיירברי</a></>}</div>}
        {res && <div className="fbfind">
          {res.orders.map((o) => <button key={o.id} className="fbrow" disabled={!!opening} onClick={() => run(o.id, () => onOpen(o))}>
            <span className="mono num">{o.number ? `#${o.number}` : '—'}</span><div><b>{o.title || 'הזמנה'}</b><small>{[o.account?.name, o.account?.phone, o.date && new Date(o.date).toLocaleDateString('he-IL')].filter(Boolean).join(' · ')}</small><Hint m={matchLocal(customers, o.account)} /></div>
            {opening === o.id ? <span className="spin dark" /> : <span className="go">פתיחה ›</span>}</button>)}
          {res.accounts.map((a) => <button key={a.id} className="fbrow acc" disabled={!!opening} onClick={() => run(a.id, () => onAccount(a))}>
            <span className="num">לקוח</span><div><b>{a.name}</b><small>{[a.phone, a.address].filter(Boolean).join(' · ') || 'אין לו הזמנות באובייקט ההזמנות'}</small><Hint m={matchLocal(customers, a)} /></div>
            {opening === a.id ? <span className="spin dark" /> : <span className="go">הזמנה חדשה ›</span>}</button>)}
          {!res.orders.length && !res.accounts.length && <div className="mute" style={{ fontSize: 13 }}>לא נמצאו הזמנות או לקוחות. נסו חלק מהשם או את מספר ההזמנה המלא.</div>}
        </div>}
        <small className="mute">רואים רק מה שמותר לכם בפיירברי. בחירת הזמנה פותחת אותה כאן מקושרת: הלקוח נוצר אוטומטית, ובסוף המסמך נשלח ישר להזמנה.</small>
      </>}
    </Modal>
  );
}

function Hint({ m }: { m: ReturnType<typeof matchLocal> }) {
  if (!m) return <em className="hint new">לקוח חדש במערכת</em>;
  return <em className="hint">{m.how === 'fb' ? 'כבר במערכת' : `נראה שזה "${m.c.name}" שכבר במערכת (לפי ${m.how === 'phone' ? 'טלפון' : 'שם'}) — יקושר אליו`}</em>;
}
