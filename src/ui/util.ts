import { useMemo, useSyncExternalStore } from 'react';
import { useStore } from '../store';

/** נתיב לקובץ סטטי, יחסי לבסיס האתר. */
export const asset = (name: string) => import.meta.env.BASE_URL + name;

/** תצוגה בס"מ (המודל במ"מ). */
export const cm = (mm: number) => String(Math.round(mm) / 10);
export const parseCm = (s: string) => { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? Math.round(v * 10) : null; };
export const m2 = (mm2: number) => (mm2 / 1e6).toFixed(2);

export function useStone() {
  const stones = useStore((s) => s.stones), id = useStore((s) => s.project?.stoneId), custom = useStore((s) => s.project?.customStone);
  return useMemo(() => {
    // אבן טבעית שצולמה להזמנה
    if (id === 'custom' && custom?.url) return { id: 'custom', name: custom.name || 'אבן טבעית', en: 'Natural stone', url: custom.url, thumb: custom.url, slab: true, stock: 'yes' as const, hasImage: true };
    return stones.find((s) => String(s.id) === String(id)) || stones[0] || { id: 'x', name: '', url: asset('stone.jpg'), slab: true, stock: 'unknown' as const, hasImage: true };
  }, [stones, id, custom?.url, custom?.name]);
}

/** מקטין תמונה (צילום מהטלפון) ל-JPEG ברוחב מרבי — לפני העלאה או שליחה לזיהוי. מחזיר null אם הדפדפן לא מצליח לפענח. */
export async function shrinkImage(file: Blob, max = 2400, quality = 0.86, rotate = false): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k), cv = document.createElement('canvas'); cv.width = rotate ? h : w; cv.height = rotate ? w : h;
    const g = cv.getContext('2d')!; if (rotate) { g.translate(h, 0); g.rotate(Math.PI / 2); }
    g.drawImage(bmp, 0, 0, w, h); bmp.close?.();
    return await new Promise((res) => cv.toBlob((b) => res(b), 'image/jpeg', quality));
  } catch { return null; }
}

/** מסך צר (טלפון): הסטודיו עובר לפריסת מובייל. */
const mq = typeof matchMedia === 'function' ? matchMedia('(max-width: 820px)') : null;
export const useMobile = () => useSyncExternalStore((f) => { mq?.addEventListener('change', f); return () => mq?.removeEventListener('change', f); }, () => !!mq?.matches);
