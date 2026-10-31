// מסך פריסת שיש: טופס → מנוע → תצוגה כפולה → שמירה
(async function () {
  const S = window.SimStore, E = window.StoneEngine, V = window.StoneViews;
  const $ = (s) => document.querySelector(s), form = $('#form');
  const toast = (t) => { const el = $('#toast'); el.textContent = t; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 2200); };
  $('#sb').textContent = S.sb ? 'מחובר לענן' : 'מצב מקומי';
  const stones = await S.stones();
  $('#stone').innerHTML = stones.map((s) => `<option value="${s.id}">${V.esc(s.name)}</option>`).join('');
  // טעינת נתונים: מזהה ב-URL → Supabase, אחרת localStorage
  const qid = new URLSearchParams(location.search).get('id');
  let sim = S.getSim() || {};
  if (qid) { const row = await S.loadRemote(qid); if (row && row.layout && row.layout.sim) sim = row.layout.sim; }
  for (const el of form.querySelectorAll('[name]')) if (sim[el.name] !== undefined) el.type === 'checkbox' ? (el.checked = !!sim[el.name]) : (el.value = sim[el.name]);
  let planPos = sim.plan_pos || {};
  const read = () => { const o = { plan_pos: planPos }; for (const el of form.querySelectorAll('[name]')) o[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value; return o; };
  let res; const plan = $('#plan'), P = new Map(); let Z = { z: 1, x: 0, y: 0 }, pin = null, pan = null;
  function draw() {
    sim = read(); S.setSim(sim);
    const stone = stones.find((s) => String(s.id) === String(sim.stone_id)) || stones[0];
    const tex = S.texture(stone);
    res = E.run(sim, S.getBoards(), { edgeH: sim.edge_mm || 40, kerf: sim.kerf_mm || 4 }); res.sim = sim;
    localStorage.setItem('lastResult', JSON.stringify({ metrics: res.metrics, warnings: res.warnings, stone: stone && stone.name, pieces: res.pieces.map(({ key, name, L, W, sink }) => ({ key, name, L, W, sink })) }));
    const bw = Math.min(520, $('#boards').clientWidth - 10);
    $('#boards').innerHTML = res.used.map((u) => `<div class="boardcard">${V.boardSVG(u, res, tex, bw)}<div class="cap">${V.esc(u.board.id)} · ${u.board.w}×${u.board.h}${u.board.auto ? ' · אוטומטי' : ''}</div></div>`).join('') || '<p>הזינו מידות</p>';
    $('#bcap').textContent = `${res.metrics.boards} לוחות · ניצולת ${res.metrics.utilization}%`;
    $('#plan').innerHTML = V.planSVG(res, tex, $('#plan').clientWidth); applyZoom();
    const m = res.metrics;
    $('#metrics').innerHTML = [['לוחות', m.boards], ['ניצולת', m.utilization + '%'], ['צריכת אבן', m.consumed_m2 + ' מ"ר'], ['שטח חלקים', m.piece_m2 + ' מ"ר'], ['קנט', m.edge_m + ' מ\''], ['חיבורים', m.joints]].map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('');
    const cu = E.cutouts ? E.cutouts(res, sim) : { items: [], warnings: [] }, allW = [...res.warnings, ...cu.warnings];
    const lbl = { sink: 'כיור', faucet: 'חור ברז Ø35', cooktop: 'כיריים' };
    $('#cuts').innerHTML = cu.items.map((c) => `<li><span>${lbl[c.type]}${c.double ? ' כפול' : ''} · ${V.esc(c.piece)}</span><span>${c.type === 'faucet' ? '' : (c.w / 10) + '×' + (c.d / 10) + ' · '}מרכז ${(c.cx / 10).toFixed(0)} ס"מ</span></li>`).join('') || '<li style="color:var(--mute)">אין פתחים</li>';
    $('#warn').innerHTML = allW.length ? `<div class="warn"><b>לתשומת לב</b><ul style="margin:6px 0 0;padding-inline-start:18px">${allW.map((w) => `<li>${V.esc(w)}</li>`).join('')}</ul></div>` : '<div class="warn ok">אין חריגות · הקנט רציף מהלוח</div>';
    $('#parts').innerHTML = res.pieces.map((p) => `<li><span>${p.key} · ${V.esc(p.name)}</span><span>${p.L}×${p.W}</span></li>`).join('');
    // גרירת חלקים בתוכנית → שמירת מיקום ב-sim.plan_pos וחישוב מחדש
    const psvg = document.querySelector('svg.plan');
    if (psvg) psvg.querySelectorAll('.pp').forEach((n) => (n.style.touchAction = 'none'));
    // גרירה: זיהוי החלק לפי גאומטריה (לא לפי האלמנט שנלחץ) — פתחים, חיצי מידה ותוויות מעל החלק לא חוסמים יותר
    if (psvg) psvg.onpointerdown = (e) => {
        if (window.__bsPinch || (e.button && e.button !== 0)) return;
        const m = psvg.getScreenCTM(); if (!m) return;
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
        const hitP = [...res.pieces].reverse().find((p) => { if (!p.plan) return false; const q = StoneEngine.planRect(p, p.plan.x, p.plan.y); return pt.x >= q.x && pt.x <= q.x + q.w && pt.y >= q.y && pt.y <= q.y + q.h; });
        if (!hitP) return; const g = psvg.querySelector(`.pp[data-key="${hitP.key}"]`); if (!g) return;
        e.preventDefault(); e.stopPropagation(); psvg.setPointerCapture(e.pointerId); g.style.cursor = 'grabbing'; window.bsHaptic && bsHaptic(10); g.classList.add('lift');
        const r = psvg.getBoundingClientRect(), k = psvg.viewBox.baseVal.width / r.width, x0 = e.clientX, y0 = e.clientY;
        const key = g.dataset.key, same = psvg.querySelectorAll(`.pp[data-key="${key}"]`);
        let dx = 0, dy = 0;
        psvg.onpointermove = (ev) => { if (window.__bsPinch) return; dx = (ev.clientX - x0) * k; dy = (ev.clientY - y0) * k; same.forEach((n) => n.setAttribute('transform', `translate(${dx},${dy})`)); };
        psvg.onpointercancel = () => { same.forEach((n) => n.removeAttribute('transform')); psvg.onpointermove = psvg.onpointerup = null; g.classList.remove('lift'); };
        psvg.onpointerup = () => {
          psvg.onpointermove = psvg.onpointerup = psvg.onpointercancel = null; g.classList.remove('lift');
          if (window.__bsPinch || Math.abs(dx) + Math.abs(dy) < 5) { same.forEach((n) => n.removeAttribute('transform')); return; }
          window.bsHaptic && bsHaptic(14);
          const pc = res.pieces.find((p) => p.key === key), r = StoneEngine.resolvePlan(res.pieces, key, pc.plan.x + dx, pc.plan.y + dy);
          planPos = { ...planPos, [key]: { x: r.x, y: r.y } };
          draw(); toast(r.reverted ? `אין מקום פנוי — "${pc.name}" חזר למקומו` : r.moved ? `"${pc.name}" הוסט כדי למנוע חפיפה · החישוב עודכן` : `"${pc.name}" הוזז · החישוב עודכן`);
        };
    };
    // לחיצה על לוח = סימון פגם
    document.querySelectorAll('svg[data-board]').forEach((svg) => svg.onclick = (e) => {
      const id = svg.dataset.board, r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
      const x = ((e.clientX - r.left) / r.width) * vb.width, y = ((e.clientY - r.top) / r.height) * vb.height;
      let boards = S.getBoards(), b = boards.find((q) => q.id === id);
      if (!b) { const u = res.used.find((q) => q.board.id === id); b = { id, w: u.board.w, h: u.board.h, defects: [] }; boards.push(b); }
      b.defects = [...(b.defects || []), { x: Math.round(x - 100), y: Math.round(y - 100), w: 200, h: 200 }];
      S.setBoards(boards); renderStack(); draw(); toast('פגם סומן — הפריסה חושבה מחדש');
    });
  }
  function renderStack() {
    const boards = S.getBoards();
    $('#stack').innerHTML = boards.map((b, i) => `<li><i style="background-image:url('${b.tex || 'stone.jpg'}')"></i><span>${V.esc(b.id)} · ${b.w}×${b.h}${b.defects && b.defects.length ? ' · ' + b.defects.length + ' פגמים' : ''}</span><button class="x" data-i="${i}" title="הסרה">×</button></li>`).join('') || '<li style="color:var(--mute)">אין לוחות שמורים — יתווספו לוחות 3200×1600 אוטומטית</li>';
    $('#stack').querySelectorAll('.x').forEach((x) => x.onclick = () => { const b = S.getBoards(); b.splice(+x.dataset.i, 1); S.setBoards(b); renderStack(); draw(); });
  }
  const parseSize = () => { const m = $('#bSize').value.match(/(\d+)\D+(\d+)/); return m ? [+m[1], +m[2]] : [3200, 1600]; };
  $('#addB').onclick = () => { const [w, h] = parseSize(); const id = $('#bId').value.trim() || 'BS-' + (1000 + S.getBoards().length + 1); S.setBoards([...S.getBoards(), { id, w, h, defects: [] }]); $('#bId').value = ''; renderStack(); draw(); toast('לוח נוסף לערימה'); };
  $('#photo').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return; const img = new Image(), rd = new FileReader();
    rd.onload = () => { img.onload = () => { const c = document.createElement('canvas'), k = Math.min(1, 1200 / img.width); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const [w, h] = parseSize(); const id = $('#bId').value.trim() || 'IMG-' + Date.now().toString().slice(-5);
      try { S.setBoards([...S.getBoards(), { id, w, h, defects: [], tex: c.toDataURL('image/jpeg', .7) }]); } catch { return toast('התמונה גדולה מדי לאחסון במכשיר'); }
      renderStack(); draw(); toast('לוח מתמונה נוסף'); }; img.src = rd.result; };
    rd.readAsDataURL(f);
  };
  let t; form.addEventListener('input', () => { clearTimeout(t); t = setTimeout(draw, 150); });
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 200); });
  $('#save').onclick = async () => { try { const r = await S.saveRemote(sim, res); toast(r.local ? 'נשמר במכשיר' : r.same ? 'כבר שמור בענן ✓ (ללא שינוי)' : 'נשמר בענן ✓'); } catch (e) { toast('שגיאה בשמירה: ' + e.message); } };
  $('#toDoc').onclick = () => (location.href = 'document/document.html');
  $('#resetPos').onclick = () => { planPos = {}; draw(); toast('מיקומי התוכנית אופסו'); };
  // ===== תוכנית: צביטה לזום, גרירה עם שתי אצבעות / אצבע אחת כשמוגדל, כפתורי זום =====
  function applyZoom() { const sv = plan.querySelector('svg.plan'); if (sv) { sv.style.transformOrigin = '0 0'; sv.style.transform = `translate(${Z.x}px,${Z.y}px) scale(${Z.z})`; } plan.classList.toggle('zoomed', Z.z > 1.01); const zl = $('#zl'); if (zl) zl.textContent = Math.round(Z.z * 100) + '%'; }
  function clampZ() { const r = plan.getBoundingClientRect(), sv = plan.querySelector('svg.plan'); const w = sv ? sv.clientWidth : r.width, h = sv ? sv.clientHeight : r.height; Z.z = Math.min(5, Math.max(1, Z.z)); Z.x = Math.min(0, Math.max(r.width - w * Z.z, Z.x)); Z.y = Math.min(0, Math.max(Math.min(0, h - h * Z.z), Z.y)); }
  function zoomAt(k, mx, my) { const z0 = Z.z; Z.z = Math.min(5, Math.max(1, Z.z * k)); Z.x = mx - (mx - Z.x) * (Z.z / z0); Z.y = my - (my - Z.y) * (Z.z / z0); clampZ(); applyZoom(); }
  plan.addEventListener('pointerdown', (e) => {
    P.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (P.size === 2) { window.__bsPinch = true; const [a, b] = [...P.values()], r = plan.getBoundingClientRect(); pin = { d: Math.hypot(a.x - b.x, a.y - b.y), z: Z.z, x: Z.x, y: Z.y, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top }; pan = null; }
    else if (P.size === 1 && Z.z > 1.01 && !e.target.closest('.pp')) pan = { x: e.clientX, y: e.clientY, ox: Z.x, oy: Z.y };
  }, true);
  plan.addEventListener('pointermove', (e) => {
    if (!P.has(e.pointerId)) return; P.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pin && P.size >= 2) { const [a, b] = [...P.values()], r = plan.getBoundingClientRect(), mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      const z = Math.min(5, Math.max(1, pin.z * Math.hypot(a.x - b.x, a.y - b.y) / pin.d)); Z.z = z; Z.x = mx - (pin.mx - pin.x) * (z / pin.z); Z.y = my - (pin.my - pin.y) * (z / pin.z); clampZ(); applyZoom(); }
    else if (pan) { Z.x = pan.ox + e.clientX - pan.x; Z.y = pan.oy + e.clientY - pan.y; clampZ(); applyZoom(); }
  }, true);
  const up = (e) => { P.delete(e.pointerId); if (P.size < 2) pin = null; if (!P.size) { pan = null; setTimeout(() => (window.__bsPinch = false), 60); } };
  plan.addEventListener('pointerup', up, true); plan.addEventListener('pointercancel', up, true);
  plan.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); const r = plan.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * .01), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  let lastTap = 0; plan.addEventListener('pointerup', (e) => { if (e.target.closest('.pp')) return; const t = Date.now(); if (t - lastTap < 300) { Z = { z: 1, x: 0, y: 0 }; applyZoom(); } lastTap = t; });
  const zb = document.createElement('div'); zb.className = 'zb'; zb.innerHTML = '<button type="button" data-z="1.4" aria-label="הגדלה">+</button><span id="zl">100%</span><button type="button" data-z="0.7" aria-label="הקטנה">−</button><button type="button" data-z="0" aria-label="איפוס זום">⤢</button>';
  plan.parentNode.insertBefore(zb, plan); zb.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const k = +b.dataset.z, r = plan.getBoundingClientRect(); if (!k) Z = { z: 1, x: 0, y: 0 }; else zoomAt(k, r.width / 2, r.height / 2); applyZoom(); };
  renderStack(); draw();
})();
