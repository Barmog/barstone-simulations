// כלים מהירים: חיפוי קיר / מפל לאי בלחיצה, ומידות חיות (סליידרים) — מסונכרנים לשדות הטופס (#form) ומחשבים מחדש בלי רענון
(function () {
  const form = document.getElementById('form'), host = document.getElementById('quick'); if (!form || !host) return;
  const F = (n) => form.querySelector(`[name="${n}"]`);
  if (!F('island_waterfall')) { const l = document.createElement('label'); l.className = 'chk full'; l.innerHTML = '<input type="checkbox" name="island_waterfall"> מפל לאי (צדדים מאותה אבן)'; F('island_w_cm').closest('label').after(l);
    const sim = JSON.parse(localStorage.getItem('currentSim') || '{}'); l.firstChild.checked = !!sim.island_waterfall; }
  const fire = () => { form.dispatchEvent(new Event('input', { bubbles: true })); window.bsHaptic && bsHaptic(8); sync(); };
  const set = (n, v) => { const el = F(n); if (!el) return; el.type === 'checkbox' ? (el.checked = v) : (el.value = v); };
  const SL = [['length_cm', 'אורך מטבח', 100, 700, 1], ['depth_cm', 'עומק משטח', 50, 80, .5], ['l_length_cm', 'אורך L', 0, 400, 1], ['island_l_cm', 'אורך אי', 0, 400, 1], ['island_w_cm', 'רוחב אי', 50, 160, 1]];
  host.innerHTML = `<div class="qk-row"><button type="button" class="qk" id="qClad"><span>▦</span> חיפוי קיר</button><span class="qk-seg" id="qCladH">${[15, 25, 60].map((h) => `<button type="button" data-h="${h}">${h === 60 ? 'עד הארונות · 60' : h} ס"מ</button>`).join('')}</span>
  <label class="qk-h" id="qCladF"><span>גובה חיפוי</span><input type="range" id="qHr" min="5" max="120" step="1" aria-label="גובה חיפוי"><input type="number" id="qHn" min="5" max="120" step="any" inputmode="decimal" aria-label="גובה חיפוי בס״מ"><em>ס"מ</em></label>
  <button type="button" class="qk" id="qWf"><span>◫</span> מפל לאי</button></div>
  <div class="qk-sl">${SL.map(([n, t, a, b, st]) => `<label><span>${t}<output id="o_${n}"></output></span><input type="range" data-n="${n}" min="${a}" max="${b}" step="${st}"></label>`).join('')}</div><div class="qk-msg" id="qMsg"></div>`;
  function sync() {
    const h = +F('splash_h_cm').value || 0, isl = +F('island_l_cm').value || 0, wf = F('island_waterfall').checked;
    host.querySelector('#qClad').classList.toggle('on', h > 0); host.querySelector('#qCladH').style.display = host.querySelector('#qCladF').style.display = h > 0 ? '' : 'none';
    ['#qHr', '#qHn'].forEach((q) => { const e = host.querySelector(q); if (document.activeElement !== e && h > 0) e.value = h; });
    host.querySelectorAll('#qCladH button').forEach((b) => b.classList.toggle('on', +b.dataset.h === h));
    const qw = host.querySelector('#qWf'); qw.classList.toggle('on', wf && isl > 0); qw.disabled = isl <= 0; qw.title = isl > 0 ? '' : 'אין אי — הגדירו אורך אי';
    host.querySelectorAll('input[type=range]').forEach((r) => { const v = +F(r.dataset.n).value || 0; if (document.activeElement !== r) r.value = v; host.querySelector('#o_' + r.dataset.n).textContent = v ? v + ' ס"מ' : 'אין'; });
    setTimeout(() => { const w = document.getElementById('warn'), bad = w && /גדול מה|לא נכנס|אין מקום לכיור|אין מקום לכיריים|לא נמצא מקום/.test(w.innerText); const m = host.querySelector('#qMsg'); m.textContent = bad ? '⚠︎ במידות האלה פתח (כיור/כיריים) לא נכנס — ראו "לתשומת לב"' : ''; m.classList.toggle('bad', !!bad); }, 400);
  }
  host.querySelector('#qClad').onclick = () => { set('splash_h_cm', (+F('splash_h_cm').value || 0) > 0 ? 0 : 25); fire(); };
  host.querySelector('#qCladH').onclick = (e) => { const b = e.target.closest('button'); if (b) { set('splash_h_cm', +b.dataset.h); fire(); } };
  const hv = (e) => { let v = +e.target.value; if (!(v > 0)) return; v = Math.min(120, Math.max(5, v)); set('splash_h_cm', v); fire(); };
  host.querySelector('#qHr').addEventListener('input', hv); host.querySelector('#qHn').addEventListener('input', hv);
  host.querySelector('#qWf').onclick = () => { set('island_waterfall', !F('island_waterfall').checked); fire(); };
  host.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', () => { set(r.dataset.n, r.value); fire(); }));
  form.addEventListener('input', () => setTimeout(sync, 0)); sync();
})();
