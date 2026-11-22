// אישור אחרי מדידה: טביעת אצבע של כל מה שמשפיע על הייצור. שינוי של אחד מהם אחרי האישור מבטל אותו.
import type { Project } from './model';

export function approvalHash(p: Project): string {
  const s = JSON.stringify([p.stoneId, p.customStone?.url || '', p.finish || '', p.thickness, p.apronH, p.kerf, p.margin, p.slabW, p.slabH, p.bookmatch || '',
    p.pieces.map((q) => [q.id, q.kind, q.x, q.y, q.w, q.h, q.wall || '', q.host || '', q.side || '', q.off || 0, [...q.aprons].sort(), q.grainLock, q.joint || '', q.corner || '', q.jointAt || [], q.chamfers || [], q.outline || []]),
    p.cutouts.map((c) => [c.id, c.pieceId, c.kind, c.x, c.y, c.w, c.h, !!c.round, !!c.built, c.mount || '', c.cabinet || 0, c.bowls || '', !!c.drainCover]),
    Object.entries(p.manual || {}).sort(([a], [b]) => a.localeCompare(b))]);
  // FNV-1a כפול (64 סיביות בסך הכול) — מספיק כדי לזהות שינוי
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193); h2 = Math.imul(h2 ^ c, 0x85ebca6b) + i; }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}
