// אבן טבעית מצילום: מזהים את הלוח בתמונה (ארבע פינות), ומיישרים אותו למלבן — בלי רקע, בלי זווית צילום.
export type Quad = [number, number][]; // tl, tr, br, bl בפיקסלים של התמונה

/** זיהוי אוטומטי של הלוח: צבע הרקע לפי שולי התמונה, האזור הגדול ביותר ששונה ממנו, וארבע הפינות הקיצוניות שלו. */
export function detectQuad(src: ImageBitmap | HTMLCanvasElement): Quad {
  const W0 = src.width, H0 = src.height, k = Math.min(1, 360 / Math.max(W0, H0)), w = Math.max(8, Math.round(W0 * k)), h = Math.max(8, Math.round(H0 * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(src, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data;
  const fallback: Quad = [[W0 * 0.06, H0 * 0.06], [W0 * 0.94, H0 * 0.06], [W0 * 0.94, H0 * 0.94], [W0 * 0.06, H0 * 0.94]];
  // שתי שיטות, והטובה מביניהן: (1) גדילה מאמצע התמונה לפי צבע הלוח (2) הפרדה מצבע הרקע שבשוליים
  const col = (i: number) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
  const med = (arr: number[][]) => [0, 1, 2].map((c) => arr.map((v) => v[c]).sort((p, q) => p - q)[arr.length >> 1]);
  const grow = (seed: number, ok: (i: number) => boolean) => { const lab = new Uint8Array(w * h), st = [seed]; let n = 0; if (!ok(seed)) return { lab, n }; lab[seed] = 1;
    while (st.length) { const j = st.pop()!, x = j % w, y = (j / w) | 0; n++; for (const q of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1]) if (q >= 0 && !lab[q] && ok(q)) { lab[q] = 1; st.push(q); } }
    return { lab, n }; };
  const cands: { lab: Uint8Array; n: number }[] = [];
  { // (1) צבע הלוח מאמצע התמונה; סף לפי הפיזור שם (גידים) — מספר ניסיונות מהדוק לרחב
    const pts: number[][] = []; for (let y = Math.round(h * 0.4); y < h * 0.6; y++) for (let x = Math.round(w * 0.4); x < w * 0.6; x++) pts.push(col(y * w + x));
    const m = med(pts), dev = pts.map((v) => Math.hypot(v[0] - m[0], v[1] - m[1], v[2] - m[2])).sort((a, b) => a - b), base = Math.max(14, dev[Math.floor(dev.length * 0.8)]);
    // שחיקה לפני הגדילה (ניתוק גשרים דקים לרצפה / לקיר) והרחבה אחריה
    const morph = (src: Uint8Array, r: number, erode: boolean) => { const out = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = erode ? 1 : 0;
        for (let dy = -r; dy <= r && (erode ? v : !v); dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy, b = xx >= 0 && yy >= 0 && xx < w && yy < h ? src[yy * w + xx] : 0; if (erode && !b) { v = 0; break; } if (!erode && b) { v = 1; break; } }
        out[y * w + x] = v; } return out; };
    for (const f of [1.6, 2.2, 3]) for (const r of [0, 3]) {
      const T = base * f, raw = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) { const v = col(i); raw[i] = Math.hypot(v[0] - m[0], v[1] - m[1], v[2] - m[2]) < T ? 1 : 0; }
      const mk = r ? morph(raw, r, true) : raw, g = grow(Math.round(h / 2) * w + Math.round(w / 2), (i) => !!mk[i]);
      if (!r) { cands.push(g); continue; }
      const lab = morph(g.lab, r, false); let n = 0; for (const v of lab) n += v; cands.push({ lab, n });
    }
  }
  { // (2) שונה מצבע הרקע שבשוליים (סף Otsu)
    const bpts: number[][] = []; for (let x = 0; x < w; x++) for (const y of [0, 1, h - 2, h - 1]) bpts.push(col(y * w + x)); for (let y = 0; y < h; y++) for (const x of [0, 1, w - 2, w - 1]) bpts.push(col(y * w + x));
    const bg = med(bpts), dist = new Float32Array(w * h); for (let i = 0; i < w * h; i++) { const v = col(i); dist[i] = Math.hypot(v[0] - bg[0], v[1] - bg[1], v[2] - bg[2]); }
    const hist = new Array(256).fill(0); for (const v of dist) hist[Math.min(255, v | 0)]++;
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let wB = 0, sB = 0, best = 0, th = 40;
    for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = w * h - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = t; } }
    th = Math.max(22, th); cands.push(grow(Math.round(h / 2) * w + Math.round(w / 2), (i) => dist[i] >= th));
  }
  // לוח סביר: בין 15% ל-92% מהתמונה, ולא נוגע ביותר משתי צלעות של התמונה; מעדיפים את המלבני ביותר
  const quadOf = (lab: Uint8Array) => { let tl = [0, 0, Infinity], tr = [0, 0, -Infinity], br = [0, 0, -Infinity], bl = [0, 0, Infinity];
    for (let i = 0; i < w * h; i++) { if (!lab[i]) continue; const x = i % w, y = (i / w) | 0;
      if (x + y < tl[2]) tl = [x, y, x + y]; if (x + y > br[2]) br = [x, y, x + y]; if (x - y > tr[2]) tr = [x, y, x - y]; if (x - y < bl[2]) bl = [x, y, x - y]; }
    return [tl, tr, br, bl].map(([x, y]) => [x, y]); };
  const area = (q: number[][]) => Math.abs(q.reduce((a, p, i) => { const r = q[(i + 1) % 4]; return a + p[0] * r[1] - r[0] * p[1]; }, 0)) / 2;
  let pick: number[][] | null = null, pickScore = 0;
  for (const c of cands) {
    if (c.n < w * h * 0.15 || c.n > w * h * 0.92) continue;
    const q = quadOf(c.lab), fill = c.n / Math.max(1, area(q)), edges = [q.some((p) => p[0] <= 1), q.some((p) => p[0] >= w - 2), q.some((p) => p[1] <= 1), q.some((p) => p[1] >= h - 2)].filter(Boolean).length;
    if (edges > 2 || fill < 0.75) continue;
    const score = fill * Math.sqrt(c.n / (w * h)); if (score > pickScore) { pickScore = score; pick = q; }
  }
  if (!pick) return fallback;
  const [tl, tr, br, bl] = pick;
  return [tl, tr, br, bl].map(([x, y]) => [(x + 0.5) / k, (y + 0.5) / k]) as Quad;
}

