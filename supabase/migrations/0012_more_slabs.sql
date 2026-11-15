-- תמונות לוח מתיקיות הדגמים בדרייב (קיים במלאי / new collections), מוקטנות ל-2000 פיקסלים
update public.stones set slab_path = 'site:slabs/' || v.slug || '.jpg'
from (values (139,'arctic-beige'),(164,'travertine-rosso'),(138,'taj-mahal-moon-light'),(181,'amber')) as v(id, slug) where stones.id = v.id;
