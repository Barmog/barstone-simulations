// "טען דוגמה": טוען תוכנית בדיקה (מדידות פורת) ל-localStorage וממשיך לפריסת שיש
(async function () {
  const base = /\/(mobile|document)\//.test(location.pathname) ? '../' : '';
  const host = document.getElementById('samples'); if (!host) return;
  try {
    const list = await (await fetch(base + 'samples/index.json', { cache: 'no-store' })).json();
    host.innerHTML = '<option value="">טען דוגמה…</option>' + list.map((s) => `<option value="${s.file}">${s.name}</option>`).join('');
    host.onchange = async () => {
      if (!host.value) return;
      const sim = await (await fetch(base + 'samples/' + host.value, { cache: 'no-store' })).json();
      delete sim._source; localStorage.setItem('currentSim', JSON.stringify(sim)); localStorage.setItem('boards', '[]');
      location.href = base + 'layout.html';
    };
  } catch (e) { host.innerHTML = '<option>אין דוגמאות</option>'; }
})();
