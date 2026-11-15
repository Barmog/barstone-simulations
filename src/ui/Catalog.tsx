// ניהול הקטלוג (מנהל): סטטוס מלאי, בוק־מאץ', והעלאת תמונת לוח לכל דגם.
import { useEffect, useRef, useState } from 'react';
import { Stone, repo } from '../data/repo';
import { go, useStore } from '../store';
import { Icon } from './icons';
import { asset, slabJpeg } from './util';
import { CatalogMatch, scanCatalog } from './catalogImport';
import { Modal } from './Home';

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
      try { const id = hit?.id ?? (await repo.addStone(base)); if (!hit) made++; if (id != null) await repo.uploadSlab(id, await slabJpeg(f)); } catch (e) { setToast(`${f.name}: ${(e as Error).message}`); }
    }
    await load(); setBusy(''); setToast(`הועלו ${done} תמונות${made ? ` · נוצרו ${made} דגמים חדשים` : ''}`);
  }
  // ייבוא מקטלוג ה-PDF: סורקים, מציגים לאישור (לחיצה על תמונה מחליפה לתמונה הבאה מאותו עמוד), ושומרים
  const pdfIn = useRef<HTMLInputElement>(null), [matches, setMatches] = useState<(CatalogMatch & { pick: number; on: boolean })[] | null>(null);
  async function fromPdf(f?: File) {
    if (!f) return; setBusy('קורא את הקטלוג…');
    try {
      const m = await scanCatalog(f, stones, setBusy);
      if (!m.length) setToast('לא מצאתי בקטלוג שמות של דגמים מהרשימה.');
      else setMatches(m.map((x) => ({ ...x, pick: 0, on: !x.stone.hasImage })));
    } catch (e) { setToast(`הקטלוג לא נקרא: ${(e as Error).message}`); }
    setBusy('');
  }
  const closeMatches = () => { matches?.forEach((m) => m.images.forEach((u) => URL.revokeObjectURL(u))); setMatches(null); };
  async function saveMatches() {
    const list = (matches || []).filter((m) => m.on); let i = 0;
    for (const m of list) {
      setBusy(`שומר ${++i} מתוך ${list.length}…`);
      try { await repo.uploadSlab(m.stone.id, await (await fetch(m.images[m.pick])).blob()); } catch (e) { setToast(`${m.stone.name}: ${(e as Error).message}`); }
    }
    closeMatches(); await load(); setBusy(''); setToast(`נשמרו ${list.length} תמונות לוח מהקטלוג`);
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
            <input ref={bulk} type="file" hidden multiple accept="image/*,.tif,.tiff" onChange={(e) => many(e.target.files)} />
            <button className="btn primary" disabled={!!busy} onClick={() => bulk.current?.click()}><Icon.plus />{busy || 'העלאת תמונות לוחות'}</button>
            <input ref={pdfIn} type="file" hidden accept="application/pdf,.pdf" onChange={(e) => { fromPdf(e.target.files?.[0]); e.target.value = ''; }} />
            <button className="btn" disabled={!!busy} onClick={() => pdfIn.current?.click()}>ייבוא מקטלוג ה-PDF</button>
          </div>
          <div className="note">העלאה מרוכזת: בוחרים הרבה תמונות יחד. שם הקובץ מותאם לשם הדגם (למשל "נורדיק אייס-03.png"); קובץ בלי התאמה יוצר דגם חדש. תמונה אחת של לוח שלם לכל דגם, ביחס 2:1 (320×160).</div>
          <table><thead><tr><th style={{ width: 96 }}>לוח</th><th>דגם</th><th>מלאי</th><th>בוק־מאץ׳</th><th /></tr></thead><tbody>
            {shown.map((s) => (
              <tr key={s.id}>
                <td><div style={{ width: 84, height: 42, borderRadius: 6, background: s.hasImage ? `#ddd url("${s.url}") center/cover` : 'repeating-linear-gradient(45deg,#eee,#eee 6px,#e2e2e2 6px,#e2e2e2 12px)' }} /></td>
                <td>{s.name}{s.en && <span className="mute"> · {s.en}</span>}{s.series && <span className="badge sand" style={{ marginInlineStart: 6 }}>{s.series}</span>}{s.novo && <div className="mute" style={{ fontSize: 12 }}>לשעבר: {s.novo}</div>}{!s.hasImage && <div className="mute" style={{ fontSize: 12 }}>אין תמונת לוח</div>}</td>
                <td><div className="seg">{([['yes', 'כן'], ['no', 'לא'], ['unknown', '?']] as const).map(([k, v]) => <button key={k} className={s.stock === k ? 'on' : ''} onClick={() => act('', () => repo.updateStone(s.id, { in_stock: k }))}>{v}</button>)}</div></td>
                <td><div className="seg">{([[true, 'כן'], [false, 'לא'], [null, '?']] as const).map(([k, v]) => <button key={String(k)} className={(s.bookmatch ?? null) === k ? 'on' : ''} onClick={() => act('', () => repo.updateStone(s.id, { bookmatch: k }))}>{v}</button>)}</div></td>
                <td style={{ textAlign: 'end' }}><label className="link" style={{ cursor: 'pointer' }}>{s.hasImage ? 'החלפת תמונה' : 'העלאת תמונה'}<input type="file" hidden accept="image/*,.tif,.tiff" onChange={(e) => e.target.files?.[0] && act('מעלה…', () => (async () => repo.uploadSlab(s.id, await slabJpeg(e.target.files![0])))())} /></label></td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </main>
      {matches && <Modal wide title={`נמצאו ${matches.length} דגמים בקטלוג`} onClose={closeMatches}>
        <p className="mute" style={{ margin: 0 }}>מסומנים הדגמים שאין להם עדיין תמונה. אם נבחרה תמונה לא נכונה (למשל צילום מטבח), לוחצים עליה כדי לעבור לתמונה הבאה מאותו עמוד.</p>
        <div className="pdfgrid">{matches.map((m, k) => (
          <label key={String(m.stone.id)} className={`pdfrow ${m.on ? 'on' : ''}`}>
            <input type="checkbox" checked={m.on} onChange={(e) => setMatches(matches.map((x, j) => (j === k ? { ...x, on: e.target.checked } : x)))} />
            <i title="לחיצה: התמונה הבאה" style={{ backgroundImage: `url("${m.images[m.pick]}")` }} onClick={(e) => { e.preventDefault(); setMatches(matches.map((x, j) => (j === k ? { ...x, pick: (x.pick + 1) % x.images.length } : x))); }} />
            <span><b>{m.stone.name}</b><small className="mute">{m.stone.en} · עמוד {m.page}{m.images.length > 1 ? ` · ${m.pick + 1}/${m.images.length}` : ''}{m.stone.hasImage ? ' · יש כבר תמונה' : ''}</small></span>
          </label>))}</div>
        <div className="row"><span className="sp" /><button className="btn" onClick={closeMatches}>ביטול</button><button className="btn primary" disabled={!!busy || !matches.some((m) => m.on)} onClick={saveMatches}>{busy || `שמירת ${matches.filter((m) => m.on).length} תמונות`}</button></div>
      </Modal>}
    </>
  );
}
