// ניהול הקטלוג (מנהל): סטטוס מלאי, בוק־מאץ', והעלאת תמונת לוח לכל דגם.
import { useEffect, useRef, useState } from 'react';
import { Stone, repo } from '../data/repo';
import { go, useStore } from '../store';
import { Icon } from './icons';
import { asset } from './util';

export function Catalog() {
  const [stones, setStones] = useState<Stone[]>([]), [q, setQ] = useState(''), [busy, setBusy] = useState('');
  const setToast = useStore((s) => s.setToast), bulk = useRef<HTMLInputElement>(null);
  const load = () => repo.stones().then((s) => { setStones(s); useStore.setState({ stones: s }); });
  useEffect(() => { load(); }, []);
  const act = async (label: string, fn: () => Promise<unknown>) => { setBusy(label); try { await fn(); await load(); } catch (e) { setToast((e as Error).message); } setBusy(''); };
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-׳'"|.]+/g, '');
  /** העלאה מרוכזת: שם הקובץ מותאם לשם הדגם; קובץ בלי התאמה יוצר דגם חדש. */
  async function many(files: FileList | null) {
    if (!files?.length) return; let done = 0, made = 0;
    for (const f of Array.from(files)) {
      const base = f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_ ]?\d+$/, '').trim(), hit = stones.find((s) => norm(s.name) === norm(base) || (!!s.en && norm(s.en) === norm(base))) || stones.find((s) => norm(base).includes(norm(s.name)) && s.name.length > 3);
      setBusy(`מעלה ${++done} מתוך ${files.length}…`);
      try { const id = hit?.id ?? (await repo.addStone(base)); if (!hit) made++; if (id != null) await repo.uploadSlab(id, f); } catch (e) { setToast(`${f.name}: ${(e as Error).message}`); }
    }
    await load(); setBusy(''); setToast(`הועלו ${done} תמונות${made ? ` · נוצרו ${made} דגמים חדשים` : ''}`);
  }
  const shown = stones.filter((s) => !q || [s.name, s.en, s.novo].some((t) => t?.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <header className="top"><img className="logo" src={asset('logo.png')} alt="Barstone" onClick={() => go('/')} /><div className="crumb"><a onClick={() => go('/')}>הזמנות</a><i>›</i><b>קטלוג ומלאי</b></div></header>
      <main className="doc" style={{ maxWidth: 1000 }}>
        <div className="sheet">
          <div><h1 style={{ fontSize: 26 }}>קטלוג ומלאי</h1><p className="mute">{stones.length} דגמים · {stones.filter((s) => s.hasImage).length} עם תמונת לוח · {stones.filter((s) => s.stock === 'yes').length} במלאי</p></div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: '1 1 220px' }} placeholder="חיפוש דגם" value={q} onChange={(e) => setQ(e.target.value)} />
            <input ref={bulk} type="file" hidden multiple accept="image/*" onChange={(e) => many(e.target.files)} />
            <button className="btn primary" disabled={!!busy} onClick={() => bulk.current?.click()}><Icon.plus />{busy || 'העלאת תמונות לוחות'}</button>
          </div>
          <div className="note">העלאה מרוכזת: בוחרים הרבה תמונות יחד. שם הקובץ מותאם לשם הדגם (למשל "נורדיק אייס-03.png"); קובץ בלי התאמה יוצר דגם חדש. תמונה אחת של לוח שלם לכל דגם, ביחס 2:1 (320×160).</div>
          <table><thead><tr><th style={{ width: 96 }}>לוח</th><th>דגם</th><th>מלאי</th><th>בוק־מאץ׳</th><th /></tr></thead><tbody>
            {shown.map((s) => (
              <tr key={s.id}>
                <td><div style={{ width: 84, height: 42, borderRadius: 6, background: s.hasImage ? `#ddd url("${s.url}") center/cover` : 'repeating-linear-gradient(45deg,#eee,#eee 6px,#e2e2e2 6px,#e2e2e2 12px)' }} /></td>
                <td>{s.name}{s.en && <span className="mute"> · {s.en}</span>}{s.series && <span className="badge sand" style={{ marginInlineStart: 6 }}>{s.series}</span>}{s.novo && <div className="mute" style={{ fontSize: 12 }}>לשעבר: {s.novo}</div>}{!s.hasImage && <div className="mute" style={{ fontSize: 12 }}>אין תמונת לוח</div>}</td>
                <td><div className="seg">{([['yes', 'כן'], ['no', 'לא'], ['unknown', '?']] as const).map(([k, v]) => <button key={k} className={s.stock === k ? 'on' : ''} onClick={() => act('', () => repo.updateStone(s.id, { in_stock: k }))}>{v}</button>)}</div></td>
                <td><div className="seg">{([[true, 'כן'], [false, 'לא'], [null, '?']] as const).map(([k, v]) => <button key={String(k)} className={(s.bookmatch ?? null) === k ? 'on' : ''} onClick={() => act('', () => repo.updateStone(s.id, { bookmatch: k }))}>{v}</button>)}</div></td>
                <td style={{ textAlign: 'end' }}><label className="link" style={{ cursor: 'pointer' }}>{s.hasImage ? 'החלפת תמונה' : 'העלאת תמונה'}<input type="file" hidden accept="image/*" onChange={(e) => e.target.files?.[0] && act('מעלה…', () => repo.uploadSlab(s.id, e.target.files![0]))} /></label></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </main>
    </>
  );
}
