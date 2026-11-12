-- קישור ללקוח: צפייה בהדמיה, בחירת מיקום הגיד על הלוח, ואישור עם חתימה דיגיטלית.
-- הלקוח לא מחובר: הגישה רק דרך פונקציית הקצה portal (service role) עם הטוקן שבקישור.
create table if not exists public.order_shares (
  token uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '45 days',
  viewed_at timestamptz,
  signed_at timestamptz,
  signer_name text,
  signature text,          -- PNG data URL של החתימה
  customer_note text,
  layout jsonb,            -- הסידור על הלוחות שהלקוח אישר (project.manual)
  layout_changed boolean not null default false
);
create index if not exists order_shares_order_idx on public.order_shares (order_id, created_at desc);
alter table public.order_shares enable row level security;
drop policy if exists "shares staff" on public.order_shares;
create policy "shares staff" on public.order_shares for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
