-- קטלוג בשמות LUCENTE: שם באנגלית, השם הקודם (נובו) ומספר הדגם, ותמונות לוחות מהדרייב.
-- מקורות: "שמות חדשים לדגמי שיש" (המרת שמות), "תמונות דגמי פלטות" (תמונות). slab_path שמתחיל ב-site: הוא קובץ מתוך האתר (public/slabs).
alter table public.stones add column if not exists name_en text;
alter table public.stones add column if not exists novo_name text;
alter table public.stones add column if not exists novo_no int;
alter table public.stones add column if not exists active boolean not null default true;
insert into public.stones (name, supplier, in_stock) select v.name, 'Barstone', 'unknown' from (values ('סופט מיסט'),('גרין גלואו')) as v(name) where not exists (select 1 from public.stones s where s.name = v.name);
update public.stones s set name_en = v.en, novo_name = v.novo, novo_no = v.no, slab_path = coalesce(v.path, s.slab_path)
from (values
  ('טאג׳ מאהל','Taj Mahal','טאג׳ מאהל',101,'site:slabs/taj-mahal.jpg'),
  ('בז׳ הרמוני','Beige Harmony','מקרנה',100,'site:slabs/beige-harmony.jpg'),
  ('גולדן קליי','Golden Clay','הימלאיה',106,'site:slabs/golden-clay.jpg'),
  ('סולרה','Solara','מראצי ווייט',205,'site:slabs/solara.jpg'),
  ('וויילד טרה','Wild Terra','בוסקו',509,'site:slabs/wild-terra.jpg'),
  ('מון אוניקס','Moon Onyx','קלאודי אוניקס',201,'site:slabs/moon-onyx.jpg'),
  ('ונילה לייט','Vanilla Light','אלבסטרו',300,'site:slabs/vanilla-light.jpg'),
  ('סהרה ווייט','Sahara White','ביאנקו נמיביה',301,'site:slabs/sahara-white.jpg'),
  ('אייבורי קלאוד','Ivory Cloud','ארניה סטון אייבורי',302,'site:slabs/ivory-cloud.jpg'),
  ('קלקטה אלבה','Calacatta Alba','מאצ׳יה וצ׳יה',303,'site:slabs/calacatta-alba.jpg'),
  ('קלאוד וויין','Cloud Vein','סטטוריו לייט',304,'site:slabs/cloud-vein.jpg'),
  ('קלקטה קאמל','Calacatta Camel','קלקטה אורו',307,'site:slabs/calacatta-camel.jpg'),
  ('לאטה ביאנקו','Lasa Bianco','לאסה ווייט',311,'site:slabs/lasa-bianco.jpg'),
  ('ביאנקו טרוונטינו','Bianco Travertino','טרוונטין לבן',312,'site:slabs/bianco-travertino.jpg'),
  ('ולורה','Velora','מראקי',314,'site:slabs/velora.jpg'),
  ('לינקולן אורו','Lincoln Oro','לינקולן דוראטו',316,'site:slabs/lincoln-oro.jpg'),
  ('גולדן דאסט','Golden Dust','נגב',317,'site:slabs/golden-dust.jpg'),
  ('קלאסיק ווייט','Classic White','טינטה יוניטה ביאנקו',320,'site:slabs/classic-white.jpg'),
  ('סטורם וויין','Storm Vein','בורגאטו',321,'site:slabs/storm-vein.jpg'),
  ('רויאל בלאק','Royal Black','נרו מרקווינה',402,'site:slabs/royal-black.jpg'),
  ('קרבון רוק','Carbon Rock','בזלטינה נרה',404,'site:slabs/carbon-rock.jpg'),
  ('פיאטרה רוק','Pietra Rock','פיאטרה גריג׳יה',505,'site:slabs/pietra-rock.jpg'),
  ('סטון בלאק','Stone Black','בולוורד בלאק',406,'site:slabs/stone-black.jpg'),
  ('טראצו גריי','Terrazzo Grey','צ׳פו די גריי',500,'site:slabs/terrazzo-grey.jpg'),
  ('פיור די בוסקו','Fior di Bosco','פיור די בוסקו',501,'site:slabs/fior-di-bosco.jpg'),
  ('פיאטרה טרה','Pietra Terra','פיאטרה בראון',503,'site:slabs/pietra-terra.jpg'),
  ('שאדו סטון','Shadow Stone','סהרה גריי',504,'site:slabs/shadow-stone.jpg'),
  ('סטון גריי','Stone Grey','בולוורד גריי',506,'site:slabs/stone-grey.jpg'),
  ('סילביה','Silvara','פררו סילבר',508,'site:slabs/silvara.jpg'),
  ('פיאטרה סטלה','Pietra Stella','לייט פיאטרה גריי',502,'site:slabs/pietra-stella.jpg'),
  ('פורט','Port','פורטורו',400,'site:slabs/port.jpg'),
  ('טרה','Terra','מדרה',608,'site:slabs/terra.jpg'),
  ('פטגוניה','Patagonia','פטגוניה ביאנקו',603,'site:slabs/patagonia.jpg'),
  ('אושן','Ocean','ווייב',612,'site:slabs/ocean.jpg'),
  ('רויאל אמרלד','Royal Emerald','גרין מג׳סטיק',600,'site:slabs/royal-emerald.jpg'),
  ('פטגוניה קריסטל','Patagonia Crystal','פטגוניה סטון',611,'site:slabs/patagonia-crystal.jpg'),
  ('אנטיקו קלאסיקו','Antico Classico','מרמו אנטיקו',602,'site:slabs/antico-classico.jpg'),
  ('פריים סטון','Prime Stone','פרשס סטון',601,'site:slabs/prime-stone.jpg'),
  ('אייבורי גלואו','Glow Ivory','גלאם אייבורי',604,'site:slabs/glow-ivory.jpg'),
  ('גלואו ויולט','Glow Violet','גלאם ויולט',605,'site:slabs/glow-violet.jpg'),
  ('מיסטיק הופ','Mystic Hope','אמושן הופ',606,'site:slabs/mystic-hope.jpg'),
  ('מיסטיק אופוריה','Mystic Euphoria','אמושן אופוריה',607,'site:slabs/mystic-euphoria.jpg'),
  ('סופט מיסט','Soft Mist','אוניקס דב',103,'site:slabs/soft-mist.jpg'),
  ('גרין גלואו','Glow Green','גלאם גרין',610,'site:slabs/glow-green.jpg'),
  ('טרוונטין לאטה','Travertine Latte','טרוונטין נבונה',107,'barstone/navona.jpg'),
  ('קריסטל סנואו','Crystal Snow','קריסטל לוקס',108,'barstone/crystal-lux.jpg'),
  ('ווייט מיסט','White Mist','אוניקס ביאנקו',109,'barstone/onyx-bianco.jpg'),
  ('גולדן סנד','Golden Sand','סיאנה סנד',110,'barstone/siena-sand.jpg'),
  ('נובה פריים','Nova Prime','טרה נובה',203,'barstone/terra-nova.jpg'),
  ('איים בלום','Ice Bloom','אייבורי אייס',204,'barstone/ivory-ice.jpg'),
  ('ארקטיק בלאק','Arctic Black','פולאר בלאק',510,'barstone/polar-black.jpg'),
  ('נורדיק אייס','Nordic Ice','אייס ביאנקו',102,null),
  ('סמנטו ווייט','Cemento Bianco','סמנט ווייט',104,null),
  ('סטון ווייט','Stone White','בולוורד ווייט',105,null),
  ('קלקטה בלוסום','Calacatta Blossom',null,null,null),
  ('ליימסטון סיישל','Limestone Seychelles',null,329,null),
  ('בז׳ קלאוד','Beige Cloud',null,null,null),
  ('טאג מאהל מון','Taj Mahal Moon',null,330,null),
  ('טאג מאהל מון לייט','Taj Mahal Moon Light',null,331,null),
  ('ארקטיק סנד','Arctic Sand','פולאר בז׳',326,null),
  ('טרוונטין דזרט','Travertine Desert',null,325,null),
  ('סמנטו','Cemento',null,327,null),
  ('טרוונטין רומא','Travertine Roma',null,328,null),
  ('איירון בלייז','Iron Blaze',null,null,null),
  ('קלאסיק בלאק','Classic Black','טינטה יוניטה נרו',405,null),
  ('אומברה','Umbra','קריסטלו אומברה',null,null),
  ('לבה נואר','Lava Noir',null,null,null),
  ('נרו לוקס','Nero Lux','אוניקס נרו',409,null),
  ('טרוונטין רוסו','Travertine Rosso',null,613,null)
) as v(name, en, novo, no, path) where s.name = v.name and s.supplier = 'Barstone';
-- תיקוני כתיב לפי שמות LUCENTE
update public.stones set name = 'אייס בלום' where name = 'איים בלום';
update public.stones set name = 'לאסה ביאנקו' where name = 'לאטה ביאנקו';
update public.stones set name = 'סילברה' where name = 'סילביה';
-- הרשומות הישנות (שמות נובו ואריחים כלליים) מוסתרות, לא נמחקות
update public.stones set active = false where name_en is null;
