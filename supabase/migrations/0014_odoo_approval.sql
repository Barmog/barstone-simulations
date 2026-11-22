-- חיבור ל-Odoo (חיבור אחד לכל החברה) ואישור אחרי מדידה.
-- פרטי החיבור נקראים רק בצד השרת (פונקציית הקצה odoo); אין להם מדיניות קריאה מהדפדפן.
create table if not exists public.odoo_config (
  id int primary key default 1 check (id = 1),
  url text not null, db text not null, login text not null, api_key text not null,
  updated_at timestamptz not null default now()
);
alter table public.odoo_config enable row level security;

create or replace function public.set_odoo_config(p_url text, p_db text, p_login text, p_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'רק מנהל יכול לחבר את Odoo'; end if;
  if coalesce(trim(p_url), '') = '' then delete from public.odoo_config where id = 1; return; end if;
  if coalesce(trim(p_key), '') = '' then
    update public.odoo_config set url = trim(p_url), db = trim(p_db), login = trim(p_login), updated_at = now() where id = 1;
    if not found then raise exception 'חסר מפתח API'; end if;
  else
    insert into public.odoo_config (id, url, db, login, api_key) values (1, trim(p_url), trim(p_db), trim(p_login), trim(p_key))
    on conflict (id) do update set url = excluded.url, db = excluded.db, login = excluded.login, api_key = excluded.api_key, updated_at = now();
  end if;
end $$;
-- מה שמותר להציג: כתובת, מסד ומשתמש — בלי המפתח
create or replace function public.odoo_info() returns jsonb
language sql security definer stable set search_path = public as $$
  select case when public.is_staff() then (select jsonb_build_object('url', url, 'db', db, 'login', login) from public.odoo_config where id = 1) end $$;
revoke all on function public.set_odoo_config(text, text, text, text) from public, anon;
revoke all on function public.odoo_info() from public, anon;
grant execute on function public.set_odoo_config(text, text, text, text) to authenticated;
grant execute on function public.odoo_info() to authenticated;

alter table public.customers add column if not exists odoo_id int;
alter table public.orders add column if not exists odoo_id int, add column if not exists odoo_name text, add column if not exists odoo_sent_at timestamptz,
  add column if not exists approval jsonb;
create index if not exists orders_odoo_id on public.orders (odoo_id) where odoo_id is not null;
