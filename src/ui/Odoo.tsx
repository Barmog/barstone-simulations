// מסך החיבור ל-Odoo: המנהל מחבר פעם אחת (כתובת, מסד, משתמש ומפתח API), וכאן גם ההוראות לכפתור "הדמיה" בהזמנה ב-Odoo.
import { useEffect, useState } from 'react';
import { OdooInfo, odoo } from '../data/odoo';
import { go, useStore } from '../store';
import { asset } from './util';

const APP = typeof location === 'undefined' ? '' : location.origin + location.pathname;
const ACTION = `action = {\n    'type': 'ir.actions.act_url',\n    'url': '${APP}?odoo=%s' % record.id,\n    'target': 'new',\n}`;

export function Odoo({ admin }: { admin: boolean }) {
  const setToast = useStore((s) => s.setToast);
  const [info, setInfo] = useState<OdooInfo | null | undefined>(undefined), [st, setSt] = useState(''), [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(''), [db, setDb] = useState(''), [login, setLogin] = useState(''), [key, setKey] = useState('');
  const check = async () => { setSt('בודק…'); try { const r = await odoo.status(); setSt(r.connected ? `מחובר${r.version ? ` · Odoo ${r.version}` : ''}` : `לא מחובר: ${r.error || ''}`); } catch (e) { setSt(`לא עובד: ${(e as Error).message}`); } };
  useEffect(() => { odoo.info().then((i) => { setInfo(i); if (i) { setUrl(i.url); setDb(i.db); setLogin(i.login); check(); } }).catch(() => setInfo(null)); }, []);
  async function save() {
    setBusy(true);
    try { await odoo.save(url.trim(), db.trim(), login.trim(), key.trim()); setKey(''); const i = await odoo.info(); setInfo(i); if (i) { setDb(i.db); await check(); } else setSt(''); setToast(i ? 'החיבור נשמר' : 'החיבור הוסר'); }
    catch (e) { setToast((e as Error).message); }
    setBusy(false);
  }
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => setToast('הועתק'));
  const ok = st.startsWith('מחובר');
  return (
    <>
      <header className="top"><img className="logo" src={asset('logo.png')} alt="Barstone" onClick={() => go('/')} /><div className="crumb"><a onClick={() => go('/')}>הזמנות</a><i>›</i><b>Odoo</b></div></header>
      <main className="doc">
        <div className="sheet">
          <div><h1 style={{ fontSize: 26 }}>חיבור ל-Odoo</h1><p className="mute">מכל הזמנת מכירה ב-Odoo נפתחת ההדמיה של הלקוח בלחיצה, והטופס המאושר חוזר ומצורף להזמנה.</p></div>
          <section className="col">
            <div className="row"><b>החיבור של החברה</b><span className="sp" />{info === undefined ? <span className="spin dark" /> : info ? <span className={`badge ${ok ? 'ok' : st.startsWith('בודק') ? 'sand' : 'err'}`}>{st || 'נשמר'}</span> : <span className="badge">לא מחובר</span>}</div>
            {admin ? <>
              <ol style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.8, fontSize: 14 }}>
                <li>ב-Odoo: לוחצים על המשתמש למעלה › <b>My Profile / העדפות</b> › לשונית <b>Account Security</b> › <b>New API Key</b>. כדאי משתמש ייעודי ("Barstone הדמיות") עם הרשאת מכירות.</li>
                <li>ממלאים כאן את כתובת ה-Odoo, שם המסד, המייל של המשתמש והמפתח. המפתח נשמר בשרת בלבד ולא מוצג שוב.</li>
              </ol>
              <label className="field">כתובת ה-Odoo<input className="input" dir="ltr" placeholder="https://mycompany.odoo.com" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
              <div className="grid2">
                <label className="field">שם המסד · לא חובה כשיש מסד אחד<input className="input" dir="ltr" placeholder="mycompany" value={db} onChange={(e) => setDb(e.target.value)} /></label>
                <label className="field">משתמש (מייל) · לא חובה ב-Odoo 19 ומעלה<input className="input" dir="ltr" autoComplete="off" placeholder="user@company.co.il" value={login} onChange={(e) => setLogin(e.target.value)} /></label>
              </div>
              <label className="field">מפתח API<input className="input" type="password" autoComplete="new-password" dir="ltr" placeholder={info ? 'מפתח חדש (להחלפה). ריק = נשאר המפתח הקיים' : 'API Key מ-Odoo'} value={key} onChange={(e) => setKey(e.target.value)} /></label>
              <div className="row"><button className="btn primary" disabled={busy || !url.trim() || (!info && !key.trim())} onClick={save}>{busy ? <span className="spin" /> : 'שמירה ובדיקה'}</button>
                {info && <button className="link" onClick={check}>בדיקת חיבור</button>}<span className="sp" />
                {info && <button className="link" onClick={async () => { if (!confirm('לנתק את Odoo?')) return; setUrl(''); setBusy(true); try { await odoo.save('', '', '', ''); setInfo(null); setSt(''); setDb(''); setLogin(''); } catch (e) { setToast((e as Error).message); } setBusy(false); }}>ניתוק</button>}</div>
            </> : <p className="mute">{info ? `מחובר ל-${info.url}. רק מנהל יכול לשנות את החיבור.` : 'המנהל עוד לא חיבר את Odoo.'}</p>}
          </section>
          <section className="col">
            <b>כפתור "הדמיה" בכל הזמנה ב-Odoo</b>
            <p className="mute" style={{ margin: 0 }}>הכפתור פותח את האתר הזה עם מספר ההזמנה. אם כבר יש להזמנה הדמיה היא נפתחת; אם לא, הלקוח נוצר לבד מהפרטים שב-Odoo ונפתחת הזמנה חדשה מקושרת.</p>
            <div className="note"><b>דרך א׳ · בלי התקנה (עובד גם ב-Odoo Online):</b> פעולת שרת שמופיעה בתפריט "פעולה" של ההזמנה.
              <ol style={{ margin: '6px 0 0', paddingInlineStart: 20, lineHeight: 1.7 }}>
                <li>מפעילים מצב מפתח (Settings › Activate developer mode).</li>
                <li>Settings › Technical › Server Actions › New.</li>
                <li>Name: <b>הדמיית Barstone</b> · Model: <b>Sales Order</b> · Type: <b>Execute Code</b>.</li>
                <li>מדביקים את הקוד שלמטה, שומרים, ולוחצים <b>Create Contextual Action</b>.</li>
              </ol>
            </div>
            <div className="sharebox"><textarea className="input mono" dir="ltr" readOnly rows={5} value={ACTION} style={{ fontSize: 12.5, resize: 'none' }} onFocus={(e) => e.target.select()} /><button className="btn" onClick={() => copy(ACTION)}>העתקה</button></div>
            <div className="note"><b>דרך ב׳ · כפתור אמיתי בראש ההזמנה (Odoo.sh):</b> מתקינים את המודול <span className="mono" dir="ltr">barstone_simulation</span> שנמצא במאגר ה-Odoo שלנו (Apps › Update Apps List › "BarStone: הדמיות" › Install). הוא מוסיף כפתור "הדמיה" בראש טופס ההזמנה. כתובת האתר נקבעת בפרמטר המערכת <span className="mono" dir="ltr">barstone.simulation_url</span>:</div>
            <div className="sharebox"><input className="input mono" dir="ltr" readOnly value={APP} onFocus={(e) => e.target.select()} /><button className="btn" onClick={() => copy(APP)}>העתקה</button></div>
          </section>
        </div>
      </main>
    </>
  );
}
