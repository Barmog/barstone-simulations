// הסטודיו: מסך חי אחד — שרטוט, תלת־ממד ולוחות יחד. כל שינוי מתעדכן בכולם ונשמר אוטומטית.
import { useEffect, useState } from 'react';
import { exportNestDxf } from '../core/dxf';
import { Customer, repo } from '../data/repo';
import { go, useStore } from '../store';
import { Icon } from './icons';
import { asset } from './util';
import { LeftPanel, RightPanel } from './Panels';
import { Plan2D } from './Plan2D';
import { Slabs } from './Slabs';
import { View3D } from './View3D';

const SAVE_HE = { saved: 'נשמר', dirty: 'שומר…', saving: 'שומר…', error: 'השמירה נכשלה' };

export function useOrder(id: string) {
  const order = useStore((s) => s.order);
  const [customer, setCustomer] = useState<Customer | null>(null), [missing, setMissing] = useState(false);
  useEffect(() => {
    const st = useStore.getState(); st.loadStones();
    if (st.order?.id !== id) repo.order(id).then((o) => (o && o.project?.pieces ? st.open(o) : setMissing(true))).catch(() => setMissing(true));
  }, [id]);
  useEffect(() => { if (order?.id === id) repo.customers().then((cs) => setCustomer(cs.find((c) => c.id === order.customer_id) || null)).catch(() => {}); }, [order?.id]);
  return { order: order?.id === id ? order : null, customer, missing };
}

export function Studio({ id }: { id: string }) {
  const { order, customer, missing } = useOrder(id);
  const save = useStore((s) => s.save), canUndo = useStore((s) => s.past.length > 0), canRedo = useStore((s) => s.future.length > 0), nest = useStore((s) => s.nest);
  const { undo, redo, flush } = useStore.getState();
  const [mode, setMode] = useState<'split' | 'plan' | '3d'>('split');

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || /INPUT|TEXTAREA/.test((e.target as HTMLElement).tagName)) return;
      const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } else if (k === 'y') { e.preventDefault(); redo(); } else if (k === 's') { e.preventDefault(); flush(); }
    };
    const leave = () => { flush(); };
    addEventListener('keydown', key); addEventListener('beforeunload', leave); addEventListener('pagehide', leave);
    return () => { removeEventListener('keydown', key); removeEventListener('beforeunload', leave); removeEventListener('pagehide', leave); flush(); };
  }, []);

  if (missing) return <div className="login"><div className="box glass"><h1>ההזמנה לא נמצאה</h1><button className="btn primary" onClick={() => go('/')}>חזרה להזמנות</button></div></div>;
  if (!order) return <div className="login"><div className="spin dark" /></div>;

  const dxf = () => { if (!nest) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([exportNestDxf(nest.slabs)], { type: 'application/dxf' })); a.download = `${order.title}-nesting.dxf`; a.click(); URL.revokeObjectURL(a.href); };
  return (
    <div className="studio">
      <header className="top">
        <img className="logo" src={asset('logo.png')} alt="Barstone" onClick={() => go('/')} />
        <div className="crumb"><a onClick={() => go('/')}>הזמנות</a><i>›</i>{customer && <><a onClick={() => go(`/c/${customer.id}`)}>{customer.name}</a><i>›</i></>}<b>{order.title}</b></div>
        <span className={`savestate ${save}`}>{SAVE_HE[save]}</span>
        <span className="sp" />
        <div className="pill"><button title="ביטול (Ctrl+Z)" disabled={!canUndo} style={{ opacity: canUndo ? 1 : 0.35 }} onClick={undo}><Icon.undo />ביטול</button><button title="חזרה (Ctrl+Shift+Z)" disabled={!canRedo} style={{ opacity: canRedo ? 1 : 0.35 }} onClick={redo}><Icon.redo />חזרה</button></div>
        <div className="pill">{([['split', 'מפוצל'], ['plan', 'שרטוט'], ['3d', 'תלת־ממד']] as const).map(([k, v]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{v}</button>)}</div>
        <button className="btn sm" title="ייצוא תוכנית החיתוך ל-DXF" onClick={dxf}><Icon.download />DXF</button>
        <button className="btn sm primary" onClick={() => { flush(); go(`/o/${id}/doc`); }}><Icon.doc />מסמך ללקוח</button>
      </header>
      <div className="work">
        <LeftPanel />
        <div className={`center ${mode === '3d' ? 'max' : ''}`}>
          <div className={`views ${mode !== 'split' ? 'one' : ''}`}>
            {mode !== '3d' && <Plan2D />}
            {mode !== 'plan' && <View3D max={mode === '3d'} onMax={() => setMode(mode === '3d' ? 'split' : '3d')} />}
          </div>
          {mode !== '3d' && <Slabs />}
        </div>
        <RightPanel />
      </div>
    </div>
  );
}
