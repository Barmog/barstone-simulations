import { FormEvent, useState } from 'react';
import { sb } from '../data/repo';

const HE: Record<string, string> = {
  'Invalid login credentials': 'אימייל או סיסמה שגויים.',
  'Email not confirmed': 'האימייל עוד לא אושר — לחצו על הקישור שנשלח אליכם.',
  'User already registered': 'כבר קיים חשבון עם האימייל הזה — נסו להתחבר.',
};

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState(''), [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [info, setInfo] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault(); if (!sb) return;
    setBusy(true); setErr(''); setInfo('');
    const r = mode === 'in' ? await sb.auth.signInWithPassword({ email, password: pass }) : await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: location.origin } });
    setBusy(false);
    if (r.error) return setErr(HE[r.error.message] || r.error.message);
    if (mode === 'up' && !r.data.session) setInfo('נשלח אליכם אימייל לאישור. אחרי האישור אפשר להתחבר.');
  }
  async function reset() {
    if (!sb || !email) return setErr('הקלידו קודם את האימייל.');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
    error ? setErr(error.message) : setInfo('נשלח קישור לאיפוס סיסמה.');
  }

  return (
    <div className="login">
      <form className="box glass" onSubmit={submit}>
        <img src="/logo.png" alt="Barstone" />
        <div><h1>{mode === 'in' ? 'ברוכים הבאים' : 'יצירת חשבון'}</h1><p className="mute">סטודיו ההדמיות של Barstone</p></div>
        <label className="field">אימייל<input type="email" required autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">סיסמה<input type="password" required minLength={8} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} dir="ltr" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
        {err && <div className="note err">{err}</div>}
        {info && <div className="note">{info}</div>}
        <button className="btn primary" disabled={busy}>{busy ? <span className="spin" /> : mode === 'in' ? 'כניסה' : 'הרשמה'}</button>
        <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
          <button type="button" className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); setInfo(''); }}>{mode === 'in' ? 'אין לי חשבון עדיין' : 'יש לי כבר חשבון'}</button>
          {mode === 'in' && <button type="button" className="link" onClick={reset}>שכחתי סיסמה</button>}
        </div>
      </form>
    </div>
  );
}

export function Pending({ email }: { email: string }) {
  return (
    <div className="login">
      <div className="box glass">
        <img src="/logo.png" alt="Barstone" />
        <div><h1>ממתין לאישור</h1><p className="mute">החשבון <span className="mono">{email}</span> נוצר, אבל עדיין לא צורף לצוות.</p></div>
        <div className="note">מנהל המערכת צריך להוסיף את האימייל שלכם במסך "צוות". אחרי זה רעננו את הדף.</div>
        <div className="row"><button className="btn primary" onClick={() => location.reload()}>רענון</button><button className="btn" onClick={() => sb?.auth.signOut()}>יציאה</button></div>
      </div>
    </div>
  );
}
