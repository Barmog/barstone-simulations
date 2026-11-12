// הקישור של הלקוח: ההדמיה שלו בתלת־ממד, בחירת המקום שבו יעבור הגיד על הלוח האמיתי, ואישור בחתימה דיגיטלית.
// בלי התחברות — רק הטוקן שבקישור. שום דבר לא נשמר עד שהלקוח מאשר.
import { useEffect, useRef, useState } from 'react';
import { PortalData, repo, stoneLabel } from '../data/repo';
import { FINISH_HE, stoneFinish } from '../data/lucente';
import { CUT_HE, isVertical, letter } from '../core/model';
import { useStore } from '../store';
import { View3D } from './View3D';
import { Slabs } from './Slabs';
import { asset, cm, useStone } from './util';

const TERMS = [
  'ההדמיה להמחשה בלבד. מיקום, כיוון וגוון הגידים משתנים מלוח ללוח, ואין התחייבות לגידים.',
  'המידות הסופיות נקבעות במדידה בשטח, לפני החיתוך.',
  'מיקום החלקים על הלוח שבחרתי ייחשב כהעדפה; ייתכנו התאמות קטנות לפי הלוח שיגיע בפועל.',
];

function SignaturePad({ onChange }: { onChange: (png: string | null) => void }) {
  const cv = useRef<HTMLCanvasElement>(null), drawing = useRef(false), dirty = useRef(false);
  useEffect(() => {
    const c = cv.current!, r = c.getBoundingClientRect(), k = Math.min(devicePixelRatio || 1, 2);
    c.width = r.width * k; c.height = r.height * k; const g = c.getContext('2d')!; g.scale(k, k); g.lineWidth = 2.2; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#1b1a18';
  }, []);
  const pt = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  return (
    <div className="sigpad">
      <canvas ref={cv} onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); drawing.current = true; const g = cv.current!.getContext('2d')!, [x, y] = pt(e); g.beginPath(); g.moveTo(x, y); }}
        onPointerMove={(e) => { if (!drawing.current) return; const g = cv.current!.getContext('2d')!, [x, y] = pt(e); g.lineTo(x, y); g.stroke(); dirty.current = true; }}
        onPointerUp={() => { drawing.current = false; if (dirty.current) onChange(cv.current!.toDataURL('image/png')); }} />
      <span className="sig-hint">חתמו כאן באצבע או בעכבר</span>
      <button className="link" onClick={() => { const c = cv.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); dirty.current = false; onChange(null); }}>ניקוי</button>
    </div>
  );
}

