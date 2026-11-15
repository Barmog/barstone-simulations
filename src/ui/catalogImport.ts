// ייבוא תמונות לוח מקטלוג ה-PDF שלנו: כל דגם מזוהה לפי השם שלו בעמוד, ומהעמוד (ומהעמוד שלידו)
// נלקחות התמונות שנראות כמו לוח שלם. הכול רץ בדפדפן, כך שגם קטלוג של עשרות מגה עובד.
import type { Stone } from '../data/repo';

export interface CatalogMatch { stone: Stone; page: number; images: string[] }

const en = (s: string) => ` ${s.toUpperCase().replace(/[^A-Z]+/g, ' ').trim()} `;
const heWords = (s: string) => s.replace(/[^א-ת\s]+/g, '').split(/\s+/).filter(Boolean);
const rev = (s: string) => [...s].reverse().join('');

/** קנבס → JPEG, תמיד לרוחב ועד 2400 פיקסלים. */
async function toJpeg(src: CanvasImageSource, w: number, h: number): Promise<string | null> {
  const rot = h > w, k = Math.min(1, 2400 / Math.max(w, h)), W = Math.round(w * k), H = Math.round(h * k);
  const cv = document.createElement('canvas'); cv.width = rot ? H : W; cv.height = rot ? W : H;
  const g = cv.getContext('2d')!; if (rot) { g.translate(H, 0); g.rotate(Math.PI / 2); }
  g.drawImage(src, 0, 0, W, H);
  // דוגמת אבן ריבועית: חותכים לצורת לוח (2:1) במקום למתוח את הגידים
  let out = cv;
  if (cv.width / cv.height < 1.9) { out = document.createElement('canvas'); out.width = cv.width; out.height = Math.round(cv.width / 2); out.getContext('2d')!.drawImage(cv, 0, Math.round((cv.height - out.height) / 2), out.width, out.height, 0, 0, out.width, out.height); }
  const b = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/jpeg', 0.86));
  return b ? URL.createObjectURL(b) : null;
}

/** תמונה מתוך PDF (pdf.js) → קנבס. */
function imgCanvas(img: { width: number; height: number; bitmap?: ImageBitmap; data?: Uint8ClampedArray | Uint8Array; kind?: number }): CanvasImageSource | null {
  if (img.bitmap) return img.bitmap;
  if (!img.data) return null;
  const { width: w, height: h, data, kind } = img, rgba = new Uint8ClampedArray(w * h * 4);
  if (kind === 3) rgba.set(data.subarray(0, w * h * 4));
  else if (kind === 2) for (let i = 0, j = 0; i < w * h; i++, j += 3) { rgba[i * 4] = data[j]; rgba[i * 4 + 1] = data[j + 1]; rgba[i * 4 + 2] = data[j + 2]; rgba[i * 4 + 3] = 255; }
  else return null;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d')!.putImageData(new ImageData(rgba, w, h), 0, 0); return cv;
}

export async function scanCatalog(file: File, stones: Stone[], progress: (text: string) => void): Promise<CatalogMatch[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

  // 1. טקסט של כל עמוד, ושיוך דגם לעמוד: השם הארוך קודם ("Taj Mahal Moon Light" לפני "Taj Mahal")
  const texts: { en: string; he: string[] }[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    progress(`קורא את הקטלוג… עמוד ${p} מתוך ${pdf.numPages}`);
    const items = (await (await pdf.getPage(p)).getTextContent()).items as { str?: string }[];
    const lines = items.map((i) => i.str || '').filter(Boolean);
    // עברית יכולה לצאת הפוכה (סדר חזותי): שומרים גם את הכיוון ההפוך של כל שורה
    texts.push({ en: en(lines.join(' | ')), he: lines.flatMap((l) => { const w = heWords(l); return w.length ? [` ${w.join(' ')} `, ` ${w.map(rev).reverse().join(' ')} `] : []; }) });
  }
  const byLen = [...stones].filter((s) => s.en || s.name).sort((a, b) => (b.en || b.name).length - (a.en || a.name).length);
  const pageOf = new Map<Stone, number>();
  // תוכן העניינים מזכיר את כל הדגמים: עמוד עם יותר מ-3 שמות לא נחשב לעמוד של דגם
  const hits = texts.map((t0) => {
    const t = { en: t0.en, he: [...t0.he] }, got: Stone[] = [];
    for (const s of byLen) {
      const key = s.en ? en(s.en) : '', hk = ` ${heWords(s.name).join(' ')} `;
      if (key.trim() && t.en.includes(key)) { got.push(s); t.en = t.en.split(key).join(' # '); t.he = t.he.map((l) => l.split(hk).join(' # ')); continue; }
      if (hk.trim() && t.he.some((l) => l.includes(hk))) { got.push(s); t.he = t.he.map((l) => l.split(hk).join(' # ')); }
    }
    return got;
  });
  hits.forEach((got, i) => { if (got.length <= 3) for (const s of got) if (!pageOf.has(s)) pageOf.set(s, i + 1); });

  // 2. תמונות: מהעמוד של הדגם ומהעמוד שלידו. לוח שלם הוא בערך פי 2 באורך מהרוחב, ולכן הוא מקבל עדיפות
  const out: CatalogMatch[] = []; let n = 0;
  for (const [stone, page] of pageOf) {
    progress(`מחלץ תמונות… ${++n} מתוך ${pageOf.size} (${stone.name})`);
    const found: { url: string; score: number }[] = [];
    for (const p of [page, page + 1, page - 1].filter((x) => x >= 1 && x <= pdf.numPages)) {
      const pg = await pdf.getPage(p), ops = await pg.getOperatorList();
      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] !== pdfjs.OPS.paintImageXObject) continue;
        const id = ops.argsArray[i][0] as string;
        const img = await new Promise<any>((res) => { try { (id.startsWith('g_') ? pg.commonObjs : pg.objs).get(id, res); } catch { res(null); } });
        if (!img || Math.min(img.width, img.height) < 300) continue;
        const src = imgCanvas(img); if (!src) continue;
        const r = Math.max(img.width, img.height) / Math.min(img.width, img.height);
        const url = await toJpeg(src, img.width, img.height); if (!url) continue;
        found.push({ url, score: -Math.abs(r - 2) * 5 + Math.log(img.width * img.height) / 10 - (p === page ? 0 : 1.5) });
      }
    }
    found.sort((a, b) => b.score - a.score);
    found.slice(4).forEach((f) => URL.revokeObjectURL(f.url));
    if (found.length) out.push({ stone, page, images: found.slice(0, 4).map((f) => f.url) });
  }
  return out.sort((a, b) => a.page - b.page);
}
