import { useEffect, useState } from 'react';
import { repo } from '../data/repo';
import { go, useStore } from '../store';
import { Icon } from './icons';

export function Team({ me }: { me: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof repo.team>>>({ staff: [], invites: [] });
  const [email, setEmail] = useState(''), [role, setRole] = useState<'sales' | 'admin'>('sales');
  const setToast = useStore((s) => s.setToast);
  const load = () => repo.team().then(setData);
  useEffect(() => { load(); }, []);
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); await load(); } catch (e) { setToast((e as Error).message); } };

  return (
    <>
      <header className="top"><img className="logo" src="/logo.png" alt="Barstone" onClick={() => go('/')} /><div className="crumb"><a onClick={() => go('/')}>הזמנות</a><i>›</i><b>צוות</b></div></header>
      <main className="doc">
        <div className="sheet">
          <div><h1 style={{ fontSize: 26 }}>צוות והרשאות</h1><p className="mute">רק מי שמופיע כאן רואה לקוחות והזמנות. מוסיפים אימייל, והעובד נרשם באתר עם אותו אימייל.</p></div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: '1 1 220px' }} dir="ltr" type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="seg"><button className={role === 'sales' ? 'on' : ''} onClick={() => setRole('sales')}>איש מכירות</button><button className={role === 'admin' ? 'on' : ''} onClick={() => setRole('admin')}>מנהל</button></div>
            <button className="btn primary" disabled={!/.+@.+\..+/.test(email)} onClick={() => act(async () => { await repo.invite(email, role); setEmail(''); })}><Icon.plus />הוספה</button>
          </div>
          <table><thead><tr><th>אימייל</th><th>תפקיד</th><th>מצב</th><th /></tr></thead><tbody>
            {data.staff.map((s) => <tr key={s.user_id}><td className="mono">{s.email}</td><td>{s.role === 'admin' ? 'מנהל' : 'איש מכירות'}</td><td><span className="badge ok">פעיל</span></td><td style={{ textAlign: 'end' }}>{s.user_id !== me && <button className="link" onClick={() => confirm(`להסיר את ${s.email} מהצוות?`) && act(() => repo.removeStaff(s.user_id))}>הסרה</button>}</td></tr>)}
            {data.invites.map((s) => <tr key={s.email}><td className="mono">{s.email}</td><td>{s.role === 'admin' ? 'מנהל' : 'איש מכירות'}</td><td><span className="badge sand">ממתין להרשמה</span></td><td style={{ textAlign: 'end' }}><button className="link" onClick={() => act(() => repo.removeInvite(s.email))}>ביטול</button></td></tr>)}
          </tbody></table>
        </div>
      </main>
    </>
  );
}
