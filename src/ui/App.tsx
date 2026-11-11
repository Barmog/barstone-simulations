import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isLocal, repo, sb } from '../data/repo';
import { go, parseRoute, useStore } from '../store';
import { Login, Pending } from './Login';
import { Home } from './Home';
import { Studio } from './Studio';
import { Doc } from './Doc';
import { Team } from './Team';
import { Catalog } from './Catalog';

export type Access = 'admin' | 'sales' | 'pending' | 'loading';

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(isLocal ? null : undefined);
  const [access, setAccess] = useState<Access>(isLocal ? 'admin' : 'loading');
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  const toast = useStore((s) => s.toast);

  useEffect(() => { const f = () => setRoute(parseRoute(location.hash)); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const userId = session?.user.id;
  useEffect(() => {
    if (!sb) return;
    if (!userId) { setAccess('loading'); return; }
    repo.claimAccess().then(setAccess).catch(() => setAccess('pending'));
  }, [userId]);

  let body;
  if (!isLocal && session === undefined) body = <div className="login"><div className="spin dark" /></div>;
  else if (!isLocal && !session) body = <Login />;
  else if (access === 'loading') body = <div className="login"><div className="spin dark" /></div>;
  else if (access === 'pending') body = <Pending email={session?.user.email || ''} />;
  else if (route.name === 'studio') body = <Studio key={route.id} id={route.id} />;
  else if (route.name === 'doc') body = <Doc key={route.id} id={route.id} />;
  else if (route.name === 'team' && access === 'admin') body = <Team me={userId || ''} />;
  else if (route.name === 'catalog' && access === 'admin' && !isLocal) body = <Catalog />;
  else body = <Home customerId={route.name === 'home' ? route.customer : undefined} admin={access === 'admin'} email={session?.user.email} />;

  return <>{body}{toast && <div className="toast" role="status">{toast}</div>}</>;
}

export const signOut = async () => { await sb?.auth.signOut(); go('/'); };
