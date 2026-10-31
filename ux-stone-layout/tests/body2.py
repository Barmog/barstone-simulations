def body(logo):
    L=lambda t:f'<em class="lb">{t}</em>'
    def P(id,x,y,w,h,cls='',lbl='',inner='',bx=None,by=None):
        bx=x if bx is None else bx;by=y if by is None else by
        return f'<div class="pc {cls}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background-position:-{bx}px -{by}px">{inner}<span>{id}{lbl}</span></div>'
    sinkcut=lambda x,y:f'<i class="cut sink" style="left:{x}px;top:{y}px;width:95px;height:56px"><b>פתח כיור בנוי 760×450</b></i>'
    cook=lambda x,y:f'<i class="cut" style="left:{x}px;top:{y}px;width:62px;height:40px"><b>פתח כיריים</b></i>'
    slab=(P('A1',*A1,'sel',' משטח · 1420×620',sinkcut(70,10))+P('A2',*A2,'sel2',' משטח · 1420×620',cook(100,14))+P('B',*B,'',' אי · 2400×800')
      +'<div class="vein" style="left:20px;top:72px;width:330px"><em>קו גיד רציף</em></div>'
      +'<div class="ks" style="left:316px;top:92px;height:96px"></div><div class="ks" style="left:324px;top:92px;height:96px"></div><div class="ks" style="left:332px;top:92px;height:96px"></div><div class="ks" style="left:340px;top:92px;height:96px"></div><div class="ks" style="left:348px;top:92px;height:96px"></div><div class="ks" style="left:356px;top:92px;height:96px"></div><div class="ks" style="left:364px;top:92px;height:96px"></div><div class="ks" style="left:372px;top:92px;height:96px"></div><div class="ks" style="left:380px;top:92px;height:96px"></div><div class="kg" style="left:312px;top:88px;width:80px;height:104px"><em>רצועות קנט 40 מ"מ · 6.84 מ\' · 0.27 מ"ר</em></div><div class="clr" style="left:5px;top:5px;width:183px;height:83px"><em>מרווח ניסור 4 מ"מ</em></div>')
    s=lambda id,x,y,w,h:P(id,x,y,w,h,'sk')
    slab2=(P('C',8,8,112,112,'bad',' דופן ימין')+P('D',124,8,112,112,'',' דופן שמאל')+P('E',8,124,355,72,'',' חיפוי קיר · 2840×600')
      +s('S1',244,8,95,56)+s('S2',244,68,95,25)+s('S3',244,96,95,25)+s('S4',343,8,24,56)+s('S5',368,8,24,56)
      +'<div class="grp" style="left:240px;top:4px;width:156px;height:118px"><em>כיור בנוי · 5 חלקים · 0.83 מ"ר</em></div>'
      +'<div class="defect" style="left:366px;top:124px;width:26px;height:72px"><em>אזור פגום</em></div>')
    plan=(P('A1',40,30,177,77,'sel',' משטח',sinkcut(62,12),8,8)+P('A2',217,30,177,77,'sel2',' משטח',cook(70,18),185,8)
      +P('B',70,124,300,100,'',' אי',' ',8,90)+'<div class="vein" style="left:52px;top:96px;width:330px"><em>קו גיד רציף A1→A2→B</em></div>'
      +'<div class="wallt">קיר</div>')
    parts=''.join(f'<div class="part {c}"><span class="tag">{k}</span><span>{n}</span><small>{d}</small></div>' for k,n,d,c in [('A1','משטח מטבח · עם כיור','1420×620','on'),('A2','משטח מטבח · כיריים','1420×620',''),('B','אי','2400×800',''),('C','דופן אי ימין','900×900',''),('D','דופן אי שמאל','900×900',''),('E','חיפוי קיר','2840×600',''),('F','פס מיוחד אנכי','2840×60','')])
    sink='''<div class="sinkcard"><div class="sct">כיור בנוי מאבן <span class="req">חדש</span></div><div class="scs">760×450, עומק 200 מ"מ, מתחת למשטח A1</div>
<div class="sr"><span>S1 תחתית</span><small>760×450</small></div><div class="sr"><span>S2–S3 דופן קדמית/אחורית</span><small>760×200 ×2</small></div><div class="sr"><span>S4–S5 דפנות צד</span><small>450×200 ×2</small></div>
<div class="sum">צריכת אבן: <b>0.83 מ"ר</b> · לוח IB-0413</div></div>'''
    T=lambda i,t:f'<span>{ic(i)}<small>{t}</small></span>'
    return f'''
<header><img class="logo" src="{logo}" alt="Barstone"><nav class="steps"><span class="done">{ic("check",13)} 1 · מידות</span><span class="on">2 · פריסת שיש</span><span>3 · רינדור</span><span>4 · מסמך</span></nav><div class="hact"><span class="saved"><i class="dot"></i>נשמר אוטומטית</span><button class="btn ghost">{ic("dots")} עוד</button></div></header>
<main>
<aside class="panel left">
 <div class="eyebrow">פרויקט לדוגמה · גרסה 1 · סטטוס: <b class="st">● לעיון</b></div><h1>פריסת שיש</h1>
 <div class="sec-t">חומר</div><div class="mat"><div class="sw"></div><div><b>Iceberg Blue</b><small>עובי 20 מ"מ · עיבוד לדר</small><small>לוח ברירת מחדל: 3200×1600</small></div></div>
 <div class="sec-t">חלקים <em>(7 + כיור בנוי)</em></div>{parts}
 {sink}
</aside>
<section class="panel center">
 <div class="ctop"><div class="seg" title="תצוגה"><span class="on">{ic("split",14)} לוח + תוכנית</span><span>{ic("slab",14)} לוח בלבד</span><span>{ic("plan",14)} תוכנית בלבד</span></div>
 <div class="grainctl">{ic("grain",15)}<b>התאמת גידים</b><span class="req">חובה</span><div class="seg sm"><span class="on">רציף</span><span class="off">חופשי</span></div><button class="btn soft">{ic("auto",14)} פריסה אוטומטית</button></div></div>
 <div class="zone"><div class="zh"><b>{ic("slab",15)} הלוחות מהמלאי</b><div class="boards"><span class="on">לוח 1 · IB-0412</span><span>לוח 2 · IB-0413 <i class="dd"></i> פגם</span><span class="add">{ic("box",13)} מחסנית לוחות ▾</span></div></div>
 <div class="row2"><div class="slab">{slab}<div class="cap"><b>לוח 1 · IB-0412</b> · מלאי מפעל · 3200×1600 · ניצולת 77% (כולל קנט)</div></div><div class="mini"><div class="slab">{slab2}<div class="cap">לוח 2 · IB-0413 · ניצולת 81%</div></div></div></div></div>
 <div class="link">{ic("link",14)} <b>קישור לוח ↔ תוכנית:</b> A1 נחתך מ-<b>IB-0412</b>, נקודת התחלה 0,0 מ"מ <span class="gr">{ic("grain",14)} רצף גיד A1 → A2 → B</span></div>
 <div class="zone"><div class="zh"><b>{ic("plan",15)} תוכנית המטבח · מבט על</b><small>כל חלק מוצג עם הטקסטורה שלו מהלוח</small></div>
 <div class="plan"><div class="wall"></div>{plan}<div class="dim" style="left:40px;top:8px;width:354px">אורך משטח 2840</div></div></div>
 <div class="lib"><div class="lt">{ic("box",15)} מחסנית לוחות</div><div class="seg sm lt2"><span class="on">שמורים</span><span>{ic("plus",12)} צילום לוח</span><span>הוספה ידנית</span></div>
<div class="stack"><div class="sc s3"></div><div class="sc s2"></div><div class="sc s1"><div class="sw2"></div><div><b>Iceberg Blue · ג'מבו</b><small>3200×1600 · 20 מ"מ · ברירת מחדל</small></div></div></div>
<div class="li"><span class="sw3"></span><span>Iceberg Blue · סטנדרט</span><small>3050×1440</small></div>
<div class="li"><span class="sw3 ph"></span><span>צולם · לוח 31.10</span><small>3180×1590</small></div>
<div class="lact"><button class="btn soft">📷 צלם לוח</button><button class="btn soft">✎ הוספה ידנית</button></div></div>
 <div class="tools">{T("undo","בטל")}{T("redo","בצע שוב")}<i></i>{T("zout","הקטנה")}<span class="pct">100%</span>{T("zin","הגדלה")}{T("fit","התאמה")}<i></i>{T("defect","סימון פגם")}</div>
 <div class="legend"><b>מקרא:</b><span><i style="background:var(--edge)"></i>קנט (נלקח מהלוח)</span><span><i class="kli"></i>רצועת קנט</span><span><i class="dash2"></i>מרווח ניסור</span><span><i style="background:var(--cut)"></i>חיבור/חיתוך</span><span><i style="background:var(--err)"></i>חריגה</span><span><i class="hatch"></i>אזור פגום</span><span><i style="background:var(--grain)"></i>גיד רציף</span><span><i class="dash"></i>פתח</span><span><i style="background:#8FA9B8"></i>חלקי כיור</span></div>
</section>
<aside class="panel right">
 <div class="sec-t">סיכום פריסה</div><div class="kpi"><div><b>2</b><small>לוחות בשימוש</small></div><div><b>79%</b><small>ניצולת כוללת · כולל קנט</small></div><div><b>3</b><small>חיבורים</small></div><div class="e"><b>1</b><small>חריגות לתיקון</small></div></div>
 <div class="sec-t">כיור בנוי · השפעה</div>
 <div class="kv"><span>כיור 760×450×200</span><b>0.83 מ"ר · 5 חלקים</b></div><div class="kv"><span>פתח במשטח A1</span><b>760×450 · 0.34 מ"ר</b></div><div class="kv"><span>ניצולת לוח 2</span><b>65% ← 81%</b></div>
 <div class="sec-t">קנט · צריכה מהלוח</div>
 <div class="kv"><span>רצועת קנט</span><b>40 מ"מ (4 ס"מ) לכל צד</b></div><div class="kv"><span>מרווח ניסור</span><b>4 מ"מ בין חלקים</b></div><div class="kv"><span>אורך קנט כולל</span><b>6.84 מ' · 0.27 מ"ר</b></div><div class="kv"><span>שטח פנוי בלוח 1</span><b>0.46 ← 0.17 מ"ר</b></div>
 <div class="al ok">{ic("grain",15)}<span><b>גיד:</b> רציף A1 → A2 → B, ודפנות הכיור מאותו לוח</span></div>
 <div class="al er">{ic("x",15)}<span><b>חריגה:</b> חלק C חורג משפת הלוח ב-6 מ"מ · <u>תיקון</u></span></div>
 <div class="al wa">{ic("warn",15)}<span><b>קנט:</b> צריך עוד 0.27 מ"ר. השטח הפנוי בלוח 1 ירד ל-0.17 מ"ר</span></div>
</aside></main>
<footer><button class="btn soft">{ic("back",15)} חזרה למידות</button><span class="hint">כל שינוי נשמר אוטומטית</span><button class="btn pri">המשך לרינדור {ic("arrow",15)}</button></footer>'''
