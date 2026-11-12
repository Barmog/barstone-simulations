-- הקטלוג לפי "LUCENTE Catalog - Final Digital Viewing" שבדרייב: 48 דגמים, 13 בסדרת PRO ו-35 בסדרת ULTRA.
-- שמות בעברית ובאנגלית כפי שמופיעים בקטלוג. דגמים שאינם בקטלוג מוסתרים (active=false), לא נמחקים.
alter table public.stones add column if not exists series text;
-- שינויי שם לפי הקטלוג
update public.stones set name = 'טאג׳ מאהל מון' where name = 'טאג מאהל מון' and supplier = 'Barstone';
update public.stones set name = 'טאג׳ מאהל מון לייט' where name = 'טאג מאהל מון לייט' and supplier = 'Barstone';
update public.stones set name = 'ארקטיק בז׳' where name = 'ארקטיק סנד' and supplier = 'Barstone';
update public.stones set name = 'ויולט גלואו' where name = 'גלואו ויולט' and supplier = 'Barstone';
update public.stones set name = 'קלקטה מצ׳יה וצ׳יה' where name = 'קלקטה אלבה' and supplier = 'Barstone';
-- דגמים חדשים מהקטלוג
insert into public.stones (name, supplier, in_stock)
select v.name, 'Barstone', 'unknown' from (values ('ונה מרינה'),('טראצו סביה'),('דזרט סנד'),('ארבל מיראז׳'),('טרוונטין סולה'),('ונילה בז׳'),('אמבר'),('טקטוניק'),('סטון וייל'),('וויילד טימבר')) as v(name)
where not exists (select 1 from public.stones s where s.name = v.name and s.supplier = 'Barstone');
-- כל הדגמים של Barstone מוסתרים, ואז מופעלים רק אלה שבקטלוג
update public.stones set active = false where supplier = 'Barstone';
update public.stones s set active = true, name_en = v.en, series = v.series
from (values
  ('טאג׳ מאהל מון','Taj Mahal Moon','PRO'),('טאג׳ מאהל מון לייט','Taj Mahal Moon Light','PRO'),('ונה מרינה','Vena Marina','PRO'),('טראצו סביה','Terrazzo Sabbia','PRO'),
  ('ארקטיק בלאק','Arctic Black','PRO'),('דזרט סנד','Desert Sand','PRO'),('ליימסטון סיישל','Limestone Seychelles','PRO'),('טרוונטין רוסו','Travertine Rosso','PRO'),
  ('טרוונטין רומא','Travertine Roma','PRO'),('ארבל מיראז׳','Arbel Mirage','PRO'),('טרוונטין סולה','Travertino Sole','PRO'),('גולדן דאסט','Golden Dust','PRO'),('ארקטיק בז׳','Arctic Beige','PRO'),
  ('טאג׳ מאהל','Taj Mahal','ULTRA'),('ווייט מיסט','White Mist','ULTRA'),('בז׳ הרמוני','Beige Harmony','ULTRA'),('מיסטיק אופוריה','Mystic Euphoria','ULTRA'),('מיסטיק הופ','Mystic Hope','ULTRA'),
  ('אנטיקו קלאסיקו','Antico Classico','ULTRA'),('לאסה ביאנקו','Lasa Bianco','ULTRA'),('אייבורי גלואו','Ivory Glow','ULTRA'),('גרין גלואו','Green Glow','ULTRA'),('ויולט גלואו','Violet Glow','ULTRA'),
  ('רויאל אמרלד','Royal Emerald','ULTRA'),('פיאטרה רוק','Pietra Rock','ULTRA'),('לינקולן אורו','Lincoln Oro','ULTRA'),('אייס בלום','Ice Bloom','ULTRA'),('קלקטה מצ׳יה וצ׳יה','Calacatta Macchia Vecchia','ULTRA'),
  ('קלקטה קאמל','Calacatta Camel','ULTRA'),('ונילה לייט','Vanilla Light','ULTRA'),('ונילה בז׳','Vanilla Beige','ULTRA'),('פיור די בוסקו','Fior di Bosco','ULTRA'),('אמבר','Amber','ULTRA'),
  ('טקטוניק','Tectonic','ULTRA'),('סטון וייל','Stonevale','ULTRA'),('סהרה ווייט','Sahara White','ULTRA'),('אייבורי קלאוד','Ivory Cloud','ULTRA'),('סטון בלאק','Stone Black','ULTRA'),
  ('בז׳ קלאוד','Beige Cloud','ULTRA'),('סטון גריי','Stone Grey','ULTRA'),('סטון ווייט','Stone White','ULTRA'),('וויילד טימבר','Wild Timber','ULTRA'),('פטגוניה','Patagonia','ULTRA'),
  ('טרה','Terra','ULTRA'),('טרוונטין לאטה','Travertine Latte','ULTRA'),('ביאנקו טרוונטינו','Bianco Travertino','ULTRA'),('קלאסיק ווייט','Classic White','ULTRA'),('קלאסיק בלאק','Classic Black','ULTRA')
) as v(name, en, series) where s.name = v.name and s.supplier = 'Barstone';
-- תמונות: שתי תמונות חדשות מהדרייב (public/slabs), וארבע תמונות של רשומות ישנות עם אותו דגם בשם הקודם
update public.stones set slab_path = 'site:slabs/terrazzo-sabbia.jpg' where name = 'טראצו סביה' and supplier = 'Barstone';
update public.stones set slab_path = 'site:slabs/arbel-mirage.jpg' where name = 'ארבל מיראז׳' and supplier = 'Barstone';
update public.stones t set slab_path = o.slab_path from (values ('טקטוניק','Geostone White'),('טרוונטין סולה','Travertino Abyad'),('ליימסטון סיישל','Folco Limestone'),('טרוונטין רומא','Travertino Ramadi')) as v(name, old)
join public.stones o on o.name = v.old where t.name = v.name and t.supplier = 'Barstone' and t.slab_path is null;
