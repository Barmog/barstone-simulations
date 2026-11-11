// סט אייקונים בקו דק אחיד (1.6px).
const I = (d: string) => () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
);
export const Icon = {
  undo: I('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  redo: I('<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  back: I('<path d="m9 6 6 6-6 6"/>'),
  doc: I('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>'),
  download: I('<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>'),
  camera: I('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  spark: I('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>'),
  file: I('<path d="M6 3h8l4 4v14H6z"/><path d="M9 13l2 2 4-5"/>'),
  grid: I('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  max: I('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  fit: I('<rect x="5" y="7" width="14" height="10" rx="1.5"/><path d="M2 12h3M19 12h3M12 4v3M12 17v3"/>'),
  cube: I('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>'),
  top: I('<rect x="4" y="6" width="16" height="12" rx="1.5"/><path d="M4 11h16"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'),
  search: I('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>'),
  check: I('<path d="m5 12 5 5 9-10"/>'),
  team: I('<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.5.6 4 2.6 4 6"/>'),
  out: I('<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>'),
  lock: I('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
};
