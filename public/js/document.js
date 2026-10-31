// מסמך ללקוח מתוך ההדמיה של המשתמש (Supabase לפי ?id=, אחרת localStorage)
(async function () {
  const S = window.SimStore, E = window.StoneEngine, V = window.StoneViews, el = document.getElementById('doc');
  const qid = new URLSearchParams(location.search).get('id') || null;
  let sim = S.getSim(), boards = S.getBoards(), saved = null;
  if (qid) { saved = await S.loadRemote(qid); if (saved && saved.layout) { sim = saved.layout.sim; boards = saved.layout.boards || []; } }
  if (!sim || !sim.length_cm) { el.innerHTML = '<section class="pg"><h2>אין עדיין הדמיה</h2><p class="p">יש להזין מידות ולבצע פריסת שיש. <a href="../dimensions.html">להתחלה</a> · <a href="document-sample.html">מסמך לדוגמה</a></p></section>'; return; }
  const stones = await S.stones(), stone = stones.find((s) => String(s.id) === String(sim.stone_id)) || stones[0], tex = S.texture(stone);
  const res = E.run(sim, boards, { edgeH: sim.edge_mm || 40, kerf: sim.kerf_mm || 4 }); res.sim = sim;
  const sk = E.sinkPlan ? E.sinkPlan(res, sim) : null, where = {};
  res.used.forEach((u) => u.place.forEach((p) => { (where[p.block.piece.key] = where[p.block.piece.key] || []).push(`${u.board.id}${p.block.segs > 1 ? ' (חלק ' + (p.block.seg + 1) + ')' : ''}${p.rot ? ' ↻' : ''}`); }));
  const bu = (u) => Math.round(100 * u.place.reduce((a, p) => a + p.block.L * p.block.W, 0) / ((u.board.w || res.opts.boardW) * (u.board.h || res.opts.boardH)));
  const m = res.metrics, d = new Date().toLocaleDateString('he-IL'), w = Math.min(380, innerWidth - 50);
  el.innerHTML = `
  <section class="cover"><div class="eb">BARSTONE · הדמיה</div><h1>${V.esc(sim.client_name || 'הדמיית מטבח')}</h1>
   <p class="lead">${V.esc(stone.name)} · עובי ${sim.thickness_cm || 2} ס"מ · קנט רציף ${sim.edge !== false ? 'מהלוח' : 'ללא'}</p>
   <div class="cv-img" style="background-image:url('${tex}')"><span>${V.esc(stone.name)}</span></div>
   <div class="meta"><div><small>תאריך</small><b>${d}</b></div><div><small>לוחות</small><b>${m.boards}</b></div><div><small>צריכת אבן</small><b>${m.consumed_m2} מ"ר</b></div><div><small>מספר הדמיה</small><b class="ltr">${saved ? saved.id.slice(0, 8) : 'טיוטה'}</b></div></div></section>
  <section class="pg"><div class="ph"><span>תוכנית המטבח</span><span>${d}</span></div><h2>התוכנית</h2>
   <p class="p">אורך ${sim.length_cm} ס"מ, עומק ${sim.depth_cm} ס"מ${sim.l_length_cm ? `, משטח L ${sim.l_length_cm} ס"מ` : ''}${sim.island_l_cm ? `, אי ${sim.island_l_cm}×${sim.island_w_cm} ס"מ` : ''}${sim.sink ? `, כיור בנוי מאבן ${sim.sink_w_cm}×${sim.sink_d_cm}×${sim.sink_h_cm} ס"מ` : ''}.</p>
   <div class="fig">${V.planSVG(res, tex, w)}</div></section>
  <section class="pg"><div class="ph"><span>פריסה על הלוחות</span><span>ניצולת ${m.utilization}%</span></div><h2>הלוחות</h2>
   <p class="p">כל חלק נחתך מהלוח יחד עם פס הקנט שלו (${res.opts.edgeH} מ"מ + מסור ${res.opts.kerf} מ"מ), כך שהגיד ממשיך ברציפות מהמשטח אל הקנט.</p>
   ${res.used.map((u) => `<div class="fig">${V.boardSVG(u, res, tex, w)}</div><p class="p ltr" style="font-size:12px">${V.esc(u.board.id)} · ${u.board.w}×${u.board.h}</p>`).join('')}</section>
  <section class="pg"><div class="ph"><span>פירוט</span><span>Barstone</span></div><h2>פירוט חלקים</h2>
   <div class="tw"><table class="tb"><tr><th>חלק</th><th>מידה (מ"מ)</th><th>לוח</th></tr>${res.pieces.map((p) => `<tr><td>${p.key} · ${V.esc(p.name)}</td><td class="ltr">${p.L}×${p.W}</td><td class="ltr">${V.esc((where[p.key] || ['—']).join(', '))}</td></tr>`).join('')}</table></div>
   <h3 class="h3">לוחות</h3><div class="tw"><table class="tb"><tr><th>לוח</th><th>מידה</th><th>חלקים</th><th>ניצולת</th></tr>${res.used.map((u) => `<tr><td class="ltr">${V.esc(u.board.id)}${u.board.auto ? ' · אוטומטי' : ''}</td><td class="ltr">${u.board.w}×${u.board.h}</td><td>${u.place.length}</td><td>${bu(u)}%</td></tr>`).join('')}</table></div>
   ${sim.sink ? `<h3 class="h3">כיור בנוי מאבן</h3><p class="p">פתח ${sim.sink_w_cm || 60}×${sim.sink_d_cm || 40} ס"מ, עומק אגן ${sim.sink_h_cm || 20} ס"מ, ${sk && sk.ok ? `ב${({A:"משטח הראשי",B:"משטח L",C:"אי"})[sk.key]}, מרכזו ${(sk.cx / 10).toFixed(0)} ס"מ מתחילת החלק` : 'מיקום לא תקין'}. האגן בנוי מ-5 חלקים (תחתית + 4 דפנות) מאותה אבן.${sk && sk.note ? ' <b>' + V.esc(sk.note) + '</b>' : ''}</p>` : ''}
   ${sim.l_length_cm ? `<p class="p" style="font-size:12px;color:#8C857B">מדידת משטח L: האורך (${sim.l_length_cm} ס"מ) נמדד מהקצה התחתון של המשטח הראשי — לא כולל עומק הפינה. אם נמדד מהקיר, יש להפחית ${sim.depth_cm} ס"מ.</p>` : ''}
   <p class="p">שטח חלקים ${m.piece_m2} מ"ר · צריכת אבן ${m.consumed_m2} מ"ר · קנט ${m.edge_m} מ' · חיבורים ${m.joints}</p>
   ${res.warnings.length ? `<div class="warn"><b>לתשומת לב</b><br>${res.warnings.map(V.esc).join('<br>')}</div>` : ''}
   <p class="p" style="font-size:11px;color:#8C857B">המסמך הוא הדמיה; מידות סופיות נקבעות במדידה באתר. ${stone.tile_path && /v3/.test(stone.tile_path) ? 'צילום האבן: Wikimedia Commons (CC BY / CC BY-SA).' : ''}</p>
   <p class="p"><button onclick="print()" style="border:0;border-radius:999px;padding:10px 18px;background:#1B1A18;color:#fff;font:500 14px Heebo">שמירה כ-PDF / הדפסה</button></p></section>`;
})();
