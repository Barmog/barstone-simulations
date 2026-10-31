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
  const read = () => { const o = { plan_pos: planPos }; for (const el of form.querySelectorAll('[name]')) o[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value; return o; };
  let res;
  function draw() {
    sim = read(); S.setSim(sim);
    const stone = stones.find((s) => String(s.id) === String(sim.stone_id)) || stones[0];
    const tex = S.texture(stone);
    res = E.run(sim, S.getBoards(), { edgeH: sim.edge_mm || 40, kerf: sim.kerf_mm || 4 }); res.sim = sim;
    localStorage.setItem('lastResult', JSON.stringify({ metrics: res.metrics, warnings: res.warnings, stone: stone && stone.name, pieces: res.pieces.map(({ key, name, L, W, sink }) => ({ key, name, L, W, sink })) }));
    const bw = Math.min(520, $('#boards').clientWidth - 10);
    $('#boards').innerHTML = res.used.map((u) => `<div class="boardcard">${V.boardSVG(u, res, tex, bw)}<div class="cap">${V.esc(u.board.id)} · ${u.board.w}×${u.board.h}${u.board.auto ? ' · אוטומטי' : ''}</div></div>`).join('') || '<p>הזינו מידות</p>';
    $('#bcap').textContent = `${res.metrics.boards} לוחות · ניצולת ${res.metrics.utilization}%`;
    $('#plan').innerHTML = V.planSVG(res, tex, $('#plan').clientWidth);
    const m = res.metrics;
    $('#metrics').innerHTML = [['לוחות', m.boards], ['ניצולת', m.utilization + '%'], ['צריכת אבן', m.consumed_m2 + ' מ"ר'], ['שטח חלקים', m.piece_m2 + ' מ"ר'], ['קנט', m.edge_m + ' מ\''], ['חיבורים', m.joints]].map(([a, b]) => `<div><small>${a}</small><b>${b}</b></div>`).join('');
    $('#warn').innerHTML = res.warnings.length ? `<div class="warn">${res.warnings.map(V.esc).join('<br>')}</div>` : '<div class="warn ok">אין חריגות · הקנט רציף מהלוח</div>';
    $('#parts').innerHTML = res.pieces.map((p) => `<li><span>${p.key} · ${V.esc(p.name)}</span><span>${p.L}×${p.W}</span></li>`).join('');
    // גרירת חלקים בתוכנית → שמירת מיקום ב-sim.plan_pos וחישוב מחדש
    const psvg = document.querySelector('svg.plan');
    if (psvg) psvg.querySelectorAll('.pp').forEach((g) => {
      g.style.touchAction = 'none';
      g.onpointerdown = (e) => {
        e.preventDefault(); g.setPointerCapture(e.pointerId); g.style.cursor = 'grabbing';
        const r = psvg.getBoundingClientRect(), k = psvg.viewBox.baseVal.width / r.width, x0 = e.clientX, y0 = e.clientY;
        const key = g.dataset.key, same = psvg.querySelectorAll(`.pp[data-key="${key}"]`);
        let dx = 0, dy = 0;
        g.onpointermove = (ev) => { dx = (ev.clientX - x0) * k; dy = (ev.clientY - y0) * k; same.forEach((n) => n.setAttribute('transform', `translate(${dx},${dy})`)); };
        g.onpointerup = () => {
          g.onpointermove = g.onpointerup = null;
          if (Math.abs(dx) + Math.abs(dy) < 5) return;
          const pc = res.pieces.find((p) => p.key === key), snap = (v) => Math.max(0, Math.round(v / 10) * 10);
          planPos = { ...planPos, [key]: { x: snap(pc.plan.x + dx), y: snap(pc.plan.y + dy) } };
          draw(); toast(`"${pc.name}" הוזז · החישוב עודכן`);
        };
      };
    });
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
  $('#save').onclick = async () => { try { const r = await S.saveRemote(sim, res); toast(r.local ? 'נשמר במכשיר' : 'נשמר בענן ✓'); } catch (e) { toast('שגיאה בשמירה: ' + e.message); } };
  $('#toDoc').onclick = () => (location.href = 'document/document.html');
  $('#resetPos').onclick = () => { planPos = {}; draw(); toast('מיקומי התוכנית אופסו'); };
  renderStack(); draw();
})();
