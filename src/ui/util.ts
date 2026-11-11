import { useMemo } from 'react';
import { useStore } from '../store';

/** נתיב לקובץ סטטי, יחסי לבסיס האתר. */
export const asset = (name: string) => import.meta.env.BASE_URL + name;

/** תצוגה בס"מ (המודל במ"מ). */
export const cm = (mm: number) => String(Math.round(mm) / 10);
export const parseCm = (s: string) => { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? Math.round(v * 10) : null; };
export const m2 = (mm2: number) => (mm2 / 1e6).toFixed(2);

export function useStone() {
  const stones = useStore((s) => s.stones), id = useStore((s) => s.project?.stoneId);
  return useMemo(() => stones.find((s) => String(s.id) === String(id)) || stones[0] || { id: 'x', name: '', url: asset('stone.jpg'), slab: true, stock: 'unknown' as const, hasImage: true }, [stones, id]);
}
