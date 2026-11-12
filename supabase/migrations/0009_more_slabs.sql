-- תמונות לוח לדגמים מהקטלוג (מתיקיות הדגמים בדרייב, מוקטנות ל-2000 פיקסלים)
update public.stones set slab_path = 'site:slabs/' || v.slug || '.jpg', active = true
from (values (146,'classic-black'),(149,'umbra'),(143,'iron-blaze'),(150,'lava-noir')) as v(id, slug) where stones.id = v.id;
