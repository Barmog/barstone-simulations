// אחסון משותף: localStorage + Supabase (מפתח anon ציבורי בלבד)
(function () {
  const base = /\/(mobile|document)\//.test(location.pathname) ? '../' : '';
  const C = window.APP_CONFIG || {};
  const sb = C.SUPABASE_URL && window.supabase ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;
  const FALLBACK = [{ id: 'l1', name: 'שיש לבן קררה', color: '#e9e7e2' }, { id: 'l2', name: 'שחור מרקיניה', color: '#222' }, { id: 'l3', name: 'טאג׳ מהאל', color: '#d8ccb4' }];
  const J = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const S = {
    base, sb,
    getSim: () => J('currentSim', null),
    setSim: (s) => localStorage.setItem('currentSim', JSON.stringify(s)),
    getBoards: () => J('boards', []),
    setBoards: (b) => localStorage.setItem('boards', JSON.stringify(b)),
    async stones() {
      if (sb) { const { data, error } = await sb.from('stones').select('*').order('id'); if (!error && data && data.length) return data; }
      return FALLBACK;
    },
    texture(stone) {
      if (sb && stone && stone.slab_path) return sb.storage.from('slabs').getPublicUrl(stone.slab_path).data.publicUrl;
      if (sb && stone && stone.tile_path) return sb.storage.from('tiles').getPublicUrl(stone.tile_path).data.publicUrl;
      return base + 'stone.jpg';
    },
    // שמירה: anon רשאי insert בלבד → כל שמירה היא גרסה חדשה; המזהה האחרון נשמר מקומית
    async saveRemote(sim, result) {
      if (!sb) return { local: true };
      const row = { client_name: sim.client_name || 'ללא שם', length_cm: +sim.length_cm || 0, depth_cm: +sim.depth_cm || 0, thickness_cm: +sim.thickness_cm || 2,
        stone_id: /^\d+$/.test(String(sim.stone_id)) ? +sim.stone_id : null, status: 'layout',
        layout: { sim, boards: S.getBoards().map(({ tex, ...b }) => b), metrics: result.metrics, warnings: result.warnings,
          placements: result.used.map((u) => ({ board: u.board.id, w: u.board.w, h: u.board.h, pieces: u.place.map((p) => ({ key: p.block.piece.key, name: p.block.piece.name, seg: p.block.seg, x: p.x, y: p.y, w: p.w, h: p.h, strips: p.block.strips })) })) } };
      const { data, error } = await sb.from('simulations').insert(row).select('id').single();
      if (error) throw error;
      localStorage.setItem('lastSimId', data.id); return data;
    },
    async loadRemote(id) {
      if (!sb || !id) return null;
      const { data } = await sb.from('simulations').select('*').eq('id', id).maybeSingle(); return data;
    },
  };
  window.SimStore = S;
})();
