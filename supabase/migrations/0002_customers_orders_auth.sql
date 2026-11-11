-- Barstone — לקוחות, הזמנות והרשאות צוות.
-- גישה לנתונים רק למשתמש מחובר שנמצא בטבלת staff. המשתמש הראשון שנרשם הופך למנהל,
-- ומאותו רגע רק מי שמנהל הזמין (staff_invites) מקבל גישה.

create table if not exists public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null, name text, role text not null default 'sales' check (role in ('admin','sales')),
  created_at timestamptz not null default now());
create table if not exists public.staff_invites (
  email text primary key, role text not null default 'sales' check (role in ('admin','sales')),
  invited_by uuid references auth.users(id), created_at timestamptz not null default now());

create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.staff where user_id = (select auth.uid())) $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as
$$ select exists (select 1 from public.staff where user_id = (select auth.uid()) and role = 'admin') $$;

-- נקרא מיד אחרי התחברות: מחזיר admin / sales / pending
create or replace function public.claim_access() returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); mail text := lower(coalesce(auth.jwt() ->> 'email', '')); r text;
begin
  if uid is null or mail = '' then return 'pending'; end if;
  select role into r from public.staff where user_id = uid;
  if r is not null then return r; end if;
  perform pg_advisory_xact_lock(778201);
  if not exists (select 1 from public.staff) then
    insert into public.staff (user_id, email, role) values (uid, mail, 'admin'); return 'admin';
  end if;
  select role into r from public.staff_invites where lower(email) = mail;
  if r is null then return 'pending'; end if;
  insert into public.staff (user_id, email, role) values (uid, mail, r);
  delete from public.staff_invites where lower(email) = mail;
  return r;
end $$;
revoke all on function public.claim_access() from public, anon;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.claim_access(), public.is_staff(), public.is_admin() to authenticated;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null, phone text, email text, address text, notes text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  title text not null default 'הדמיה', order_no text,
  status text not null default 'draft' check (status in ('draft','review','approved','production','done')),
  stone_id bigint references public.stones(id) on delete set null,
  project jsonb not null default '{}'::jsonb,   -- מודל המטבח האחיד
  metrics jsonb not null default '{}'::jsonb,   -- לוחות, ניצולת, חיבורים — לתצוגה ברשימה
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index if not exists orders_customer_idx on public.orders (customer_id, updated_at desc);
create index if not exists customers_name_idx on public.customers (name);

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as
$$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists customers_touch on public.customers;
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

alter table public.staff enable row level security;
alter table public.staff_invites enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;

create policy "staff read" on public.staff for select to authenticated using ((select public.is_staff()));
create policy "staff admin write" on public.staff for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "invites admin" on public.staff_invites for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "customers staff" on public.customers for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "orders staff" on public.orders for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
