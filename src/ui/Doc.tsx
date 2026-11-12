// מסמך הפרויקט: גיליונות A3 לרוחב עם בלוק כותרת בכל עמוד — שער עם הדמיה, הדמיות בזוויות, תוכנית מידות,
// פריסת לוחות על תמונת האבן, טבלת חלקים עם פרופיל קנט, אביזרים, ומטר רץ. נשמר כ-PDF ונשלח לפיירברי.
import { ReactNode, useEffect, useRef, useState } from 'react';
import { factorHe, runningMeters } from '../core/pricing';
import { STATUS_HE, repo, stoneLabel } from '../data/repo';
import { fireberry } from '../data/fireberry';
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
  const [internal, setInternal] = useState(false), [busy, setBusy] = useState<'' | 'pdf' | 'fb'>(''), [pro, setPro] = useState<number | null>(null);
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
  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSent.current || !signed?.signed_at || !order?.fb_id || !order.fb_object || !shots.hero || (nest && !slabs.length)) return;
    if (order.fb_sent_at && order.fb_sent_at >= signed.signed_at) return;
    autoSent.current = true; exportPdf(true);
  }, [signed?.signed_at, shots.hero, slabs.length, order?.fb_sent_at]);

  if (missing) return <div className="login"><div className="box glass"><h1>ההזמנה לא נמצאה</h1><button className="btn primary" onClick={() => go('/')}>חזרה</button></div></div>;
  if (!order || !project) return <div className="login"><div className="spin dark" /></div>;
  const rm = runningMeters(project), flat = project.pieces.filter((p) => !isVertical(p)), sinks = project.cutouts.filter((c) => c.kind === 'sink'), cooktops = project.cutouts.filter((c) => c.kind === 'cooktop');
  const fm = faucetById(project.faucet), fin = FINISHES[project.faucetFinish && fm.finishes.includes(project.faucetFinish) ? project.faucetFinish : fm.finishes[0]];
  const forProduction = order.status === 'approved' || order.status === 'production' || order.status === 'done';
  const date = new Date(order.updated_at).toLocaleDateString('he-IL'), ready = !!shots.hero && (!nest || slabs.length > 0);
  const fileName = `${order.title}${order.order_no ? ` ${order.order_no}` : ''} - Barstone.pdf`;

  const material = `${stone.name ? stoneLabel(stone) : '—'} · ${FINISH_HE[stoneFinish(project, stone.en)]} · ${project.thickness} מ"מ`;
  const block = (
    <div className="tb">
      <div><h4>פרטי לקוח</h4><p><b>שם:</b> {customer?.name || '—'}</p><p><b>טלפון:</b> <span dir="ltr">{customer?.phone || '—'}</span></p><p><b>כתובת:</b> {customer?.address || '—'}</p></div>
      <div><h4>פרטי הזמנה</h4><p><b>מס׳ הזמנה:</b> {order.order_no || '—'}</p><p><b>חומר:</b> {material}</p><p><b>קנט:</b> {project.apronH ? `${project.apronH} מ"מ בגרונג` : 'ישר'}</p>
        <p><b>כיור:</b> {sinks.length ? sinks.map((c) => `${c.built ? 'בנוי' : 'קנוי'} ${cm(c.w)}×${cm(c.h)}`).join(' · ') : '—'}</p><p><b>כיריים:</b> {cooktops.length ? cooktops.map((c) => `${cm(c.w)}×${cm(c.h)}`).join(' · ') : '—'}</p></div>
      <div className="tb-notes"><h4>הערות</h4>{NOTES.map((n) => <p key={n}>• {n}</p>)}</div>
      {signed?.signature ? <div className="tb-sign signed"><h4>אישור הלקוח · דיגיטלי</h4><img src={signed.signature} alt="חתימה" /><p><b>{signed.signer_name}</b> · {new Date(signed.signed_at!).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</p></div>
        : <div className="tb-sign"><h4>אישור הלקוח</h4><p>שם: ____________________</p><p>חתימה: __________________</p><p>תאריך: _________________</p></div>}
      <div className="tb-brand"><img src={asset('logo.png')} alt="Barstone" /><span className={`st ${forProduction ? 'go' : ''}`}><i className={!forProduction ? 'on' : ''} />לעיון <i className={forProduction ? 'on' : ''} />לביצוע</span><small>{date} · {STATUS_HE[order.status]}</small></div>
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

  async function exportPdf(send: boolean) {
    if (!book.current) return; setBusy(send ? 'fb' : 'pdf');
    try {
      book.current.classList.add('capture');
      const { blob, base64 } = await pagesToPdf([...book.current.querySelectorAll<HTMLElement>('.a3')]).finally(() => book.current?.classList.remove('capture'));
      if (send && order?.fb_id && order.fb_object) {
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
        <img className="logo" src={asset('logo.png')} alt="Barstone" onClick={() => go('/')} /><div className="crumb"><a onClick={() => go(`/o/${id}`)}>חזרה לסטודיו</a></div><span className="sp" />
        <button className="btn" onClick={() => setShare(true)}>{signed ? '✓ אושר בחתימה' : 'שליחה ללקוח לאישור'}</button>
        <label className="row mute" style={{ fontSize: 13 }}><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />כולל מטר רץ (פנימי)</label>
        <button className="btn hide-m" disabled={!ready || pro !== null} onClick={proCover} title="מחשב את תמונת השער באור פיזיקלי אמיתי">{pro !== null ? <><span className="spin dark" /><span>צילום {Math.round(pro * 100)}%</span></> : <span>צילום מקצועי לשער</span>}</button>
        {order.fb_id && order.fb_object && <button className="btn" disabled={!ready || !!busy} onClick={() => exportPdf(true)}>{busy === 'fb' ? <span className="spin dark" /> : <Icon.send />}<span>{order.fb_sent_at ? 'שליחה שוב לפיירברי' : 'צירוף לפיירברי'}</span></button>}
        <button className="btn primary" disabled={!ready || !!busy} onClick={() => exportPdf(false)}>{busy === 'pdf' ? <span className="spin" /> : <Icon.download />}<span>{ready ? 'הורדת PDF' : 'מכין הדמיות…'}</span></button>
      </header>
      {share && <ShareModal orderId={id} title={order.title} phone={customer?.phone} onClose={() => { setShare(false); reloadShares(); }} />}
      <main className="book" ref={book} style={{ ['--z' as string]: zoom }}>
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
      </main>
    </>
  );
}
