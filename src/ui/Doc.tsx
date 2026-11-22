// מסמך הפרויקט: גיליונות A3 לרוחב עם בלוק כותרת בכל עמוד — שער עם הדמיה, הדמיות בזוויות, תוכנית מידות,
// פריסת לוחות על תמונת האבן, טבלת חלקים עם פרופיל קנט, אביזרים, ומטר רץ. נשמר כ-PDF ונשלח לפיירברי.
import { ReactNode, useEffect, useRef, useState } from 'react';
import { factorHe, runningMeters } from '../core/pricing';
import { STATUS_HE, repo, sb, stoneLabel } from '../data/repo';
import { fireberry } from '../data/fireberry';
import { odoo } from '../data/odoo';
import { approvalHash } from '../core/approval';
import { ApprovePanel, CutList, JointTable, SlabTable, Stamp, jointRows } from './Production';
import { CUT_HE, Project, SIDE_HE, UPPER_HE, chairCount, corners, isVertical, letter } from '../core/model';
import { FINISHES, faucetById } from '../core/catalog';
import { go, useStore } from '../store';
import { Icon } from './icons';
import { asset, cm, useStone } from './util';
import { useOrder } from './Studio';
import { ViewName, renderViews } from './render';
import { COLORS, edgeDetailSvg, edgeProfileSvg, slabImages } from './drawings';
import { DimPlan } from './DimPlan';
import { pagesToPdf } from './pdf';
import { ShareModal, useShares } from './Share';
import { FINISH_HE, stoneFinish } from '../data/lucente';

const NOTES = [
  'אין התחייבות לגידים: מיקום, כיוון וגוון הגידים משתנים מלוח ללוח. ההדמיה להמחשה בלבד.',
  'המידות הסופיות נקבעות במדידה בשטח, לפני חיתוך.',
  'על המזמין לדאוג לתמיכות מתחת לכיורים מובנים ומתחת לכיורים בהתקנה תחתונה.',
  'במידה וקיים טוחן אשפה, יש לדאוג שרוזטת הניקוז תהיה ביום ההתקנה וליידע את המתקין.',
  'תיתכן סטייה בין המוצג בתוכנית לחיתוך בפועל.',
];
const sinkType = (c: Project['cutouts'][number]) => (c.built ? 'בנוי מאבן · התקנה תחתונה' : c.mount === 'top' ? 'קנוי · התקנה עליונה' : c.mount === 'flush' ? 'קנוי · התקנה שטוחה' : 'קנוי · התקנה תחתונה');

