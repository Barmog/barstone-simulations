// סרגל מסלול משותף: מידות › פריסת שיש › רינדור › מסמך. נשמר ב-localStorage, בלי Supabase.
(function(){
  const base = location.pathname.includes('/mobile/')||location.pathname.includes('/document/') ? '../' : '';
  const mob = matchMedia('(max-width: 820px)').matches;
  const steps = [['dimensions.html','מידות'],['layout.html','פריסת שיש'],['render.html','רינדור'],['document/document.html','מסמך']];
  const here = location.pathname.split('/').slice(-2).join('/');
  const cur = steps.findIndex(([h])=>here.endsWith(h.split('/').pop()) || (h.startsWith('mobile/')&&here.startsWith('mobile/')));
  const sim = JSON.parse(localStorage.getItem('currentSim')||'null');
  const bar = document.createElement('nav'); bar.dir='rtl'; bar.id='bs-flow';
  bar.innerHTML = `<a href="${base}index.html" class="home">Barstone</a>` + steps.map(([h,t],i)=>`<a href="${base}${h}" class="${i===cur?'on':''}">${i+1}. ${t}</a>`).join('<span>›</span>') + (sim?`<em>${sim.client_name||''} · ${sim.length_cm}×${sim.depth_cm} ס"מ</em>`:'');
  const st = document.createElement('style');
  st.textContent = `#bs-flow{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:94vw;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.78);backdrop-filter:blur(18px) saturate(1.6);-webkit-backdrop-filter:blur(18px) saturate(1.6);box-shadow:0 8px 30px rgba(0,0,0,.14),inset 0 0 0 .5px rgba(0,0,0,.08);font:500 13px Heebo,system-ui,sans-serif}#bs-flow a{color:#3a3530;text-decoration:none;padding:4px 10px;border-radius:999px}#bs-flow a.on{background:#1d1b19;color:#fff}#bs-flow a.home{font-weight:700}#bs-flow span{color:#aaa}#bs-flow em{font-style:normal;color:#8a7a62;font-size:12px}@media print{#bs-flow{display:none}}
@media(max-width:600px){html,body{overflow-x:hidden;max-width:100%}body{padding-bottom:calc(92px + env(safe-area-inset-bottom))!important}
#bs-flow{left:8px;right:8px;transform:none;max-width:none;bottom:calc(8px + env(safe-area-inset-bottom));flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;scrollbar-width:none;padding:6px;border-radius:22px;-webkit-overflow-scrolling:touch}
#bs-flow::-webkit-scrollbar{display:none}#bs-flow a{white-space:nowrap;min-height:40px;display:flex;align-items:center;padding:0 12px;font-size:14px}#bs-flow em,#bs-flow span{display:none}
input:not([type=checkbox]):not([type=radio]):not([type=range]),select,textarea{min-height:44px;font-size:16px!important}button,.btn{min-height:44px}
label:has(input[type=checkbox]){min-height:44px;display:flex;align-items:center;gap:8px}input[type=checkbox]{width:22px;height:22px}input[type=range]{min-height:32px}
svg{max-width:100%}img{max-width:100%}h1{overflow-wrap:anywhere}}`;
  // גלילה אוטומטית לשלב הנוכחי בסרגל
  setTimeout(()=>{const on=bar.querySelector('a.on');if(on&&on.scrollIntoView)on.scrollIntoView({inline:'center',block:'nearest'})},50);
  document.head.appendChild(st); document.body.appendChild(bar);
  // מוק הדסקטופ בנוי ל-1440×900: מתאים לגודל המסך
  if (document.body.dataset.fit==='1440') { const f=()=>{const s=Math.min(innerWidth/1440,innerHeight/900);document.body.style.transformOrigin='top right';document.body.style.transform=`scale(${s})`;document.documentElement.style.overflow='hidden';}; f(); addEventListener('resize',f); }
})();
// ===== מובייל: PWA, משוב מגע, גיליונות תחתונים (bottom sheets) =====
(function(){
  const base = /\/(mobile|document)\//.test(location.pathname) ? '../' : '', H = document.head;
  const add = (tag, a) => { const e = document.createElement(tag); Object.assign(e, a); H.appendChild(e); return e; };
  if (!H.querySelector('link[rel=manifest]')) { add('link', { rel: 'manifest', href: base + 'manifest.webmanifest' }); add('link', { rel: 'apple-touch-icon', href: base + 'icons/icon-180.png' }); add('link', { rel: 'icon', href: base + 'icons/icon-192.png' });
    for (const [n, c] of [['apple-mobile-web-app-capable', 'yes'], ['mobile-web-app-capable', 'yes'], ['apple-mobile-web-app-status-bar-style', 'default'], ['apple-mobile-web-app-title', 'Barstone']]) add('meta', { name: n, content: c });
    if (!H.querySelector('meta[name=theme-color]')) add('meta', { name: 'theme-color', content: '#F3EEE7' }); }
  // משוב "הפטי": רטט קצר (אנדרואיד) + כיווץ קל בלחיצה (כולל iOS)
  window.bsHaptic = (ms) => { try { navigator.vibrate && navigator.vibrate(ms || 8); } catch (e) {} };
  document.addEventListener('pointerdown', (e) => { if (e.target.closest('button,.btn,a,select,label.sw,[data-tap]')) bsHaptic(6); }, { passive: true });
  const st = document.createElement('style');
  st.textContent = `button,.btn,#bs-flow a,.vb button,.card{transition:transform .18s cubic-bezier(.3,1.3,.5,1),background .2s,opacity .2s;-webkit-tap-highlight-color:transparent}
button:active,.btn:active,#bs-flow a:active,.vb button:active{transform:scale(.96)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
.bs-fab{display:none}.bs-scrim{display:none}
.bs-grab{display:none}@media(max-width:820px){
 .bs-fab{display:flex;position:fixed;z-index:9990;left:50%;transform:translateX(-50%);bottom:calc(74px + env(safe-area-inset-bottom));align-items:center;gap:8px;border:0;border-radius:999px;min-height:48px;padding:0 22px;background:#1B1A18;color:#fff;font:600 15px Heebo,system-ui;box-shadow:0 14px 30px -8px rgba(0,0,0,.45)}
 .bs-fab:active{transform:translateX(-50%) scale(.95)}
 [data-sheet]{position:fixed!important;z-index:9995;left:0;right:0;bottom:0;margin:0!important;max-height:82vh;max-height:82svh;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;border-radius:26px 26px 0 0!important;background:rgba(250,247,242,.97)!important;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);padding:8px 16px calc(24px + env(safe-area-inset-bottom))!important;box-shadow:0 -20px 50px rgba(0,0,0,.18)!important;transform:translateY(105%);transition:transform .38s cubic-bezier(.2,.9,.25,1);visibility:hidden}
 [data-sheet].open{transform:none;visibility:visible}
 .bs-grab{position:sticky;top:-8px;z-index:2;display:flex;justify-content:space-between;align-items:center;margin:0 -16px 8px;padding:10px 16px 8px;background:inherit;font:600 16px Heebo,system-ui}
 .bs-grab:before{content:"";position:absolute;top:6px;left:50%;width:38px;height:5px;margin-left:-19px;border-radius:3px;background:rgba(0,0,0,.18)}
 .bs-grab button{border:0;border-radius:999px;min-height:36px;min-width:64px;padding:0 14px;background:#1B1A18;color:#fff;font:600 14px Heebo}
 .bs-scrim{display:block;position:fixed;inset:0;z-index:9994;background:rgba(20,18,16,.32);opacity:0;pointer-events:none;transition:opacity .3s}.bs-scrim.on{opacity:1;pointer-events:auto}}`;
  H.appendChild(st);
  // כל אלמנט עם data-sheet הופך בגיליון תחתון במובייל, עם כפתור צף לפתיחה
  function sheets() {
    const list = document.querySelectorAll('[data-sheet]'); if (!list.length) return;
    const scrim = document.createElement('div'); scrim.className = 'bs-scrim'; document.body.appendChild(scrim);
    list.forEach((el) => {
      const t = el.dataset.sheet, g = document.createElement('div'); g.className = 'bs-grab'; g.innerHTML = `<span>${t}</span><button type="button">סיום</button>`; el.prepend(g);
      const fab = document.createElement('button'); fab.type = 'button'; fab.className = 'bs-fab'; fab.innerHTML = el.dataset.fab || ('✎ ' + t); document.body.appendChild(fab);
      const open = () => { el.classList.add('open'); scrim.classList.add('on'); fab.style.opacity = 0; bsHaptic(10); };
      const close = () => { el.classList.remove('open'); scrim.classList.remove('on'); fab.style.opacity = ''; el.style.transform = ''; };
      fab.onclick = open; g.querySelector('button').onclick = close; scrim.addEventListener('click', close);
      // החלקה למטה לסגירה
      let y0 = null; g.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; el.style.transition = 'none'; }, { passive: true });
      g.addEventListener('touchmove', (e) => { if (y0 == null) return; const d = Math.max(0, e.touches[0].clientY - y0); el.style.transform = `translateY(${d}px)`; }, { passive: true });
      g.addEventListener('touchend', (e) => { el.style.transition = ''; const d = e.changedTouches[0].clientY - y0; y0 = null; if (d > 80) close(); else el.style.transform = ''; });
    });
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', sheets) : sheets();
})();
