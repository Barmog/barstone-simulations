// מעטפת אפליקציית ההדמיות. עובדת גם ללא Supabase (מצב מקומי ב-localStorage).
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG || {};
const sb = SUPABASE_URL && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (s) => document.querySelector(s);
$('#status').textContent = sb ? 'מחובר ל-Supabase' : 'מצב מקומי (Supabase לא מוגדר)';
const DEFAULT_STONES = [{ id: 'local-1', name: 'שיש לבן קררה', tile_path: null, color: '#e9e7e2' },{ id: 'local-2', name: 'שחור מרקיניה', tile_path: null, color: '#222' },{ id: 'local-3', name: 'טאג׳ מהאל', tile_path: null, color: '#d8ccb4' }];
let stones = DEFAULT_STONES;
async function loadStones() {
  if (sb) { const { data, error } = await sb.from('stones').select('*').order('name'); if (!error && data.length) stones = data.sort((a, b) => (b.supplier === 'Barstone') - (a.supplier === 'Barstone')); }
  $('#stones').innerHTML = stones.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
}
function tileUrl(s) { if (sb && s.slab_path) return sb.storage.from('slabs').getPublicUrl(s.slab_path).data.publicUrl; return sb && s.tile_path ? sb.storage.from('tiles').getPublicUrl(s.tile_path).data.publicUrl : null; }
function draw(d) {
  const c = $('#preview').getContext('2d'); c.clearRect(0, 0, 800, 300);
  const s = stones.find((x) => String(x.id) === String(d.stone_id)) || stones[0];
  const scale = Math.min(760 / (d.length_cm || 1), 260 / (d.depth_cm || 1));
  const w = d.length_cm * scale, h = d.depth_cm * scale;
  const url = tileUrl(s);
  if (url) { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { c.fillStyle = c.createPattern(img, 'repeat'); c.fillRect(20, 20, w, h); }; img.src = url; }
  else { c.fillStyle = s.color || '#ccc'; c.fillRect(20, 20, w, h); }
  c.strokeRect(20, 20, w, h); c.fillStyle = '#c00'; c.fillText(`${d.length_cm}×${d.depth_cm} ס"מ`, 30, 40);
}
async function listSims() {
  let rows = JSON.parse(localStorage.getItem('sims') || '[]');
  if (sb) { const { data } = await sb.from('simulations').select('*').order('created_at', { ascending: false }).limit(20); rows = data || []; }
  $('#list').innerHTML = rows.map((r) => `<li>${r.client_name} — ${r.length_cm}×${r.depth_cm}</li>`).join('') || '<li>אין עדיין</li>';
}
$('#dims').addEventListener('input', (e) => draw(Object.fromEntries(new FormData(e.currentTarget))));
$('#dims').addEventListener('submit', async (e) => {
  e.preventDefault(); const d = Object.fromEntries(new FormData(e.currentTarget));
  ['length_cm', 'depth_cm', 'thickness_cm'].forEach((k) => (d[k] = Number(d[k])));
  // לא שומרים בענן כאן — שורה אחת נוצרת רק ב"שמירה" בדף הפריסה (בלי שורות טיוטה כפולות)
  if (!sb) { const a = JSON.parse(localStorage.getItem('sims') || '[]'); a.unshift(d); localStorage.setItem('sims', JSON.stringify(a)); }
  draw(d); listSims();
});
await loadStones(); listSims();
// מילוי הטופס מההדמיה הנוכחית (חזרה לדף שומרת מיקום כיור וכו')
{ const cur = JSON.parse(localStorage.getItem('currentSim') || 'null'); if (cur) { for (const el of $('#dims').querySelectorAll('[name]')) if (cur[el.name] !== undefined && cur[el.name] !== null) el.type === 'checkbox' ? (el.checked = !!cur[el.name]) : (el.value = cur[el.name]); if (cur.length_cm) draw(Object.fromEntries(new FormData($('#dims')))); } }
// מעבר לשלב הבא במסלול
$('#dims').addEventListener('submit', () => {
  // מיזוג עם ההדמיה הקיימת — לא מוחקים שדות של פריסה/רינדור (L, אי, מיקומי תוכנית…)
  const f = $('#dims'), prev = JSON.parse(localStorage.getItem('currentSim') || '{}'), d = { ...prev };
  for (const el of f.querySelectorAll('[name]')) d[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value;
  localStorage.setItem('currentSim', JSON.stringify(d));
  setTimeout(() => (location.href = 'layout.html'), 300);
});