export function Doc({ id }: { id: string }) {
  const { order, customer, missing } = useOrder(id);
  const project = useStore((s) => s.project), nest = useStore((s) => s.nest), stone = useStone(), setToast = useStore((s) => s.setToast);
  const [shots, setShots] = useState<Partial<Record<ViewName, string>>>({}), [slabs, setSlabs] = useState<string[]>([]);
  const issues = useStore((s) => s.issues);
  const [mode, setMode] = useState<'customer' | 'prod'>(() => (/[?&]prod\b/.test(location.hash) ? 'prod' : 'customer')), [me, setMe] = useState(() => { try { return localStorage.getItem('bs.approver') || ''; } catch { return ''; } });
  useEffect(() => { if (!me) sb?.auth.getUser().then(({ data }) => setMe((m) => m || data.user?.email?.split('@')[0] || '')); }, []);
  const [internal, setInternal] = useState(false), [busy, setBusy] = useState<'' | 'pdf' | 'fb' | 'odoo' | 'approve'>(''), [pro, setPro] = useState<number | null>(null);
  const book = useRef<HTMLDivElement>(null), [share, setShare] = useState(false), { signed, reload: reloadShares } = useShares(id);
  const key = project ? JSON.stringify([project, stone.url]) : '';
  useEffect(() => {
    if (!project) return; let live = true;
    const t = setTimeout(async () => {
      const views: ViewName[] = ['hero', 'left', 'front', 'right', 'top', ...(project.cutouts.some((c) => c.kind === 'sink') ? ['sink' as const] : [])];
      const s = await renderViews(project, nest, stone.url, views, 2200, 1400, stoneFinish(project, stone.en)); if (live) setShots(s);
      if (nest) { const im = await slabImages(project, nest, stone.url); if (live) setSlabs(im); }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [key]);

  // מסמך שהלקוח חתם עליו נשלח אוטומטית להזמנה בפיירברי (רק להזמנה — לא לכרטיס הלקוח ולא למדידה)
  // עמודי A3 מוקטנים בדיוק לרוחב המסך (בטלפון אפשר להגדיל בצביטה)
  const [zoom, setZoom] = useState(1);
  useEffect(() => { const f = () => setZoom(Math.min(1, (Math.min(window.innerWidth, window.screen?.width || 9999, document.documentElement.clientWidth || 9999) - 24) / 1587)); f(); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  const autoSent = useRef(false), sendAfter = useRef(false);
  // אחרי אישור לייצור: הטופס המאושר נשלח לבד להזמנה ב-Odoo (ולפיירברי, אם ההזמנה מקושרת)
  useEffect(() => {
    if (!sendAfter.current || mode !== 'prod' || !order?.approval || busy || (nest && !slabs.length)) return;
    sendAfter.current = false;
    const t = setTimeout(async () => { if (order.odoo_id) await exportPdf('odoo'); if (order.fb_id && order.fb_object) await exportPdf(true); }, 600);
    return () => clearTimeout(t);
  }, [order?.approval?.at, mode, slabs.length, busy]);
  useEffect(() => {
    if (mode !== 'customer' || autoSent.current || !signed?.signed_at || !order?.fb_id || !order.fb_object || !shots.hero || (nest && !slabs.length)) return;
    if (order.fb_sent_at && order.fb_sent_at >= signed.signed_at) return;
    autoSent.current = true; exportPdf(true);
  }, [signed?.signed_at, shots.hero, slabs.length, order?.fb_sent_at]);

  if (missing) return <div className="login"><div className="box glass"><h1>ההזמנה לא נמצאה</h1><button className="btn primary" onClick={() => go('/')}>חזרה</button></div></div>;
  if (!order || !project) return <div className="login"><div className="spin dark" /></div>;
  const rm = runningMeters(project), flat = project.pieces.filter((p) => !isVertical(p)), sinks = project.cutouts.filter((c) => c.kind === 'sink'), cooktops = project.cutouts.filter((c) => c.kind === 'cooktop');
  const fm = faucetById(project.faucet), fin = FINISHES[project.faucetFinish && fm.finishes.includes(project.faucetFinish) ? project.faucetFinish : fm.finishes[0]];
  const forProduction = order.status === 'approved' || order.status === 'production' || order.status === 'done';
  const date = new Date(order.updated_at).toLocaleDateString('he-IL'), ready = !!shots.hero && (!nest || slabs.length > 0);
  const prod = mode === 'prod', approved = !!order.approval && order.approval.hash === approvalHash(project);
  const fileName = `${order.title}${order.order_no ? ` ${order.order_no}` : ''} - ${prod ? 'טופס ייצור ' : ''}Barstone.pdf`;

  const material = `${stone.name ? stoneLabel(stone) : '—'} · ${FINISH_HE[stoneFinish(project, stone.en)]} · ${project.thickness} מ"מ`;
  const block = (
    <div className="tb">
      <div><h4>פרטי לקוח</h4><p><b>שם:</b> {customer?.name || '—'}</p><p><b>טלפון:</b> <span dir="ltr">{customer?.phone || '—'}</span></p><p><b>כתובת:</b> {customer?.address || '—'}</p></div>
      <div><h4>פרטי הזמנה</h4><p><b>מס׳ הזמנה:</b> {order.order_no || '—'}</p><p><b>חומר:</b> {material}</p><p><b>קנט:</b> {project.apronH ? `${project.apronH} מ"מ בגרונג` : 'ישר'}</p>
        <p><b>כיור:</b> {sinks.length ? sinks.map((c) => `${c.built ? 'בנוי' : 'קנוי'} ${cm(c.w)}×${cm(c.h)}`).join(' · ') : '—'}</p><p><b>כיריים:</b> {cooktops.length ? cooktops.map((c) => `${cm(c.w)}×${cm(c.h)}`).join(' · ') : '—'}</p></div>
      <div className="tb-notes"><h4>הערות</h4>{NOTES.map((n) => <p key={n}>• {n}</p>)}</div>
      {signed?.signature ? <div className="tb-sign signed"><h4>אישור הלקוח · דיגיטלי</h4><img src={signed.signature} alt="חתימה" /><p><b>{signed.signer_name}</b> · {new Date(signed.signed_at!).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</p></div>
        : <div className="tb-sign"><h4>אישור הלקוח</h4><p>שם: ____________________</p><p>חתימה: __________________</p><p>תאריך: _________________</p></div>}
      {prod ? <div className="tb-brand"><img src={asset('logo.png')} alt="Barstone" /><Stamp approval={order.approval} valid={approved} /></div> :
      <div className="tb-brand"><img src={asset('logo.png')} alt="Barstone" /><span className={`st ${forProduction ? 'go' : ''}`}><i className={!forProduction ? 'on' : ''} />לעיון <i className={forProduction ? 'on' : ''} />לביצוע</span><small>{date} · {STATUS_HE[order.status]}</small></div>}
    </div>
  );
  let n = 0;
  const page = (title: string, children: ReactNode) => { n++; return (
    <section className="a3" key={title}>
      <header className="a3-head"><img src={asset('logo.png')} alt="Barstone" /><span className="sp" /><div><small>{order.title}</small><b>עמוד {n} · {title}</b></div></header>
      <div className="a3-body">{children}</div>
      {block}
    </section>
  ); };
  const Shot = ({ v, label }: { v: ViewName; label: string }) => <figure className="shot">{shots[v] ? <img src={shots[v]} alt={label} /> : <div className="ph"><span className="spin dark" /></div>}<figcaption>{label}</figcaption></figure>;

  // שדרוג תמונת השער לצילום פוטו־ריאליסטי (אור פיזיקלי) — דקה-שתיים על המחשב
  async function proCover() {
    if (!project) return; setPro(0);
    try {
      const { photoRender } = await import('./photo');
      const img = await photoRender({ project, nest, stoneUrl: stone.url, finish: stoneFinish(project, stone.en), view: 'hero', W: 2200, H: 1400, samples: 160, onProgress: (p) => setPro(p) });
      setShots((s) => ({ ...s, hero: img }));
    } catch (e) { setToast(`הצילום נכשל: ${(e as Error).message}`); }
    setPro(null);
  }

  async function approve(by: string, note: string) {
    if (!order || !project) return; setBusy('approve');
    try {
      await useStore.getState().flush();
      const approval = { at: new Date().toISOString(), by, hash: approvalHash(project), ...(note ? { note } : {}) };
      await repo.updateOrder(order.id, { approval, status: 'production' }); useStore.setState({ order: { ...order, approval, status: 'production' } });
      try { localStorage.setItem('bs.approver', by); } catch { /* */ }
      setToast('ההזמנה אושרה לייצור'); if (order.odoo_id || (order.fb_id && order.fb_object)) sendAfter.current = true;
    } catch (e) { setToast(`האישור נכשל: ${(e as Error).message}`); }
    setBusy('');
  }
  async function revoke() {
    if (!order || !confirm('לבטל את האישור לייצור?')) return; setBusy('approve');
    try { await repo.updateOrder(order.id, { approval: null, status: 'approved' }); useStore.setState({ order: { ...order, approval: null, status: 'approved' } }); } catch (e) { setToast((e as Error).message); }
    setBusy('');
  }

  async function exportPdf(send: boolean | 'odoo') {
    if (!book.current) return; setBusy(send === 'odoo' ? 'odoo' : send ? 'fb' : 'pdf');
    try {
      book.current.classList.add('capture');
      const { blob, base64 } = await pagesToPdf([...book.current.querySelectorAll<HTMLElement>('.a3')]).finally(() => book.current?.classList.remove('capture'));
      if (send === 'odoo' && order?.odoo_id) {
        const note = prod ? `טופס ייצור מאושר אחרי מדידה (${order.approval?.by || ''}) · Barstone הדמיות` : signed?.signed_at ? `הדמיה שאושרה בחתימת הלקוח (${signed.signer_name || ''}) · Barstone הדמיות` : 'הדמיה · Barstone הדמיות';
        const r = await odoo.attach(order.odoo_id, fileName, base64, note);
        const at = new Date().toISOString(); await repo.updateOrder(order.id, { odoo_sent_at: at }); useStore.setState({ order: { ...useStore.getState().order!, odoo_sent_at: at } });
        setToast(r.posted ? `המסמך צורף להזמנה ${order.odoo_name || ''} ב-Odoo` : 'הקובץ צורף להזמנה ב-Odoo (בלי הודעה בצ׳אטר)');
      } else if (send && order?.fb_id && order.fb_object) {
        await fireberry.attach(order.fb_object, order.fb_id, fileName, base64);
        const at = new Date().toISOString(); await repo.updateOrder(order.id, { fb_sent_at: at }); useStore.setState({ order: { ...order, fb_sent_at: at } });
        setToast(signed?.signed_at ? 'המסמך החתום צורף להזמנה בפיירברי' : 'המסמך צורף להזמנה בפיירברי');
      } else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    } catch (e) { setToast(`${send ? 'השליחה' : 'יצירת ה-PDF'} נכשלה: ${(e as Error).message}`); }
    setBusy('');
  }

  return (
    <>
      <header className="top noprint doctop">
        <img className="logo" src={asset('logo.png')} alt="Barstone" onClick={() => go('/')} /><div className="crumb"><a onClick={() => go(`/o/${id}`)}>חזרה לסטודיו</a></div>
        <div className="doctabs"><button className={!prod ? 'on' : ''} onClick={() => setMode('customer')}>מסמך ללקוח</button><button className={prod ? 'on' : ''} onClick={() => setMode('prod')}>טופס ייצור{approved ? ' ✓' : ''}</button></div><span className="sp" />
        {!prod && <button className="btn" onClick={() => setShare(true)}>{signed ? '✓ אושר בחתימה' : 'שליחה ללקוח לאישור'}</button>}
        {!prod && <label className="row mute" style={{ fontSize: 13 }}><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />כולל מטר רץ (פנימי)</label>}
        {!prod && <button className="btn hide-m" disabled={!ready || pro !== null} onClick={proCover} title="מחשב את תמונת השער באור פיזיקלי אמיתי">{pro !== null ? <><span className="spin dark" /><span>צילום {Math.round(pro * 100)}%</span></> : <span>צילום מקצועי לשער</span>}</button>}
        {order.odoo_id && <button className="btn" disabled={!ready || !!busy || (prod && !approved)} onClick={() => exportPdf('odoo')}>{busy === 'odoo' ? <span className="spin dark" /> : <Icon.send />}<span>{order.odoo_sent_at ? 'שליחה שוב ל-Odoo' : 'צירוף להזמנה ב-Odoo'}</span></button>}
        {order.fb_id && order.fb_object && <button className="btn" disabled={!ready || !!busy || (prod && !approved)} onClick={() => exportPdf(true)}>{busy === 'fb' ? <span className="spin dark" /> : <Icon.send />}<span>{order.fb_sent_at ? 'שליחה שוב לפיירברי' : 'צירוף לפיירברי'}</span></button>}
        <button className="btn primary" disabled={!ready || !!busy || (prod && !approved)} title={prod && !approved ? 'הטופס יוצא רק אחרי אישור' : undefined} onClick={() => exportPdf(false)}>{busy === 'pdf' ? <span className="spin" /> : <Icon.download />}<span>{ready ? 'הורדת PDF' : 'מכין הדמיות…'}</span></button>
      </header>
      {share && <ShareModal orderId={id} title={order.title} phone={customer?.phone} onClose={() => { setShare(false); reloadShares(); }} />}
      {prod && <ApprovePanel key={`${order.approval?.at}-${me}`} issues={issues} nest={nest} approval={order.approval} valid={approved} signedBy={signed?.signer_name} defaultName={me} busy={busy === 'approve'} onApprove={approve} onRevoke={revoke} />}
      {prod && <main className="book" ref={book} style={{ ['--z' as string]: zoom }}>
        {page('טופס ייצור · רשימת חיתוך', <>
          <div className="prodhead">
            <div><small>לקוח</small><b>{customer?.name || '—'}</b></div><div><small>הזמנה</small><b>{order.odoo_name || order.order_no || order.title}</b></div>
            <div><small>חומר</small><b>{material}</b></div><div><small>לוחות · חיבורים</small><b>{nest?.metrics.slabs ?? 0} לוחות {cm(project.slabW)}×{cm(project.slabH)} · {jointRows(project, nest).length} חיבורים</b></div>
            <Stamp approval={order.approval} valid={approved} />
          </div>
          <CutList project={project} nest={nest} stoneName={stone.name} />
          {order.approval?.note && approved && <p className="fine"><b>הערה למפעל:</b> {order.approval.note}</p>}
          <p className="fine">מידות במ"מ. מיקום פתח: X מהקצה השמאלי של החלק, Y מהקצה האחורי. קנט גרונג נחתך צמוד לחלק לשמירת רצף הגיד.</p>
        </>)}
        {page('טופס ייצור · חיבורים', <>
          <div className="plan" style={{ maxHeight: 520 }}><DimPlan project={project} nest={nest} /></div>
          <JointTable project={project} nest={nest} />
          <div className="legend"><span><i style={{ background: COLORS.joint }} />חיבור</span><span><i style={{ background: COLORS.miter }} />קנט גרונג</span><span>כל המידות בתוכנית בס"מ, ובטבלה במ"מ</span></div>
        </>)}
        {nest && nest.slabs.map((_, i) => i % 2 === 0 && page(`טופס ייצור · פריסה על הלוח${nest.slabs.length > 2 ? ` (${i / 2 + 1}/${Math.ceil(nest.slabs.length / 2)})` : ''}`, <>
          <div className={`prodslabs ${nest.slabs.length - i === 1 ? 'one' : ''}`}>{[i, i + 1].filter((k) => k < nest.slabs.length).map((k) => <figure key={k}>{slabs[k] ? <img src={slabs[k]} alt={`לוח ${k + 1}`} /> : <div className="ph"><span className="spin dark" /></div>}<SlabTable project={project} nest={nest} slab={k} /></figure>)}</div>
          <p className="fine">X מהקצה השמאלי של הלוח, Y מהקצה העליון, במ"מ. מרווח מסור {project.kerf} מ"מ, שוליים {project.margin} מ"מ.{project.bookmatch === 'yes' ? ' לוחות זוגיים הם תמונת מראה (בוק־מאץ׳).' : ''}</p>
        </>))}
      </main>}
      {!prod && <main className="book" ref={book} style={{ ['--z' as string]: zoom }}>
        {page('שער', <>
          <div className="cover">
            <div className="cover-shot"><Shot v="hero" label="" /></div>
            <div className="cover-side">
              <span className="eyebrow">הדמיית משטח אבן</span>
              <h1>{order.title}</h1>
              <p className="sub">{[customer?.name, customer?.address].filter(Boolean).join(' · ')}</p>
              <div className="stone-card"><i style={{ backgroundImage: `url("${stone.thumb || stone.url}")` }} /><div><b>{stone.name || '—'}</b><small>{[stone.en, stone.series].filter(Boolean).join(' · ')}</small><small>{FINISH_HE[stoneFinish(project, stone.en)]} · {project.thickness} מ"מ · {project.apronH ? `קנט ${project.apronH} מ"מ` : 'קנט ישר'}</small></div></div>
              <dl className="kv">
                <div><dt>חלקים</dt><dd>{project.pieces.length}</dd></div><div><dt>לוחות</dt><dd>{nest?.metrics.slabs ?? 0}</dd></div>
                <div><dt>חיבורים</dt><dd>{(nest?.metrics.joints ?? 0) + corners(project).length}</dd></div><div><dt>בוק־מאץ׳</dt><dd>{project.bookmatch === 'yes' ? 'כן' : project.bookmatch === 'no' ? 'לא' : '—'}</dd></div>
              </dl>
              <div className="minis"><Shot v="top" label="מלמעלה" /><Shot v="front" label="חזית" /></div>
            </div>
          </div>
        </>)}
        {page('הדמיה בזוויות', <>
          <div className="grid3"><Shot v="left" label="שמאל" /><Shot v="front" label="חזית" /><Shot v="right" label="ימין" /></div>
          {shots.sink !== undefined && <div className="grid2d"><Shot v="sink" label="תקריב · אזור הכיור" /><Shot v="top" label="מבט על" /></div>}
          <p className="fine">ההדמיה להמחשה בלבד ואינה בקנה מידה. המידות המחייבות מופיעות בתוכנית המידות.</p>
        </>)}
        {page('תוכנית מידות', <>
          <div className="plan"><DimPlan project={project} nest={nest} /></div>
          <div className="legend"><span><i style={{ background: COLORS.miter }} />קנט גרונג</span><span><i style={{ background: COLORS.joint }} />חיבור</span><span><i style={{ background: '#c9b99c' }} />חיפוי קיר</span><span><i className="dash" />אזור ישיבה</span><span>כל המידות בס"מ</span></div>
        </>)}
        {nest && nest.slabs.length > 0 && page('פריסת לוחות', <>
          <div className={`slabgrid n${Math.min(nest.slabs.length, 4)}`}>{nest.slabs.map((s, i) => <figure key={i}>{slabs[i] ? <img src={slabs[i]} alt={`לוח ${i + 1}`} /> : <div className="ph"><span className="spin dark" /></div>}<figcaption><b>לוח {i + 1}{project.bookmatch === 'yes' ? (i % 2 ? ' · B (מראה)' : ' · A') : ''}</b> · {stone.name} · {cm(s.w)}×{cm(s.h)} ס"מ · {project.thickness} מ"מ · ניצול {s.used}%</figcaption></figure>)}</div>
          <div className="legend"><span><i style={{ background: COLORS.cut }} />קו חיתוך</span><span><i style={{ background: COLORS.miter }} />פס קנט (גרונג)</span><span><i className="dash" style={{ borderColor: COLORS.edge }} />חיפוי צמוד למשטח — המשך גיד</span><span><i style={{ background: COLORS.extra }} />חלקי כיור / צוקל</span></div>
        </>)}
        {page('חלקים, פתחים ואביזרים', <>
          <table className="parts"><thead><tr><th>#</th><th>חלק</th><th>מידות (מ"מ)</th><th>חומר</th><th>קנט</th><th>פרופיל</th><th>פתחים</th><th>הערות</th></tr></thead><tbody>
            {project.pieces.map((p, i) => { const cuts = project.cutouts.filter((c) => c.pieceId === p.id), ap = !isVertical(p) && p.aprons.length && project.apronH ? project.apronH : 0; return (
              <tr key={p.id}><td><b className="mono">{letter(i)}</b></td><td>{p.name}</td><td className="mono">{Math.round(p.w)}×{Math.round(p.h)}</td><td>{stone.name} · {project.thickness}</td>
                <td>{ap ? `גרונג ${ap} · ${p.aprons.map((s) => SIDE_HE[s]).join(', ')}` : 'ישר'}</td><td className="prof" dangerouslySetInnerHTML={{ __html: edgeProfileSvg(project.thickness, ap) }} />
                <td>{cuts.map((c) => `${c.name || CUT_HE[c.kind]} ${c.round ? `Ø${Math.round(c.w)}` : `${Math.round(c.w)}×${Math.round(c.h)}`}`).join(' · ') || '—'}</td>
                <td>{[p.corner === 'miter' ? 'פינה 45°' : '', p.seat ? `ישיבה ${SIDE_HE[p.seat]} · ${chairCount(p)} כיסאות` : '', p.grainLock ? '' : 'גיד חופשי', (nest?.joints || []).filter((j) => j.pieceId === p.id).map((j) => `חיבור ב-${Math.round(j.at)}`).join(', ')].filter(Boolean).join(' · ') || '—'}</td></tr>); })}
          </tbody></table>
          <div className="three">
            <div>
              <h3>כיורים ופתחים</h3>
              <table className="parts"><thead><tr><th>פתח</th><th>סוג</th><th>מידות</th><th>X מהשמאל</th><th>Y מהגב</th><th>חלק</th></tr></thead><tbody>
                {project.cutouts.map((c) => { const host = project.pieces.find((q) => q.id === c.pieceId); return <tr key={c.id}><td>{c.name || CUT_HE[c.kind]}</td><td>{c.kind === 'sink' ? sinkType(c) : c.kind === 'faucet' ? 'חור ברז' : c.kind === 'cooktop' ? 'פתח כיריים' : 'פתח'}</td><td className="mono">{c.round ? `Ø${Math.round(c.w)}` : `${Math.round(c.w)}×${Math.round(c.h)}`}</td><td className="mono">{Math.round(c.x)}</td><td className="mono">{Math.round(c.y)}</td><td>{host ? `${letter(project.pieces.indexOf(host))} · ${host.name}` : '—'}</td></tr>; })}
              </tbody></table>
              {sinks.filter((c) => c.built).map((c) => <p key={c.id} className="fine">כיור בנוי: 4 דפנות בגובה 200 + תחתית {Math.round(c.w)}×{Math.round(c.h)}{c.bowls && c.bowls !== 'single' ? ' + מחיצה' : ''}{c.drainCover ? ' · ונטיל מאבן מעל הניקוז' : ''}{c.cabinet ? ` · לארון ${c.cabinet / 10}` : ''}. החלקים בפריסת הלוחות.</p>)}
            </div>
            <div>
              <h3>ברז ומוצרים נלווים</h3>
              <dl className="kv wide">
                <div><dt>ברז</dt><dd>{`${fm.name} · ${fin.name}`}</dd></div>
                <div><dt>טוחן אשפה</dt><dd>{project.disposal ? 'נובו 1 כ"ס · כפתור אוויר על המשטח' : '—'}</dd></div>
                <div><dt>מערכת מים</dt><dd>{project.water ? 'מחמם, מקרר ומסנן תלת־שלבי · ברז ייעודי' : '—'}</dd></div>
                <div><dt>ארונות עליונים</dt><dd>{project.uppers ? `${UPPER_HE[project.upperStyle || 'doors']} · גובה ${cm(project.upperH || 700)} ס"מ${project.underLight !== false ? ' · תאורה מתחת' : ''}` : '—'}</dd></div>
                <div><dt>צוקל</dt><dd>{project.plinthStone ? 'מאבן' : 'רגיל'}</dd></div>
                <div><dt>חיבורי פינה</dt><dd>{corners(project).map((c) => `${c.b.name}: ${c.miter ? 'גרונג 45°' : 'ישר'}`).join(' · ') || '—'}</dd></div>
              </dl>
            </div>
            <div>
              <h3>פרטי קנט</h3>
              <div className="edges">
                <div dangerouslySetInnerHTML={{ __html: edgeDetailSvg(project.thickness, 0, 'קנט ישר') }} />
                {project.apronH > 0 && <div dangerouslySetInnerHTML={{ __html: edgeDetailSvg(project.thickness, project.apronH, `קנט גרונג ${project.apronH}`) }} />}
              </div>
            </div>
          </div>
        </>)}
        {internal && page('מטר רץ (פנימי)', <>
          <table className="parts"><thead><tr><th>חלק</th><th>אורך × רוחב (ס"מ)</th><th>מקדם לפי רוחב</th><th>מטר רץ</th></tr></thead><tbody>
            {rm.rows.map((r) => <tr key={r.id}><td>{r.name}{r.corner ? ` · כולל פינה ${cm(r.corner)}` : ''}</td><td className="mono">{cm(r.len)} × {cm(r.wid)}</td><td>{factorHe(r.factor)}</td><td className="mono">{r.rm.toFixed(2)}</td></tr>)}
            <tr className="sum"><td>סה"כ</td><td /><td /><td className="mono">{rm.total.toFixed(2)}</td></tr>
            {rm.extras.map((x) => <tr key={x.id}><td>תוספת · {x.name}</td><td /><td /><td className="mono">{x.qty} {x.unit}</td></tr>)}
          </tbody></table>
          <p className="fine">לפי רוחב (בחיפוי — לפי הגובה): עד 20 ס"מ שליש · 20–30 חצי · 31–70 רגיל · 70–150 כפול · 150–170 פי 2.5 · מעל 170 פי 3. פינה נספרת בשתי הצלעות. מפל = גובה 90 לפי עומק האי.</p>
        </>)}
      </main>}
    </>
  );
}
