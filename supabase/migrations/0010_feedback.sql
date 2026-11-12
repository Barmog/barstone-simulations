-- משובים מהצוות: כפתור "משוב" בכל מסך. כל איש צוות שולח ורואה; המנהל מעדכן סטטוס ותשובה.
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) default auth.uid(),
  email text,
  kind text not null default 'idea' check (kind in ('bug','idea','design','other')),
  text text not null check (char_length(text) between 2 and 4000),
  route text,
  screen text,
  order_id uuid,
  status text not null default 'new' check (status in ('new','doing','done','wontfix')),
  reply text
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
alter table public.feedback enable row level security;
create policy "feedback insert staff" on public.feedback for insert to authenticated with check ((select public.is_staff()) and user_id = auth.uid());
create policy "feedback read staff" on public.feedback for select to authenticated using ((select public.is_staff()));
create policy "feedback update admin" on public.feedback for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
