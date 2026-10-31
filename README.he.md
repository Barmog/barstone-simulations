# Barstone — תוכנת ההדמיות

אפליקציית ווב סטטית להדמיית משטחי שיש במטבח: מידות → בחירת אבן → פריסה/תצוגה → שמירה.

## מבנה
- `public/` — הפרונט (HTML/CSS/JS, ללא build כבד). `public/assets/tiles/` — אריחות מקומיות זמניות.
- `public/js/config.js` — נוצר ע"י `npm run build` ממשתני הסביבה.
- `supabase/migrations/0001_init.sql` — טבלאות `stones`, `simulations`, buckets: `tiles` (ציבורי), `slabs` (ציבורי), `renders` (פרטי).
- `render.yaml` — טיוטת Static Site (לא נפרס).

## הרצה מקומית
`npm run dev` → http://localhost:3000 (עובד גם בלי Supabase — שומר ב-localStorage).

## חיבור Supabase
1. פותחים פרויקט ב-supabase.com (אזור מומלץ: Frankfurt).
2. מריצים את `supabase/migrations/0001_init.sql` ב-SQL Editor.
3. מעתיקים Project URL + anon key ל-`.env` / למשתני הסביבה ב-Render.
4. מעלים תמונות אריח ל-bucket `tiles` ומעדכנים `stones.tile_path`.

## אבטחה
מדיניות ה-RLS הראשונית פתוחה ליצירת הדמיות ע"י anon — יש להדק אחרי הוספת התחברות.