export function Portal({ token }: { token: string }) {
  const [data, setData] = useState<PortalData | null>(null), [err, setErr] = useState('');
  const project = useStore((s) => s.project), nest = useStore((s) => s.nest), stone = useStone();
  const [name, setName] = useState(''), [sig, setSig] = useState<string | null>(null), [agree, setAgree] = useState(false), [note, setNote] = useState('');
  const [busy, setBusy] = useState(false), [signed, setSigned] = useState<{ at: string; name: string; sig: string } | null>(null);
  const original = useRef<string>('');

  useEffect(() => {
    useStore.getState().loadStones();
    repo.portal<PortalData>({ mode: 'get', token }).then((d) => {
      setData(d); original.current = JSON.stringify(d.order.project.manual || {});
      useStore.getState().openPortal({ ...d.order, customer_id: '', stone_id: null, metrics: {}, created_at: d.order.updated_at } as never);
      if (d.share.signed_at) setSigned({ at: d.share.signed_at, name: d.share.signer_name || '', sig: d.share.signature || '' });
      setName(d.customer.name);
    }).catch((e) => setErr((e as Error).message));
  }, [token]);

  if (err) return <div className="login"><div className="box glass"><img className="plogo" src={asset('logo.png')} alt="Barstone" /><h1>לא הצלחנו לפתוח את הקישור</h1><p className="mute">{err}</p></div></div>;
  if (!data || !project) return <div className="login"><div className="spin dark" /></div>;

  const changed = JSON.stringify(project.manual || {}) !== original.current, overlap = !!nest?.overlaps?.length;
  const flat = project.pieces.filter((p) => !isVertical(p)), sinks = project.cutouts.filter((c) => c.kind === 'sink');
  const reset = () => useStore.getState().apply((p) => ({ ...p, manual: JSON.parse(original.current) }));
  async function sign() {
    if (!sig || !agree || name.trim().length < 2 || overlap) return; setBusy(true);
    try {
      const r = await repo.portal<{ signed_at: string }>({ mode: 'sign', token, name: name.trim(), signature: sig, note, manual: project!.manual || {} });
      setSigned({ at: r.signed_at, name: name.trim(), sig }); scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { useStore.getState().setToast((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="portal">
      <header className="p-head"><img src={asset('logo.png')} alt="Barstone" /><span className="sp" /><span className="mute">{data.order.order_no ? `הזמנה ${data.order.order_no}` : ''}</span></header>
      <section className="p-hero">
        <span className="eyebrow">ההדמיה שלך</span>
        <h1>{data.customer.name ? `${data.customer.name}, ` : ''}כך המטבח שלך ייראה</h1>
        <p className="mute">{data.order.title}{data.customer.address ? ` · ${data.customer.address}` : ''}</p>
        {signed && <div className="p-ok"><b>✓ אושר ונחתם</b><span>{signed.name} · {new Date(signed.at).toLocaleString('he-IL')}</span></div>}
      </section>

      <section className="p-3d"><View3D /></section>
      <p className="p-tip">אפשר לסובב את המטבח באצבע, להתקרב ולבחור זווית. כפתור "כיור" מתקרב לאזור הכיור.</p>

      <section className="p-card">
        <div className="p-stone"><i style={{ backgroundImage: `url("${stone.thumb || stone.url}")` }} /><div><span className="eyebrow">האבן שנבחרה</span><b>{stoneLabel(stone)}</b><small>{FINISH_HE[stoneFinish(project, stone.en)]} · {project.thickness} מ"מ · {project.apronH ? `קנט ${cm(project.apronH)} ס"מ` : 'קנט ישר'}</small></div></div>
        <div className="p-facts">
          {flat.map((p) => <div key={p.id}><b>{letter(project.pieces.indexOf(p))}</b><span>{p.name}</span><small className="mono">{cm(Math.max(p.w, p.h))}×{cm(Math.min(p.w, p.h))} ס"מ</small></div>)}
          {sinks.map((c) => <div key={c.id}><b>⌂</b><span>{c.built ? 'כיור בנוי מאבן' : 'כיור'}{c.drainCover ? ' עם ונטיל' : ''}</span><small className="mono">{cm(c.w)}×{cm(c.h)}</small></div>)}
          {project.cutouts.filter((c) => c.kind === 'cooktop').map((c) => <div key={c.id}><b>◎</b><span>{CUT_HE[c.kind]}</span><small className="mono">{cm(c.w)}×{cm(c.h)}</small></div>)}
        </div>
      </section>

      {nest && nest.slabs.length > 0 && <section className="p-card">
        <span className="eyebrow">איפה יעבור הגיד</span>
        <h2>בחרו את החלק היפה בלוח</h2>
        <p className="mute">זו תמונת הלוח האמיתית, וכל חלק מסומן במקום שממנו ייחתך. {signed ? '' : 'גררו חלק כדי להזיז אותו על הלוח, וההדמיה למעלה תתעדכן מיד.'}</p>
        <div className="p-slabs"><Slabs readOnly={!!signed} /></div>
        {overlap && !signed && <div className="note err">שני חלקים חופפים או שחלק יוצא מהלוח. מזיזים אותו למקום פנוי, או לוחצים "חזרה למיקום שהצענו".</div>}
        {changed && !signed && <div className="row"><span className="mute">שיניתם את המיקום.</span><span className="sp" /><button className="btn sm" onClick={reset}>חזרה למיקום שהצענו</button></div>}
      </section>}

      <section className="p-card p-sign">
        <span className="eyebrow">אישור</span>
        {signed ? <>
          <h2>תודה, ההדמיה אושרה</h2>
          <p className="mute">קיבלנו את האישור ונציג Barstone ימשיך איתכם לשלב הבא.</p>
          <div className="sig-done"><img src={signed.sig} alt="חתימה" /><span>{signed.name} · {new Date(signed.at).toLocaleDateString('he-IL')}</span></div>
        </> : <>
          <h2>מאשרים את ההדמיה?</h2>
          <ul className="terms">{TERMS.map((t) => <li key={t}>{t}</li>)}</ul>
          <label className="field"><span>שם מלא</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          <label className="field"><span>הערה לנציג (לא חובה)</span><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <SignaturePad onChange={setSig} />
          <label className="row chk"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />קראתי ואני מאשר/ת את ההדמיה{changed ? ' ואת מיקום החלקים שבחרתי' : ''}</label>
          <button className="btn primary big" disabled={!sig || !agree || name.trim().length < 2 || busy || overlap} onClick={sign}>{busy ? <span className="spin" /> : 'אישור וחתימה'}</button>
        </>}
      </section>
      <footer className="p-foot">Barstone · משטחי אבן ופורצלן</footer>
    </div>
  );
}
