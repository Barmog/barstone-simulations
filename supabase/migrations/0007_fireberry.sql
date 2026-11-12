-- חיבור לפיירברי. כל משתמש שומר את טוקן ה-API האישי שלו, וכך רואה בדיוק את מה שהוא רואה בפיירברי.
-- הטוקן נקרא רק בצד השרת (פונקציית הקצה fireberry); אין לו שום מדיניות קריאה מהדפדפן.
create table if not exists public.fireberry_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);
alter table public.fireberry_tokens enable row level security;

create or replace function public.set_fireberry_token(p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'אין הרשאה'; end if;
  if coalesce(trim(p_token), '') = '' then delete from public.fireberry_tokens where user_id = auth.uid();
  else insert into public.fireberry_tokens (user_id, token) values (auth.uid(), trim(p_token))
       on conflict (user_id) do update set token = excluded.token, updated_at = now();
  end if;
end $$;
create or replace function public.has_fireberry_token() returns boolean
language sql security definer stable set search_path = public as $$ select exists (select 1 from public.fireberry_tokens where user_id = auth.uid()) $$;
revoke all on function public.set_fireberry_token(text) from public, anon;
revoke all on function public.has_fireberry_token() from public, anon;
grant execute on function public.set_fireberry_token(text) to authenticated;
grant execute on function public.has_fireberry_token() to authenticated;

-- הגדרות חיבור משותפות (למשל איזה אובייקט בפיירברי הוא "הזמנה"): הצוות קורא, המנהל כותב
create table if not exists public.app_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
alter table public.app_settings enable row level security;
drop policy if exists "settings read staff" on public.app_settings;
create policy "settings read staff" on public.app_settings for select to authenticated using ((select public.is_staff()));
drop policy if exists "settings write admin" on public.app_settings;
create policy "settings write admin" on public.app_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- הקישור מהלקוח וההזמנה אצלנו לרשומות בפיירברי
alter table public.customers add column if not exists fb_id text;
alter table public.orders add column if not exists fb_object int, add column if not exists fb_id text, add column if not exists fb_sent_at timestamptz;
