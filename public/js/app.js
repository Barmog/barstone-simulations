// מעטפת אפליקציית ההדמיות. עובדת גם ללא Supabase (מצב מקומי ב-localStorage).
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG || {};
const sb = SUPABASE_URL && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (s) => document.querySelector(s);
$('#status').textContent = sb ? 'מחובר ל-Supabase' : 'מצב מקומי (Supabase לא מוגדר)';
const DEFAULT_STONES = [{ id: 'local-1', name: 'שיש לבן קררה', tile_path: null, color: '#e9e7e2' },{ id: 'local-2', name: 'שחור מרקיניה', tile_path: null, color: '#222' },{ id: 'local-3', name: 'טאג׳ מהאל', tile_path: null, color: '#d8ccb4' }];
let stones = DEFAULT_STONES;
async function loadStones() {
  if (sb) { const { data, error } = await sb.from('stones').select('*').order('name'); if (!error && data.length) stones = data; }
  $('#stones').innerHTML = stones.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
}
function tileUrl(s) { return sb && s.tile_path ? sb.storage.from('tiles').getPublicUrl(s.tile_path).data.publicUrl : null; }
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
  if (sb) { const { error } = await sb.from('simulations').insert({ ...d, stone_id: isNaN(+d.stone_id) ? null : +d.stone_id }); if (error) return alert('שגיאה: ' + error.message); }
  else { const a = JSON.parse(localStorage.getItem('sims') || '[]'); a.unshift(d); localStorage.setItem('sims', JSON.stringify(a)); }
  draw(d); listSims();
});
await loadStones(); listSims();
