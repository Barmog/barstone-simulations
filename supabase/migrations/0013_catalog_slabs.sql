-- תמונות לוח מקטלוג LUCENTE (Bar Stone Catalog), חתוכות לצורת לוח 2:1. כל 48 הדגמים עם תמונה.
update public.stones set slab_path = 'site:slabs/' || v.slug || '.jpg'
from (values (137,'taj-mahal-moon'),(184,'vena-marina'),(177,'vanilla-beige'),(179,'stonevale'),(136,'beige-cloud'),(110,'stone-white'),(182,'desert-sand'),(176,'wild-timber')) as v(id, slug) where stones.id = v.id;
