// מסך החיבור לפיירברי: כל משתמש מחבר את הטוקן האישי שלו, והמנהל בוחר איזה אובייקט בפיירברי הוא "הזמנה".
import { useEffect, useState } from 'react';
import { FbSettings, fireberry } from '../data/fireberry';
import { go, useStore } from '../store';
import { asset } from './util';

export function Fireberry({ admin }: { admin: boolean }) {
  const setToast = useStore((s) => s.setToast);
  const [has, setHas] = useState<boolean | null>(null), [ok, setOk] = useState<string>(''), [token, setToken] = useState(''), [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<FbSettings>({}), [objects, setObjects] = useState<{ objecttype: number; name: string }[] | null>(null), [manual, setManual] = useState('');
  const check = async () => { setOk(''); try { const r = await fireberry.status(); setOk(r.connected ? 'מחובר' : ''); } catch (e) { setOk(`לא עובד: ${(e as Error).message}`); } };
  useEffect(() => { fireberry.hasToken().then((h) => { setHas(h); if (h) check(); }); fireberry.settings().then(setSettings); }, []);

  async function save() {
    setBusy(true);
    try { await fireberry.setToken(token); setToken(''); setHas(!!token.trim()); if (token.trim()) await check(); else setOk(''); setToast(token.trim() ? 'הטוקן נשמר' : 'החיבור הוסר'); } catch (e) { setToast((e as Error).message); }
    setBusy(false);
  }
  async function pickMeasure(measureObject: number, measureName: string) { const v = { ...settings, measureObject, measureName }; try { await fireberry.saveSettings(v); setSettings(v); setToast(`מדידות יילקחו מ"${measureName}"`); } catch (e) { setToast((e as Error).message); } }
  async function loadObjects() { try { setObjects(await fireberry.objects()); } catch (e) { setToast((e as Error).message); setObjects([]); } }
  async function pickObject(object: number, objectName: string) { const v = { ...settings, object, objectName }; try { await fireberry.saveSettings(v); setSettings(v); setToast(`הזמנות יילקחו מ"${objectName}"`); } catch (e) { setToast((e as Error).message); } }

  return (
    <>
      <header className="top"><img className="logo" src={asset('logo.png')} alt="Barstone" onClick={() => go('/')} /><div className="crumb"><a onClick={() => go('/')}>הזמנות</a><i>›</i><b>פיירברי</b></div></header>
      <main className="doc">
        <div className="sheet">
          <div><h1 style={{ fontSize: 26 }}>חיבור לפיירברי</h1><p className="mute">כל אחד מחבר את המשתמש שלו, ורואה כאן בדיוק את הלקוחות וההזמנות שמותר לו לראות בפיירברי.</p></div>
          <section className="col">
            <div className="row"><b>החיבור שלי</b><span className="sp" />{has === null ? <span className="spin dark" /> : has ? <span className={`badge ${ok === 'מחובר' ? 'ok' : ok ? 'err' : ''}`}>{ok || 'בודק…'}</span> : <span className="badge">לא מחובר</span>}</div>
            <ol style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.8, fontSize: 14 }}>
              <li>בפיירברי לוחצים על התמונה שלכם למעלה › <b>פרופיל</b> › לשונית <b>אבטחת חשבון</b> (Account Security).</li>
              <li>באזור <b>API Access Token</b> מעתיקים את ה-TokenID.</li>
              <li>מדביקים כאן ושומרים. הטוקן נשמר בשרת בלבד ולא מוצג שוב.</li>
            </ol>
            <div className="row"><input className="input" type="password" autoComplete="off" dir="ltr" placeholder={has ? 'טוקן חדש (להחלפה)' : 'TokenID מפיירברי'} value={token} onChange={(e) => setToken(e.target.value)} />
              <button className="btn primary" disabled={busy || !token.trim()} onClick={save}>{busy ? <span className="spin" /> : 'שמירה'}</button></div>
            {has && <div className="row"><button className="link" onClick={check}>בדיקת חיבור</button><span className="sp" /><button className="link" onClick={() => { setToken(''); fireberry.setToken('').then(() => { setHas(false); setOk(''); setToast('החיבור הוסר'); }); }}>ניתוק</button></div>}
          </section>
          <section className="col">
            <div className="row"><b>מאיפה לוקחים הזמנות</b><span className="sp" /><span className="badge sand">{settings.objectName ? `${settings.objectName} (${settings.object})` : 'עוד לא נבחר'}</span></div>
            <p className="mute" style={{ fontSize: 13.5 }}>כשפותחים הזמנה ללקוח שיובא מפיירברי, מוצגות הרשומות שלו באובייקט הזה, וה-PDF של ההדמיה מצורף לרשומה שנבחרה.</p>
            {admin ? <>
              {objects === null ? <button className="btn sm" disabled={!has} onClick={loadObjects}>הצגת האובייקטים מפיירברי</button>
                : objects.length ? <div className="chips">{objects.map((o) => <button key={o.objecttype} className={`chip ${settings.object === o.objecttype ? 'on' : ''}`} onClick={() => pickObject(o.objecttype, o.name)}>{o.name} · {o.objecttype}</button>)}</div>
                : <div className="note">לא הצלחתי לקבל את רשימת האובייקטים. אפשר להקליד את מספר האובייקט ידנית.</div>}
              <div className="row"><input className="input" dir="ltr" placeholder="מספר אובייקט (למשל 13)" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} style={{ maxWidth: 200 }} /><button className="btn sm" disabled={!manual} onClick={() => pickObject(+manual, `אובייקט ${manual}`)}>שמירה</button></div>
              {!has && <div className="note">קודם מחברים את הטוקן שלך, ואז אפשר לראות את רשימת האובייקטים.</div>}
            </> : <div className="mute" style={{ fontSize: 13 }}>המנהל בוחר את האובייקט.</div>}
          </section>
          <section className="col">
            <div className="row"><b>מאיפה לוקחים מדידות</b><span className="sp" /><span className="badge sand">{settings.measureName ? `${settings.measureName} (${settings.measureObject})` : 'מדידה (1001) · ברירת מחדל'}</span></div>
            <p className="mute" style={{ fontSize: 13.5 }}>בהזמנה חדשה מוצגות המדידות של הלקוח מהאובייקט הזה, עם הקבצים שצורפו אליהן (PDF, DXF או תמונה). בלחיצה הקובץ נכנס ישר לבניית המטבח.</p>
            {admin && objects && objects.length > 0 && <div className="chips">{objects.map((o) => <button key={o.objecttype} className={`chip ${(settings.measureObject || 1001) === o.objecttype ? 'on' : ''}`} onClick={() => pickMeasure(o.objecttype, o.name)}>{o.name} · {o.objecttype}</button>)}</div>}
            {admin && objects === null && <button className="btn sm" disabled={!has} onClick={loadObjects}>הצגת האובייקטים מפיירברי</button>}
          </section>
        </div>
      </main>
    </>
  );
}
