// שליחה ללקוח לאישור: קישור אישי (בוואטסאפ או בהעתקה), ומעקב — נשלח · נצפה · אושר ונחתם.
import { useEffect, useState } from 'react';
import { Share, isDemoOnLive, repo } from '../data/repo';
import { useStore } from '../store';
import { Modal } from './Home';

// בדמו הקישור נשאר בדמו (אחרת הוא נפתח מול המערכת האמיתית ולא נמצא)
export const shareUrl = (token: string) => `${location.origin}${location.pathname}${isDemoOnLive ? '?demo' : ''}#/p/${token}`;
const when = (s?: string | null) => (s ? new Date(s).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '');

/** הקישור האחרון של ההזמנה (למסמך ולסטודיו). */
export function useShares(orderId?: string) {
  const [list, setList] = useState<Share[]>([]);
  const load = () => { if (orderId) repo.shares(orderId).then(setList).catch(() => setList([])); };
  useEffect(load, [orderId]);
  return { list, signed: list.find((x) => x.signed_at), reload: load };
}

export function ShareModal({ orderId, title, phone, onClose }: { orderId: string; title: string; phone?: string | null; onClose: () => void }) {
  const { list, reload } = useShares(orderId), flush = useStore((s) => s.flush), setToast = useStore((s) => s.setToast);
  const [busy, setBusy] = useState(false);
  const cur = list[0];
  async function create() {
    setBusy(true);
    try { await flush(); await repo.createShare(orderId); reload(); } catch (e) { setToast(`לא נוצר קישור: ${(e as Error).message}`); }
    setBusy(false);
  }
  const url = cur ? shareUrl(cur.token) : '';
  const msg = `שלום, מצורפת ההדמיה של ${title} מ-Barstone. אפשר לסובב את המטבח, לבחור איפה יעבור הגיד על הלוח, ולאשר בחתימה: ${url}`;
  const wa = `https://wa.me/${(phone || '').replace(/\D/g, '').replace(/^0/, '972')}?text=${encodeURIComponent(msg)}`;
  return (
    <Modal title="שליחה ללקוח לאישור" onClose={onClose}>
      <p className="mute" style={{ margin: 0 }}>הלקוח מקבל קישור אישי: רואה את המטבח בתלת־ממד, בוחר על הלוח האמיתי איפה יעבור הגיד, ומאשר בחתימה. כשהוא חותם, ההזמנה עוברת ל"אושר" והחתימה נכנסת למסמך.</p>
      {cur ? <>
        <div className="sharebox"><input className="input mono" readOnly value={url} onFocus={(e) => e.target.select()} /><button className="btn" onClick={() => navigator.clipboard?.writeText(url).then(() => setToast('הקישור הועתק'))}>העתקה</button></div>
        <div className="row"><a className="btn primary" href={wa} target="_blank" rel="noreferrer">שליחה בוואטסאפ</a><a className="btn" href={url} target="_blank" rel="noreferrer">פתיחה כמו הלקוח</a><span className="sp" /><button className="link" disabled={busy} onClick={create}>קישור חדש</button></div>
        <ol className="track">
          <li className="on"><b>נשלח</b><span>{when(cur.created_at)}</span></li>
          <li className={cur.viewed_at ? 'on' : ''}><b>נצפה</b><span>{when(cur.viewed_at) || 'עוד לא נפתח'}</span></li>
          <li className={cur.signed_at ? 'on' : ''}><b>אושר ונחתם</b><span>{cur.signed_at ? `${cur.signer_name} · ${when(cur.signed_at)}` : 'ממתין'}</span></li>
        </ol>
        {cur.signed_at && <div className="note">{cur.layout_changed ? 'הלקוח שינה את מיקום החלקים על הלוח, והסידור שבחר נשמר בהזמנה.' : 'הלקוח אישר את הסידור שהוצע.'}{cur.customer_note ? ` הערת הלקוח: "${cur.customer_note}"` : ''}</div>}
        {cur.signature && <img className="sigimg" src={cur.signature} alt="חתימת הלקוח" />}
        <small className="mute">הקישור בתוקף עד {new Date(cur.expires_at).toLocaleDateString('he-IL')}. שינויים שתעשו בהזמנה יופיעו ללקוח בקישור הקיים.</small>
      </> : <button className="btn primary" disabled={busy} onClick={create}>{busy ? <span className="spin" /> : 'יצירת קישור ללקוח'}</button>}
    </Modal>
  );
}