/** מיפוי ריבוע יחידה → מרובע (Heckbert). s לאורך tl→tr, t לאורך tl→bl. */
function squareToQuad(q: Quad) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g = 0, h = 0;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) { a = x1 - x0; b = x3 - x0; c = x0; d = y1 - y0; e = y3 - y0; f = y0; }
  else { const den = dx1 * dy2 - dx2 * dy1; g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den; a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0; d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0; }
  return (s: number, t: number): [number, number] => { const z = g * s + h * t + 1; return [(a * s + b * t + c) / z, (d * s + e * t + f) / z]; };
}

/** הלוח תמיד לרוחב: אם הצלע השמאלית ארוכה מהעליונה, מסובבים את סדר הפינות. */
export function landscape(q: Quad): Quad {
  const L = (p: [number, number], r: [number, number]) => Math.hypot(p[0] - r[0], p[1] - r[1]);
  return L(q[0], q[1]) + L(q[3], q[2]) >= L(q[0], q[3]) + L(q[1], q[2]) ? q : [q[3], q[0], q[1], q[2]];
}

/** יישור: מהמרובע שבתמונה למלבן W×H, בדגימה בי־לינארית. */
export function warp(src: ImageBitmap | HTMLCanvasElement, quad: Quad, W: number, H: number): HTMLCanvasElement {
  // מקור מוקטן (עד 3000 פיקסלים) כדי לא לשמור בזיכרון צילום של 50 מגה־פיקסל
  const k = Math.min(1, 3000 / Math.max(src.width, src.height)), sw = Math.round(src.width * k), sh = Math.round(src.height * k);
  const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh; const sg = sc.getContext('2d', { willReadFrequently: true })!; sg.drawImage(src, 0, 0, sw, sh);
  const sd = sg.getImageData(0, 0, sw, sh).data, map = squareToQuad(quad.map(([x, y]) => [x * k, y * k]) as Quad);
  const out = document.createElement('canvas'); out.width = W; out.height = H; const og = out.getContext('2d')!, od = og.createImageData(W, H), o = od.data;
  for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
    const [x, y] = map((u + 0.5) / W, (v + 0.5) / H), xi = Math.max(0, Math.min(sw - 2, Math.floor(x - 0.5))), yi = Math.max(0, Math.min(sh - 2, Math.floor(y - 0.5)));
    const fx = Math.max(0, Math.min(1, x - 0.5 - xi)), fy = Math.max(0, Math.min(1, y - 0.5 - yi)), i00 = (yi * sw + xi) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4, j = (v * W + u) * 4;
    for (let c = 0; c < 3; c++) o[j + c] = (sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx) * (1 - fy) + (sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx) * fy;
    o[j + 3] = 255;
  }
  og.putImageData(od, 0, 0); return out;
}
