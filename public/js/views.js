// ציור SVG: לוחות (למעלה) ותוכנית (למטה). הטקסטורה בתוכנית נלקחת מאותו מיקום בלוח.
(function () {
  const esc = (s) => String(s).replace(/[<&"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' }[c]));
  let uid = 0;
  // מיפוי מערכת החלק (u לאורך, v לרוחב) ללוח, ולהפך — תומך בחלק מסובב 90° על הלוח
  const fwd = (p) => p.rot ? `translate(${p.x + p.block.H},${p.y}) rotate(90)` : `translate(${p.x},${p.y})`;
  const inv = (p) => p.rot ? `rotate(-90) translate(${-(p.x + p.block.H)},${-p.y})` : `translate(${-p.x},${-p.y})`;
  function boardSVG(u, res, tex, maxW) {
    const o = res.opts, W = u.board.w || o.boardW, H = u.board.h || o.boardH, s = maxW / W, id = 'b' + (uid++);
    let g = `<svg width="${W * s}" height="${H * s}" viewBox="0 0 ${W} ${H}" style="border-radius:8px;box-shadow:0 12px 30px -12px rgba(60,48,30,.45)" data-board="${esc(u.board.id)}">`;
    g += `<image href="${u.board.tex || tex}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/><rect width="${W}" height="${H}" fill="rgba(255,255,255,.35)"/>`;
    for (const d of u.board.defects || []) g += `<rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" fill="rgba(229,72,77,.35)" stroke="#E5484D" stroke-width="8" stroke-dasharray="20 12"/>`;
    for (const p of u.place) {
      const b = p.block, pc = b.piece;
      g += `<g><clipPath id="${id}${p.x}_${p.y}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/></clipPath>`;
      g += `<image href="${u.board.tex || tex}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}${p.x}_${p.y})"/>`;
      g += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="none" stroke="${pc.sink ? '#B49B74' : '#2FB070'}" stroke-width="${o.kerf * 2}"/>`;
      g += `<g transform="${fwd(p)}">`;
      for (let i = 0; i < b.strips; i++) { const y = b.W + o.kerf + i * (o.kerf + o.edgeH); g += `<rect x="0" y="${y}" width="${b.L}" height="${o.edgeH}" fill="rgba(224,66,143,.25)" stroke="#E0428F" stroke-width="6"/>`; }
      const fs = Math.max(50, Math.min(110, Math.min(b.L, b.W) / 4));
      g += `<text x="${b.L / 2}" y="${b.W / 2}" font-size="${fs}" text-anchor="middle" dominant-baseline="middle" fill="#1B1A18" font-weight="600">${esc(pc.key)}${b.segs > 1 ? '·' + (b.seg + 1) : ''}${p.rot ? ' ↻' : ''}</text>`;
      g += `<text x="${b.L / 2}" y="${b.W / 2 + fs}" font-size="${fs * .6}" text-anchor="middle" fill="#1B1A18">${b.L}×${b.W}</text></g></g>`;
    }
    return g + '</svg>';
  }
  function planSVG(res, tex, maxW) {
    const items = [];
    for (const u of res.used) for (const p of u.place) if (p.block.piece.plan) items.push({ u, p });
    if (!items.length) return '<p style="color:#8C857B">אין חלקים להצגה בתוכנית</p>';
    let maxX = 0, maxY = 0;
    const geo = items.map(({ u, p }) => {
      const b = p.block, pc = b.piece, rot = !!pc.rot;
      const x = pc.plan.x + (rot ? 0 : b.offsetL), y = pc.plan.y + (rot ? b.offsetL : 0);
      const w = rot ? b.W : b.L, h = rot ? b.L : b.W;
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h); return { u, p, b, pc, rot, x, y, w, h };
    });
    const pad = 120, VW = maxX + pad * 2, VH = maxY + pad * 2, s = maxW / VW;
    let g = `<svg class="plan" data-s="${s}" width="${maxW}" height="${VH * s}" viewBox="${-pad} ${-pad} ${VW} ${VH}" style="background:linear-gradient(rgba(27,26,24,.05) 1px,transparent 1px) 0 0/16px 16px,linear-gradient(90deg,rgba(27,26,24,.05) 1px,transparent 1px) 0 0/16px 16px,#FBF9F6;border-radius:16px">`;
    for (const q of geo) {
      const W = q.u.board.w || res.opts.boardW, H = q.u.board.h || res.opts.boardH, cid = 'pc' + (uid++);
      // מיפוי: נקודת הלוח (p.x,p.y) → נקודת התוכנית (x,y)
      const tf = q.rot ? `translate(${q.x + q.b.W},${q.y}) rotate(90) ${inv(q.p)}` : `translate(${q.x},${q.y}) ${inv(q.p)}`;
      g += `<g class="pp" data-key="${q.pc.key}" style="cursor:grab">`;
      g += `<clipPath id="${cid}"><rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}"/></clipPath>`;
      g += `<g clip-path="url(#${cid})"><g transform="${tf}"><image href="${q.u.board.tex || tex}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/></g></g>`;
      g += `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="none" stroke="rgba(27,26,24,.5)" stroke-width="6"/>`;
      if (q.b.strips) { // קנט קדמי רציף
        const fr = q.rot ? `x1="${q.x + q.w}" y1="${q.y}" x2="${q.x + q.w}" y2="${q.y + q.h}"` : `x1="${q.x}" y1="${q.y + q.h}" x2="${q.x + q.w}" y2="${q.y + q.h}"`;
        g += `<line ${fr} stroke="#E0428F" stroke-width="22" stroke-linecap="round"/>`;
        if (q.b.strips > 1) g += `<line x1="${q.x}" y1="${q.y}" x2="${q.x + q.w}" y2="${q.y}" stroke="#E0428F" stroke-width="22"/>`;
      }
      if (q.b.seg > 0) g += `<line x1="${q.x}" y1="${q.y}" x2="${q.rot ? q.x + q.w : q.x}" y2="${q.rot ? q.y : q.y + q.h}" stroke="#2FB070" stroke-width="14" stroke-dasharray="40 20"/>`;
      g += `<text x="${q.x + q.w / 2}" y="${q.y + q.h / 2}" font-size="90" text-anchor="middle" dominant-baseline="middle" fill="#1B1A18" font-weight="600" style="paint-order:stroke;stroke:rgba(255,255,255,.8);stroke-width:14px">${esc(q.pc.name)}</text></g>`;
    }
    // פתח כיור על המשטח הראשי
    const main = geo.find((q) => q.pc.key === 'A' && q.b.seg === 0), sim = res.sim || {};
    if (main && sim.sink) { const sw = (sim.sink_w_cm || 60) * 10, sd = (sim.sink_d_cm || 40) * 10; g += `<rect x="${main.x + main.w / 2 - sw / 2}" y="${main.y + (main.h - sd) / 2}" width="${sw}" height="${sd}" rx="40" fill="rgba(255,255,255,.35)" stroke="#1B1A18" stroke-width="8" stroke-dasharray="30 18"/>`; }
    g += `<text x="0" y="${-40}" font-size="70" fill="#8C857B">${(maxX / 10).toFixed(0)} ס"מ</text>`;
    return g + '</svg>';
  }
  window.StoneViews = { boardSVG, planSVG, esc };
})();
