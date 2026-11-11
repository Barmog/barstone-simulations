// כלים מהירים: חיפוי קיר / מפל לאי בלחיצה, ומידות חיות (סליידרים) — מסונכרנים לשדות הטופס (#form) ומחשבים מחדש בלי רענון
(function () {
  const form = document.getElementById('form'), host = document.getElementById('quick'); if (!form || !host) return;
  const F = (n) => form.querySelector(`[name="${n}"]`);
  if (!F('island_waterfall')) { const l = document.createElement('label'); l.className = 'chk full'; l.innerHTML = '<input type="checkbox" name="island_waterfall"> מפל לאי (צדדים מאותה אבן)'; F('island_w_cm').closest('label').after(l);
    const sim = JSON.parse(localStorage.getItem('currentSim') || '{}'); l.firstChild.checked = !!sim.island_waterfall; }
  { const hold = document.createElement('div'); hold.hidden = true; hold.id = 'upFields'; const cur = JSON.parse(localStorage.getItem('currentSim') || '{}');
    [['upper_on', 'checkbox'], ['clad_fit', 'checkbox'], ['upper_x_cm'], ['upper_l_cm'], ['upper_h_cm'], ['upper_d_cm'], ['upper_b_cm']].forEach(([n, t]) => { if (F(n)) return; const i = document.createElement('input'); i.name = n; i.type = t || 'number'; i.step = 'any';
      if (t) i.checked = n === 'upper_on' ? cur.upper_on !== false : !!cur.clad_fit; else if (cur[n] !== undefined && cur[n] !== '') i.value = cur[n]; hold.appendChild(i); }); form.appendChild(hold); }
  const UP = () => { const L = (+F('length_cm').value || 0) * 10; return window.StoneEngine.upperOf({ upper_on: F('upper_on').checked, upper_x_cm: F('upper_x_cm').value, upper_l_cm: F('upper_l_cm').value, upper_h_cm: F('upper_h_cm').value, upper_d_cm: F('upper_d_cm').value, upper_b_cm: F('upper_b_cm').value }, L); };
  const fire = () => { form.dispatchEvent(new Event('input', { bubbles: true })); window.bsHaptic && bsHaptic(8); sync(); };
  const set = (n, v) => { const el = F(n); if (!el) return; el.type === 'checkbox' ? (el.checked = v) : (el.value = v); };
  const SL = [['length_cm', 'אורך מטבח', 100, 700, 1], ['depth_cm', 'עומק משטח', 50, 80, .5], ['l_length_cm', 'אורך L', 0, 400, 1], ['island_l_cm', 'אורך אי', 0, 400, 1], ['island_w_cm', 'רוחב אי', 50, 160, 1]];
  host.innerHTML = `<div class="qk-row"><button type="button" class="qk" id="qClad"><span>▦</span> חיפוי קיר</button><span class="qk-seg" id="qCladH">${[15, 25, 60].map((h) => `<button type="button" data-h="${h}">${h === 60 ? 'עד הארונות · 60' : h} ס"מ</button>`).join('')}</span>
  <label class="qk-h" id="qCladF"><span>גובה חיפוי</span><input type="range" id="qHr" min="5" max="120" step="1" aria-label="גובה חיפוי"><input type="number" id="qHn" min="5" max="120" step="any" inputmode="decimal" aria-label="גובה חיפוי בס״מ"><em>ס"מ</em></label>
  <button type="button" class="qk" id="qWf"><span>◫</span> מפל לאי</button></div>
  <div class="qk-row qk-up"><button type="button" class="qk" id="qUp"><span>▭</span> ארון עליון</button><button type="button" class="qk" id="qFit"><span>⇕</span> חיפוי עד הארון</button>
  <small class="qk-note">כשמופעל "חיפוי עד הארון": גובה החיפוי = מתחתית הארון העליון עד המשטח, ואורכו = אורך הארון ומיקומו. הזזה/שינוי הארון משנים את החיפוי מיד. בתוכנית אפשר לגרור את הארון ↔.</small></div>
  <div class="qk-sl" id="qUpSl">${[['upper_x_cm', 'מיקום ארון (מתחילת המשטח)', 0, 600], ['upper_l_cm', 'אורך ארון', 30, 700], ['upper_h_cm', 'גובה ארון', 30, 120], ['upper_d_cm', 'עומק ארון', 20, 60], ['upper_b_cm', 'תחתית הארון מהרצפה', 110, 200]].map(([n, t, a, b]) => `<label><span>${t}<output id="o_${n}"></output></span><input type="range" data-u="${n}" min="${a}" max="${b}" step="1"></label>`).join('')}</div>
  <div class="qk-sl">${SL.map(([n, t, a, b, st]) => `<label><span>${t}<output id="o_${n}"></output></span><input type="range" data-n="${n}" min="${a}" max="${b}" step="${st}"></label>`).join('')}</div><div class="qk-msg" id="qMsg"></div>`;
  function sync() {
    const h = +F('splash_h_cm').value || 0, isl = +F('island_l_cm').value || 0, wf = F('island_waterfall').checked;
    host.querySelector('#qClad').classList.toggle('on', h > 0); host.querySelector('#qCladH').style.display = host.querySelector('#qCladF').style.display = h > 0 ? '' : 'none';
    ['#qHr', '#qHn'].forEach((q) => { const e = host.querySelector(q); if (document.activeElement !== e && h > 0) e.value = h; });
    host.querySelectorAll('#qCladH button').forEach((b) => b.classList.toggle('on', +b.dataset.h === h));
    const qw = host.querySelector('#qWf'); qw.classList.toggle('on', wf && isl > 0); qw.disabled = isl <= 0; qw.title = isl > 0 ? '' : 'אין אי — הגדירו אורך אי';
    { const U = UP(), on = F('upper_on').checked, fit = F('clad_fit').checked, L = +F('length_cm').value || 0, cv = { upper_x_cm: U.x, upper_l_cm: U.l, upper_h_cm: U.h, upper_d_cm: U.d, upper_b_cm: U.b };
      host.querySelector('#qUp').classList.toggle('on', on); host.querySelector('#qFit').classList.toggle('on', fit && on && h > 0); host.querySelector('#qFit').disabled = !on; host.querySelector('#qUpSl').style.display = on ? '' : 'none';
      if (fit && on && h > 0) { host.querySelector('#qCladH').style.display = host.querySelector('#qCladF').style.display = 'none'; }
      host.querySelectorAll('input[data-u]').forEach((r) => { const n = r.dataset.u, v = cv[n] / 10; if (n === 'upper_x_cm') r.max = Math.max(0, L - U.l / 10); if (n === 'upper_l_cm') r.max = Math.max(30, L); if (document.activeElement !== r) r.value = v; host.querySelector('#o_' + n).textContent = v + ' ס"מ'; }); }
    host.querySelectorAll('input[type=range][data-n]').forEach((r) => { const v = +F(r.dataset.n).value || 0; if (document.activeElement !== r) r.value = v; host.querySelector('#o_' + r.dataset.n).textContent = v ? v + ' ס"מ' : 'אין'; });
    setTimeout(() => { const w = document.getElementById('warn'), bad = w && /גדול מה|לא נכנס|אין מקום לכיור|אין מקום לכיריים|לא נמצא מקום/.test(w.innerText); const m = host.querySelector('#qMsg'); m.textContent = bad ? '⚠︎ במידות האלה פתח (כיור/כיריים) לא נכנס — ראו "לתשומת לב"' : ''; m.classList.toggle('bad', !!bad); }, 400);
  }
  host.querySelector('#qClad').onclick = () => { set('splash_h_cm', (+F('splash_h_cm').value || 0) > 0 ? 0 : 25); fire(); };
  host.querySelector('#qCladH').onclick = (e) => { const b = e.target.closest('button'); if (b) { set('splash_h_cm', +b.dataset.h); fire(); } };
  const hv = (e) => { let v = +e.target.value; if (!(v > 0)) return; v = Math.min(120, Math.max(5, v)); set('splash_h_cm', v); fire(); };
  host.querySelector('#qHr').addEventListener('input', hv); host.querySelector('#qHn').addEventListener('input', hv);
  host.querySelector('#qUp').onclick = () => { set('upper_on', !F('upper_on').checked); fire(); };
  host.querySelector('#qFit').onclick = () => { const v = !F('clad_fit').checked; set('clad_fit', v); if (v && !((+F('splash_h_cm').value || 0) > 0)) set('splash_h_cm', 25); fire(); };
  host.querySelectorAll('input[data-u]').forEach((r) => r.addEventListener('input', () => { const U = UP(); ['upper_x_cm', 'upper_l_cm'].forEach((n) => { if (F(n).value === '') set(n, (n === 'upper_x_cm' ? U.x : U.l) / 10); }); set(r.dataset.u, r.value); fire(); }));
  // גרירת הארון העליון בתוכנית (לאורך הקיר)
  const plan = document.getElementById('plan');
  plan && plan.addEventListener('pointerdown', (e) => { const u = e.target.closest && e.target.closest('.upc'); if (!u) return; const sv = plan.querySelector('svg.plan'); if (!sv) return;
    e.stopPropagation(); e.preventDefault(); const k = sv.viewBox.baseVal.width / sv.getBoundingClientRect().width, x0 = e.clientX, U = UP(); let dx = 0; u.style.opacity = .7;
    const mv = (ev) => { dx = (ev.clientX - x0) * k; u.setAttribute('transform', `translate(${dx},0)`); };
    const upf = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', upf); const L = (+F('length_cm').value || 0) * 10; set('upper_l_cm', U.l / 10); set('upper_x_cm', Math.round(Math.min(L - U.l, Math.max(0, U.x + dx)) / 10)); fire(); };
    addEventListener('pointermove', mv); addEventListener('pointerup', upf); }, true);
  host.querySelector('#qWf').onclick = () => { set('island_waterfall', !F('island_waterfall').checked); fire(); };
  host.querySelectorAll('input[type=range][data-n]').forEach((r) => r.addEventListener('input', () => { set(r.dataset.n, r.value); fire(); }));
  form.addEventListener('input', () => setTimeout(sync, 0)); sync();
})();
