// שרטוטים למסמך: לוח עם תמונת האבן האמיתית ופריסת החלקים (כתמונה, כדי שייכנס גם ל-PDF), ושרטוט פרופיל קנט.
import { Project, letter } from '../core/model';
import { NestResult } from '../core/nesting';

const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
const loadImg = (url: string) => { if (!imgCache.has(url)) imgCache.set(url, new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = url; })); return imgCache.get(url)!; };

export const COLORS = { cut: '#1b1a18', miter: '#c0399a', edge: '#1f9d55', joint: '#e8761c', extra: '#3f6fd1' };

export async function slabImages(project: Project, nest: NestResult, stoneUrl: string, width = 1500): Promise<string[]> {
  const img = await loadImg(stoneUrl), idx = new Map(project.pieces.map((p, i) => [p.id, i]));
  return nest.slabs.map((s, i) => {
    const k = width / s.w, cv = document.createElement('canvas'); cv.width = width; cv.height = Math.round(s.h * k);
    const g = cv.getContext('2d')!; g.fillStyle = '#ddd8cf'; g.fillRect(0, 0, cv.width, cv.height);
    if (img) { g.save(); if (project.bookmatch === 'yes' && i % 2) { g.translate(cv.width, 0); g.scale(-1, 1); } try { g.drawImage(img, 0, 0, cv.width, cv.height); } catch { /* בלי תמונה */ } g.restore(); }
    // מה שלא נחתך — מעומעם
    g.save(); g.beginPath(); g.rect(0, 0, cv.width, cv.height);
    for (const p of s.placements) { g.rect(p.body.x * k, p.body.y * k, p.body.w * k, p.body.h * k); for (const st of p.strips) g.rect(st.rect.x * k, st.rect.y * k, st.rect.w * k, st.rect.h * k); }
    g.fillStyle = 'rgba(246,243,238,.62)'; g.fill('evenodd'); g.restore();
    g.lineJoin = 'round';
    for (const p of s.placements) {
      g.lineWidth = 3; g.strokeStyle = p.extra ? COLORS.extra : p.attached ? COLORS.edge : COLORS.cut; g.setLineDash(p.attached ? [10, 6] : []);
      g.strokeRect(p.body.x * k, p.body.y * k, p.body.w * k, p.body.h * k); g.setLineDash([]);
      for (const st of p.strips) { g.strokeStyle = COLORS.miter; g.lineWidth = 2; g.strokeRect(st.rect.x * k, st.rect.y * k, st.rect.w * k, st.rect.h * k); }
      if (Math.min(p.body.w, p.body.h) * k < 26) continue;
      const cx = (p.body.x + p.body.w / 2) * k, cy = (p.body.y + p.body.h / 2) * k, name = p.extra ? (p.extra === 'צוקל' ? 'צוקל' : 'כיור') : `${letter(idx.get(p.pieceId) ?? 0)}${p.segs > 1 ? p.seg + 1 : ''}`;
      const fs = Math.max(13, Math.min(30, Math.min(p.body.w, p.body.h) * k * 0.2));
      g.font = `600 ${fs}px Heebo, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; const tw = g.measureText(name).width + fs;
      g.fillStyle = 'rgba(27,26,24,.88)'; g.beginPath(); g.roundRect(cx - tw / 2, cy - fs * 0.85, tw, fs * 1.7, fs * 0.5); g.fill(); g.fillStyle = '#fff'; g.fillText(name, cx, cy + 1);
      if (Math.min(p.body.w, p.body.h) * k > 60) { g.font = `500 ${fs * 0.62}px "JetBrains Mono", monospace`; g.fillStyle = '#1b1a18'; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; const t = `${Math.round(p.body.w)}×${Math.round(p.body.h)}`; g.strokeText(t, cx, cy + fs * 1.45); g.fillText(t, cx, cy + fs * 1.45); }
    }
    return cv.toDataURL('image/jpeg', 0.88);
  });
}

/** פרופיל קנט: ישר (עובי בלבד) או קנט גרונג (בעובי האבן, בגובה הקנט). */
export function edgeProfileSvg(t: number, apronH: number): string {
  if (!apronH) return `<svg viewBox="0 0 120 50" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="18" width="90" height="${Math.max(6, t * 0.6)}" rx="2" fill="#efe9df" stroke="#1b1a18" stroke-width="1.2"/><text x="108" y="${22 + t * 0.3}" font-size="9" font-family="Arial" fill="#5a544b">${t}</text></svg>`;
  const h = Math.max(14, apronH * 0.45), tt = Math.max(5, t * 0.45);
  return `<svg viewBox="0 0 120 70" xmlns="http://www.w3.org/2000/svg"><path d="M10 12 H96 V${12 + h} H${96 - tt} V${12 + tt} H10 Z" fill="#efe9df" stroke="#1b1a18" stroke-width="1.2"/><line x1="${96 - tt}" y1="${12 + tt}" x2="96" y2="12" stroke="${COLORS.miter}" stroke-width="1.4"/><text x="104" y="${16 + h / 2}" font-size="9" font-family="Arial" fill="#5a544b">${apronH}</text><text x="40" y="9" font-size="9" font-family="Arial" fill="#5a544b">${t}</text></svg>`;
}

/** פרט קנט גדול עם מידות: חתך המשטח, והקנט היורד בגרונג 45° (או קנט ישר). */
export function edgeDetailSvg(t: number, apronH: number, title: string): string {
  const s = apronH ? Math.min(3, 120 / apronH) : 3, T = t * s, A = apronH * s, x0 = 20, x1 = 190, y0 = 40, W = 260, H = apronH ? y0 + A + 50 : y0 + T + 60;
  const dim = (x1: number, y1: number, x2: number, y2: number, label: string, tx: number, ty: number) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#5a544b" stroke-width=".8"/><text x="${tx}" y="${ty}" font-size="10" font-family="Arial" fill="#1b1a18" text-anchor="middle">${label}</text>`;
  const body = apronH
    ? `<path d="M${x0} ${y0} H${x1} V${y0 + A} H${x1 - T} V${y0 + T} H${x0}" fill="#efe9df" stroke="#1b1a18" stroke-width="1.4"/><path d="M${x0} ${y0} V${y0 + T}" stroke="#1b1a18" stroke-width="1" stroke-dasharray="3 3"/>
       <line x1="${x1 - T}" y1="${y0 + T}" x2="${x1}" y2="${y0}" stroke="${COLORS.miter}" stroke-width="2"/>
       ${dim(x1 + 14, y0, x1 + 14, y0 + A, '', 0, 0)}<text x="${x1 + 20}" y="${y0 + A / 2 + 4}" font-size="11" font-family="Arial" fill="#1b1a18">${apronH}</text>
       ${dim(x1 - T, y0 + A + 14, x1, y0 + A + 14, '', 0, 0)}<text x="${x1 - T / 2}" y="${y0 + A + 28}" font-size="11" font-family="Arial" fill="#1b1a18" text-anchor="middle">${t}</text>
       <text x="${x1 - T - 10}" y="${y0 + T + 22}" font-size="10" font-family="Arial" fill="${COLORS.miter}" text-anchor="end">גרונג 45°</text>`
    : `<path d="M${x0} ${y0} H${x1} V${y0 + T} H${x0}" fill="#efe9df" stroke="#1b1a18" stroke-width="1.4"/><path d="M${x0} ${y0} V${y0 + T}" stroke="#1b1a18" stroke-width="1" stroke-dasharray="3 3"/>
       ${dim(x1 + 14, y0, x1 + 14, y0 + T, '', 0, 0)}<text x="${x1 + 20}" y="${y0 + T / 2 + 4}" font-size="11" font-family="Arial" fill="#1b1a18">${t}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><text x="${W / 2}" y="18" font-size="13" font-weight="600" font-family="Heebo, Arial" fill="#1b1a18" text-anchor="middle">${title}</text>${body}</svg>`;
}
