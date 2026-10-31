// סרגל מסלול משותף: מידות › פריסת שיש › רינדור › מסמך. נשמר ב-localStorage, בלי Supabase.
(function(){
  const base = location.pathname.includes('/mobile/')||location.pathname.includes('/document/') ? '../' : '';
  const mob = matchMedia('(max-width: 820px)').matches;
  const steps = [['dimensions.html','מידות'],[mob?'mobile/mobile.html':'layout.html','פריסת שיש'],['render.html','רינדור'],['document/document.html','מסמך']];
  const here = location.pathname.split('/').slice(-2).join('/');
  const cur = steps.findIndex(([h])=>here.endsWith(h.split('/').pop()) || (h.startsWith('mobile/')&&here.startsWith('mobile/')));
  const sim = JSON.parse(localStorage.getItem('currentSim')||'null');
  const bar = document.createElement('nav'); bar.dir='rtl'; bar.id='bs-flow';
  bar.innerHTML = `<a href="${base}index.html" class="home">Barstone</a>` + steps.map(([h,t],i)=>`<a href="${base}${h}" class="${i===cur?'on':''}">${i+1}. ${t}</a>`).join('<span>›</span>') + (sim?`<em>${sim.client_name||''} · ${sim.length_cm}×${sim.depth_cm} ס"מ</em>`:'');
  const st = document.createElement('style');
  st.textContent = `#bs-flow{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:94vw;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.78);backdrop-filter:blur(18px) saturate(1.6);-webkit-backdrop-filter:blur(18px) saturate(1.6);box-shadow:0 8px 30px rgba(0,0,0,.14),inset 0 0 0 .5px rgba(0,0,0,.08);font:500 13px Heebo,system-ui,sans-serif}#bs-flow a{color:#3a3530;text-decoration:none;padding:4px 10px;border-radius:999px}#bs-flow a.on{background:#1d1b19;color:#fff}#bs-flow a.home{font-weight:700}#bs-flow span{color:#aaa}#bs-flow em{font-style:normal;color:#8a7a62;font-size:12px}@media print{#bs-flow{display:none}}`;
  document.head.appendChild(st); document.body.appendChild(bar);
  // מוק הדסקטופ בנוי ל-1440×900: מתאים לגודל המסך
  if (document.body.dataset.fit==='1440') { const f=()=>{const s=Math.min(innerWidth/1440,innerHeight/900);document.body.style.transformOrigin='top right';document.body.style.transform=`scale(${s})`;document.documentElement.style.overflow='hidden';}; f(); addEventListener('resize',f); }
})();
