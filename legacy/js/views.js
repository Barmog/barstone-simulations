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
    const pad = 170, VW = maxX + pad * 2, VH = maxY + pad * 2, s = maxW / VW;
    let g = `<svg class="plan" data-s="${s}" width="${maxW}" height="${VH * s}" viewBox="${-pad} ${-pad} ${VW} ${VH}" style="background:linear-gradient(rgba(27,26,24,.05) 1px,transparent 1px) 0 0/16px 16px,linear-gradient(90deg,rgba(27,26,24,.05) 1px,transparent 1px) 0 0/16px 16px,#FBF9F6;border-radius:16px">`;
    const E0 = window.StoneEngine, cuts0 = E0 && E0.cutouts ? E0.cutouts(res).items : [];
    // מיקום תווית שם החלק: מרכז, ואם יש שם פתח — נקודה פנויה לאורך החלק
    const lblPos = (q) => { const hitc = (x, y) => cuts0.some((c) => x > c.x - 140 && x < c.x + c.pw + 140 && y > c.y - 90 && y < c.y + c.ph + 90);
      for (const t of [.5, .22, .78, .12, .88, .35, .65]) { const x = q.rot ? q.x + q.w / 2 : q.x + q.w * t, y = q.rot ? q.y + q.h * t : q.y + q.h / 2; if (!hitc(x, y)) return [x, y]; } return [q.x + q.w / 2, q.y + q.h / 2]; };
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
      if (q.b.seg > 0) g += `<line x1="${q.x}" y1="${q.y}" x2="${q.rot ? q.x + q.w : q.x}" y2="${q.rot ? q.y : q.y + q.h}" stroke="#2FB070" stroke-width="20" stroke-dasharray="44 22"/>`;
      const [lx0, ly0] = lblPos(q); g += `<text x="${lx0}" y="${ly0}" font-size="90" text-anchor="middle" dominant-baseline="middle" fill="#1B1A18" font-weight="600" style="paint-order:stroke;stroke:rgba(255,255,255,.8);stroke-width:14px">${esc(q.pc.name)}</text></g>`;
    }
    // פתחים (מהמנוע — לא חוצים חיבור): כיור יחיד/כפול, חור ברז, כיריים
    const cuts = cuts0;
    for (const c of cuts) {
      const bad = c.ok === false || /חוצה|אין מקום|גדול/.test(c.note || ''), st = bad ? '#E5484D' : '#1B1A18';
      if (c.type === 'sink') {
        for (const bs of c.basins) { const r = c.rot ? { x: c.x, y: c.y + bs.off, w: c.pw, h: bs.w } : { x: c.x + bs.off, y: c.y, w: bs.w, h: c.ph };
          g += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="40" fill="rgba(27,26,24,.2)" stroke="${st}" stroke-width="8" stroke-dasharray="30 18"/><circle cx="${r.x + r.w / 2}" cy="${r.y + r.h / 2}" r="22" fill="none" stroke="${st}" stroke-width="6"/>`; }
        g += `<text x="${c.x + c.pw / 2}" y="${c.y + c.ph + 70}" font-size="56" text-anchor="middle" fill="${st}" style="paint-order:stroke;stroke:rgba(255,255,255,.85);stroke-width:12px">${c.double ? 'כיור כפול' : 'כיור'} ${c.w / 10}×${c.d / 10}</text>`;
      } else if (c.type === 'faucet') g += `<circle cx="${c.x + c.pw / 2}" cy="${c.y + c.ph / 2}" r="${c.w / 2 + 6}" fill="#fff" stroke="${st}" stroke-width="8"/><circle cx="${c.x + c.pw / 2}" cy="${c.y + c.ph / 2}" r="6" fill="${st}"/>`;
      else if (c.type === 'cooktop') {
        g += `<rect x="${c.x}" y="${c.y}" width="${c.pw}" height="${c.ph}" rx="18" fill="rgba(20,20,22,.82)" stroke="${st}" stroke-width="8"/>`;
        const bw = c.pw, bh = c.ph; for (const [fx, fy, rr] of [[.3, .3, .16], [.7, .3, .12], [.3, .7, .12], [.7, .7, .16]]) g += `<circle cx="${c.x + bw * fx}" cy="${c.y + bh * fy}" r="${Math.min(bw, bh) * rr}" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="6"/>`;
        g += `<text x="${c.x + c.pw / 2}" y="${c.y + c.ph + 70}" font-size="56" text-anchor="middle" fill="${st}" style="paint-order:stroke;stroke:rgba(255,255,255,.85);stroke-width:12px">כיריים ${c.w / 10}×${c.d / 10}</text>`;
      }
    }
    // קווי מידה: מתחילת החלק עד מרכז הכיור/הכיריים
    const P0 = {}; for (const q of geo) if (!P0[q.pc.key]) P0[q.pc.key] = q.pc;
    let mk = `<defs><marker id="ar${uid}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#9C8360"/></marker></defs>`, mid = 'ar' + (uid++);
    g += mk.replace(`ar${uid - 1}`, mid);
    cuts.filter((c) => c.type !== 'faucet').forEach((c, i) => { const pc = P0[c.key]; if (!pc) return; const off = 55 + i * 0;
      const lab = `${(c.cx / 10).toFixed(0)} ס"מ`, ts = 'font-size="46" fill="#7A6546" text-anchor="middle" style="paint-order:stroke;stroke:#FBF9F6;stroke-width:12px"';
      if (pc.rot) { const x = pc.plan.x + pc.W + off, y1 = pc.plan.y, y2 = pc.plan.y + c.cx; g += `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#9C8360" stroke-width="5" marker-start="url(#${mid})" marker-end="url(#${mid})"/><line x1="${x - 25}" y1="${y2}" x2="${pc.plan.x + pc.W}" y2="${y2}" stroke="#9C8360" stroke-width="3" stroke-dasharray="10 8"/><text x="${x + 20}" y="${(y1 + y2) / 2}" ${ts} transform="rotate(90 ${x + 20} ${(y1 + y2) / 2})">${lab}</text>`; }
      else { const y = pc.plan.y - off, x1 = pc.plan.x, x2 = pc.plan.x + c.cx; g += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#9C8360" stroke-width="5" marker-start="url(#${mid})" marker-end="url(#${mid})"/><line x1="${x2}" y1="${y - 25}" x2="${x2}" y2="${pc.plan.y}" stroke="#9C8360" stroke-width="3" stroke-dasharray="10 8"/><text x="${(x1 + x2) / 2}" y="${y - 16}" ${ts}>${lab}</text>`; } });
    // חיבורים: סימון בולט + תווית
    for (const q of geo) if (q.b.seg > 0) { const lx = q.rot ? q.x + q.w / 2 : q.x, ly = q.rot ? q.y : q.y + q.h / 2;
      g += `<g><circle cx="${lx}" cy="${ly}" r="46" fill="#2FB070" stroke="#fff" stroke-width="10"/><text x="${lx}" y="${ly + 4}" font-size="54" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-weight="700">J</text>
      <text x="${lx}" y="${ly - 70}" font-size="50" text-anchor="middle" fill="#1F7A4D" style="paint-order:stroke;stroke:rgba(255,255,255,.9);stroke-width:12px">חיבור · ${(q.b.offsetL / 10).toFixed(0)} ס"מ</text></g>`; }
    g += `<text x="0" y="${-110}" font-size="56" fill="#8C857B">${(maxX / 10).toFixed(0)} ס"מ</text>`;
    // חיפוי קיר (לאורך הקיר האחורי של המשטח הראשי) ומפל לאי — סימון בתוכנית
    const pD = res.pieces.find((p) => p.key === 'D'), pA = res.pieces.find((p) => p.key === 'A'), pC = res.pieces.find((p) => p.key === 'C');
    if (pA && pA.plan && window.StoneEngine && res.sim) { const U = window.StoneEngine.upperOf(res.sim, pA.L); if (U.on) g += `<g class="upc" data-x="${U.x}"><rect x="${pA.plan.x + U.x}" y="${pA.plan.y}" width="${U.l}" height="${U.d}" rx="8" fill="rgba(60,80,110,.16)" stroke="#3c506e" stroke-width="6" stroke-dasharray="24 12" style="cursor:grab"/><text x="${pA.plan.x + U.x + U.l / 2}" y="${pA.plan.y + U.d / 2 + 12}" font-size="36" text-anchor="middle" fill="#2c3a50" pointer-events="none">ארון עליון · ${U.l / 10}×${U.h / 10} ס"מ · גררו ↔</text></g>`; }
    if (pD && pA && pA.plan) g += `<g class="clad" pointer-events="none"><rect x="${pA.plan.x + (pD.dx || 0)}" y="-62" width="${pD.L}" height="46" rx="10" fill="#C9B28F" stroke="#8a6d3b" stroke-width="5" stroke-dasharray="18 10"/><text x="${pA.plan.x + (pD.dx || 0) + pD.L / 2}" y="-30" font-size="34" text-anchor="middle" fill="#5b4330">חיפוי קיר · ${(pD.W / 10).toFixed(0)} ס"מ</text></g>`;
    if (pC && pC.plan && res.pieces.some((p) => p.wf)) for (const x of [pC.plan.x - 40, pC.plan.x + pC.L]) g += `<g class="wf" pointer-events="none"><rect x="${x}" y="${pC.plan.y}" width="40" height="${pC.W}" fill="#8a6d3b"/><text x="${x + 20}" y="${pC.plan.y - 24}" font-size="34" text-anchor="middle" fill="#5b4330">מפל</text></g>`;
    return g + '</svg>';
  }
  window.StoneViews = { boardSVG, planSVG, esc };
})();
