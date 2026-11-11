// השוואת דגמים: אותו מטבח בשניים־שלושה דגמי אבן זה לצד זה, ובחירה בלחיצה.
import { useState } from 'react';
import { useStore } from '../store';
import { Modal } from './Home';
import { useStone } from './util';
import { View3D } from './View3D';

const STOCK = { yes: 'במלאי', no: 'אין במלאי', unknown: 'מלאי לא ידוע' };

export function Compare({ onClose }: { onClose: () => void }) {
  const stones = useStore((s) => s.stones), apply = useStore((s) => s.apply), current = useStone();
  const withImg = stones.filter((s) => s.hasImage), others = withImg.filter((s) => String(s.id) !== String(current.id));
  const [ids, setIds] = useState<string[]>([String(current.id), ...others.slice(0, 2).map((s) => String(s.id))]);
  if (withImg.length < 2) return <Modal title="השוואת דגמים" onClose={onClose}><div className="note">צריך לפחות שני דגמים עם תמונת לוח כדי להשוות.</div></Modal>;
  return (
    <Modal title="השוואת דגמים — אותו מטבח, אבן אחרת" onClose={onClose} wide>
      <div className="compare">
        {ids.map((id, n) => {
          const st = stones.find((s) => String(s.id) === id) || current;
          return (
            <div key={n} className="cmp">
              <select className="input" value={id} onChange={(e) => setIds(ids.map((x, i) => (i === n ? e.target.value : x)))}>{withImg.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}</select>
              <div className="cmpview"><View3D still stoneUrl={st.url} /></div>
              <div className="row"><span className={`badge ${st.stock === 'yes' ? 'ok' : st.stock === 'no' ? 'err' : ''}`}>{STOCK[st.stock]}</span><span className="sp" />
                {String(current.id) === id ? <span className="badge sand">הדגם הנוכחי</span> : <button className="btn sm primary" onClick={() => { apply((p) => ({ ...p, stoneId: st.id })); onClose(); }}>בחר דגם זה</button>}</div>
            </div>
          );
        })}
      </div>
      <div className="note">ההדמיה להמחשה בלבד — אין התחייבות לגידים.</div>
    </Modal>
  );
}
