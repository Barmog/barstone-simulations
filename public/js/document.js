// מסמך ללקוח — Barstone. מתוך ההדמיה של המשתמש (Supabase לפי ?id=, אחרת localStorage). מותאם להדפסה/PDF ולטלפון.
(async function () {
  const S = window.SimStore, E = window.StoneEngine, V = window.StoneViews, el = document.getElementById('doc');
  const qid = new URLSearchParams(location.search).get('id') || null;
  let sim = S.getSim(), boards = S.getBoards(), saved = null;
  if (qid) { saved = await S.loadRemote(qid); if (saved && saved.layout) { sim = saved.layout.sim; boards = saved.layout.boards || []; } }
  if (!sim || !sim.length_cm) { el.innerHTML = '<section class="pg"><h2>אין עדיין הדמיה</h2><p class="p">יש להזין מידות ולבצע פריסת שיש. <a href="../dimensions.html">להתחלה</a> · <a href="document-sample.html">מסמך לדוגמה</a></p></section>'; return; }
  const stones = await S.stones(), stone = stones.find((s) => String(s.id) === String(sim.stone_id)) || stones[0], tex = S.texture(stone);
  const res = E.run(sim, boards, { edgeH: sim.edge_mm || 40, kerf: sim.kerf_mm || 4 }); res.sim = sim;
  const cu = E.cutouts ? E.cutouts(res, sim) : { items: [], warnings: [] }, warns = [...res.warnings, ...cu.warnings], where = {};
  res.used.forEach((u) => u.place.forEach((p) => { (where[p.block.piece.key] = where[p.block.piece.key] || []).push(`${u.board.id}${p.block.segs > 1 ? ' (קטע ' + (p.block.seg + 1) + ')' : ''}${p.rot ? ' ↻' : ''}`); }));
  const bu = (u) => Math.round(100 * u.place.reduce((a, p) => a + p.block.L * p.block.W, 0) / ((u.board.w || res.opts.boardW) * (u.board.h || res.opts.boardH)));
  const m = res.metrics, d = new Date().toLocaleDateString('he-IL'), num = saved ? saved.id.slice(0, 8).toUpperCase() : 'טיוטה';
  const w = Math.min(760, document.documentElement.clientWidth - 56), esc = V.esc;
  const hd = (t) => `<div class="ph"><img src="logo.png" alt="Barstone"><span>${t}</span><span class="ltr">${num} · ${d}</span></div>`;
  const kv = (rows) => `<div class="kvs">${rows.filter(Boolean).map(([a, b]) => `<div class="kv"><span>${a}</span><b>${b}</b></div>`).join('')}</div>`;
  const lbl = { sink: 'כיור', faucet: 'חור ברז Ø35 מ"מ', cooktop: 'כיריים' };
  const main = res.pieces.filter((p) => p.plan), sinkParts = res.pieces.filter((p) => p.sink);
  el.innerHTML = `
  <div class="bar no-print"><a href="../layout.html">‹ חזרה לפריסה</a><button onclick="print()">שמירה כ-PDF / הדפסה</button></div>
  <section class="cover pg"><div class="top"><img src="logo.png" alt="Barstone" class="logo"><span class="eb">הדמיית משטח אבן</span></div>
   <h1>${esc(sim.client_name || 'הדמיית מטבח')}</h1>
   <p class="lead">${esc(stone.name)} · עובי ${sim.thickness_cm || 2} ס"מ · קנט ${sim.edge !== false ? 'רציף מהלוח' : 'ללא'}</p>
   <div class="cv-img" style="background-image:url('${tex}')"><span>${esc(stone.name)}</span></div>
   <div class="meta"><div><small>תאריך</small><b>${d}</b></div><div><small>מספר מסמך</small><b class="ltr">${num}</b></div><div><small>לוחות</small><b>${m.boards}</b></div><div><small>צריכת אבן</small><b>${m.consumed_m2} מ"ר</b></div><div><small>חיבורים</small><b>${m.joints}</b></div><div><small>פתחים</small><b>${cu.items.length}</b></div></div></section>

  <section class="pg">${hd('סיכום ותוכנית')}<h2>סיכום</h2>
   ${kv([['משטח ראשי', `${sim.length_cm}×${sim.depth_cm} ס"מ`], sim.l_length_cm ? ['משטח L', `${sim.l_length_cm}×${sim.l_depth_cm || sim.depth_cm} ס"מ`] : null, sim.island_l_cm ? ['אי', `${sim.island_l_cm}×${sim.island_w_cm} ס"מ`] : null, sim.splash_h_cm ? ['חיפוי', `גובה ${sim.splash_h_cm} ס"מ`] : null,
     ['אבן', esc(stone.name)], ['עובי', `${sim.thickness_cm || 2} ס"מ`], ['קנט', sim.edge !== false ? `רציף מהלוח · ${res.opts.edgeH} מ"מ · ${m.edge_m} מ'` : 'ללא'], ['שטח חלקים', `${m.piece_m2} מ"ר`], ['ניצולת לוחות', `${m.utilization}%`]])}
   <h3 class="h3">תוכנית</h3><div class="fig">${V.planSVG(res, tex, w)}</div>
   <div class="lg"><span><i style="background:#E0428F"></i>קנט רציף</span><span><i style="background:#2FB070"></i>חיבור (J)</span><span><i style="background:rgba(27,26,24,.35)"></i>כיור</span><span><i style="background:#141416"></i>כיריים</span><span><i style="background:#fff;box-shadow:inset 0 0 0 2px #1B1A18;border-radius:50%"></i>חור ברז</span></div>
   ${warns.length ? `<div class="warn"><b>לתשומת לב</b><ul>${warns.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<div class="warn ok">אין חריגות — כל הפתחים רחוקים מחיבורים ומקצוות</div>'}</section>

  ${cu.items.length || sinkParts.length ? `<section class="pg">${hd('פתחים וכיור')}<h2>פתחים במשטח</h2>
   <div class="tw"><table class="tb"><tr><th>פתח</th><th>חלק</th><th>מידה (ס"מ)</th><th>מרכז מתחילת החלק</th><th>הערה</th></tr>${cu.items.map((c) => `<tr><td>${lbl[c.type]}${c.double ? ' כפול' : ''}</td><td>${esc(c.piece)}</td><td class="ltr">${c.type === 'faucet' ? 'Ø3.5' : `${c.w / 10}×${c.d / 10}`}</td><td>${(c.cx / 10).toFixed(0)} ס"מ</td><td>${c.note ? `<span class="bad">${esc(c.note)}</span>` : '✓'}</td></tr>`).join('')}</table></div>
   ${sim.sink ? `<p class="p">${sim.sink_type === 'stone' ? `הכיור בנוי מאותה אבן${sim.sink_double ? ' — שני אגנים עם מחיצה של 8 ס"מ' : ''}: עומק אגן ${sim.sink_h_cm || 20} ס"מ, ${sinkParts.length} חלקים (תחתית + 4 דפנות לכל אגן).` : `כיור קנוי (התקנה תחתונה / שטוחה)${sim.sink_double ? ', כפול' : ''} — במשטח נחתך פתח בלבד לפי מידות הכיור.`} פתחי הכיור והכיריים ממוקמים כך שלא יחצו חיבור ושיישאר לפחות 6 ס"מ מקצות החלק ו-2 ס"מ מהחזית ומהגב.</p>` : ''}
   ${sinkParts.length ? `<div class="tw"><table class="tb"><tr><th>חלק כיור</th><th>מידה (מ"מ)</th><th>לוח</th></tr>${sinkParts.map((p) => `<tr><td>${esc(p.name)}</td><td class="ltr">${p.L}×${p.W}</td><td class="ltr">${esc((where[p.key] || ['—']).join(', '))}</td></tr>`).join('')}</table></div>` : ''}</section>` : ''}

  <section class="pg brd">${hd('פריסה על הלוחות')}<h2>הלוחות</h2>
   <p class="p">כל חלק נחתך יחד עם פס הקנט שלו (${res.opts.edgeH} מ"מ + מסור ${res.opts.kerf} מ"מ), כך שהגיד ממשיך ברציפות מהמשטח אל הקנט.</p>
   ${res.used.map((u) => `<figure class="fig"><div>${V.boardSVG(u, res, tex, w)}</div><figcaption><span class="ltr">${esc(u.board.id)}</span> · ${u.board.w}×${u.board.h} מ"מ · ניצולת ${bu(u)}%</figcaption></figure>`).join('')}
   <div class="tw"><table class="tb"><tr><th>לוח</th><th>מידה</th><th>חלקים</th><th>ניצולת</th></tr>${res.used.map((u) => `<tr><td class="ltr">${esc(u.board.id)}${u.board.auto ? ' · אוטומטי' : ''}</td><td class="ltr">${u.board.w}×${u.board.h}</td><td>${u.place.length}</td><td>${bu(u)}%</td></tr>`).join('')}</table></div></section>

  <section class="pg">${hd('פירוט חלקים')}<h2>פירוט חלקים</h2>
   <div class="tw"><table class="tb"><tr><th>#</th><th>חלק</th><th>מידה (מ"מ)</th><th>קנט</th><th>לוח</th></tr>${main.map((p) => `<tr><td>${p.key}</td><td>${esc(p.name)}</td><td class="ltr">${p.L}×${p.W}</td><td>${p.edge ? (p.edgeBoth ? 'שני צדדים' : 'חזית') : '—'}</td><td class="ltr">${esc((where[p.key] || ['—']).join(', '))}</td></tr>`).join('')}</table></div>
   ${res.jointList && res.jointList.length ? `<h3 class="h3">חיבורים</h3><ul class="ul">${res.jointList.map((j) => `<li>${esc(j.name)} — ${(j.at / 10).toFixed(0)} ס"מ מתחילת החלק</li>`).join('')}</ul>` : ''}
   ${sim.l_length_cm ? `<p class="note">מדידת משטח L: האורך (${sim.l_length_cm} ס"מ) נמדד מהקצה התחתון של המשטח הראשי — לא כולל עומק הפינה. אם נמדד מהקיר, יש להפחית ${sim.depth_cm} ס"מ.</p>` : ''}</section>

  <section class="pg">${hd('אישור לקוח')}<h2>אישור והתחייבות</h2>
   <ul class="ul"><li>המסמך הוא הדמיה. המידות הסופיות נקבעות במדידה באתר לפני החיתוך.</li><li>אבן טבעית — גוון וגיד עשויים להשתנות בין לוחות; מיקום החלקים על הלוח ייקבע סופית בבחירת לוחות במפעל.</li><li>מיקומי הכיור, הכיריים וחור הברז יאושרו מול דגמי המוצרים בפועל.</li><li>מספר החיבורים ומיקומם כמפורט בתוכנית.</li></ul>
   <div class="sigs"><div class="sig"><small>הלקוח</small><div class="line"></div><span>שם: ${esc(sim.client_name || '')}</span><span>חתימה ותאריך</span></div><div class="sig"><small>Barstone</small><div class="line"></div><span>שם הנציג</span><span>חתימה ותאריך</span></div></div>
   <p class="foot">Barstone · מסמך ${num} · ${d}${stone.tile_path && /v3/.test(stone.tile_path) ? ' · צילום האבן: Wikimedia Commons (CC BY / CC BY-SA)' : ''}</p></section>`;
  document.title = `הדמיה · ${sim.client_name || 'Barstone'} · ${d}`;
})();
