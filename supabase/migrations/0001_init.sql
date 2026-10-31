-- Barstone Simulations — סכמה ראשונית (להריץ ב-SQL Editor של Supabase)
create table if not exists public.stones (
  id bigint generated always as identity primary key,
  name text not null, supplier text, color text,
  tile_path text,            -- נתיב בתוך bucket 'tiles' (אריח שחוזר על עצמו)
  slab_path text,            -- תמונת סלאב מלאה בתוך bucket 'slabs'
  slab_width_cm numeric, slab_height_cm numeric,
  created_at timestamptz default now());
create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  client_name text not null, length_cm numeric not null, depth_cm numeric not null,
  thickness_cm numeric default 2, stone_id bigint references public.stones(id),
  layout jsonb default '{}'::jsonb,    -- פריסת שיש (חלקים, חיתוכים)
  render_path text,                    -- תוצאת רינדור ב-bucket 'renders'
  status text default 'draft', created_by uuid references auth.users(id),
  created_at timestamptz default now());
alter table public.stones enable row level security;
alter table public.simulations enable row level security;
-- קטלוג אבנים: קריאה לכולם, כתיבה רק למשתמשים מחוברים
create policy "stones read" on public.stones for select using (true);
create policy "stones write" on public.stones for all to authenticated using (true) with check (true);
-- הדמיות: בשלב ראשון anon יכול ליצור/לקרוא (להדק אחרי הוספת התחברות!)
create policy "sims read" on public.simulations for select using (true);
create policy "sims insert" on public.simulations for insert with check (true);
create policy "sims update auth" on public.simulations for update to authenticated using (true);
-- Storage buckets
insert into storage.buckets (id, name, public) values ('tiles','tiles',true),('slabs','slabs',true),('renders','renders',false)
  on conflict (id) do nothing;
create policy "public read tiles/slabs" on storage.objects for select using (bucket_id in ('tiles','slabs'));
create policy "auth write assets" on storage.objects for insert to authenticated with check (bucket_id in ('tiles','slabs','renders'));
create policy "auth read renders" on storage.objects for select to authenticated using (bucket_id = 'renders');
-- נתוני דוגמה
insert into public.stones (name, color) values ('שיש לבן קררה','#e9e7e2'),('שחור מרקיניה','#222222'),('טאג׳ מהאל','#d8ccb4');
