-- בקשות שהעוזר לא ידע לבצע — כדי לדעת אילו יכולות להוסיף למערכת.
create table if not exists public.ai_requests (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) default auth.uid(),
  text text, missing text not null, created_at timestamptz not null default now());
alter table public.ai_requests enable row level security;
create policy "ai_requests insert staff" on public.ai_requests for insert to authenticated with check ((select public.is_staff()));
create policy "ai_requests read admin" on public.ai_requests for select to authenticated using ((select public.is_admin()));
