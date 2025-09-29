-- Expenses table with currency handling and XOF conversion
-- Run this in Supabase SQL editor

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric not null check (amount >= 0),
  currency text not null default 'XOF',
  amount_xof numeric not null default 0,
  location text not null,
  category text not null,
  created_at timestamp with time zone default now()
);

create index if not exists expenses_created_at_idx on public.expenses (created_at);
create index if not exists expenses_location_idx on public.expenses (location);
create index if not exists expenses_category_idx on public.expenses (category);

-- Trigger to convert to XOF depending on currency
create or replace function public.expenses_set_amount_xof()
returns trigger
language plpgsql
as $$
begin
  if new.currency = 'XOF' then
    new.amount_xof := new.amount;
  else
    new.amount_xof := new.amount * 655.957; -- EUR to XOF
  end if;
  return new;
end;
$$;

create or replace trigger trg_expenses_amount_xof
before insert or update on public.expenses
for each row execute function public.expenses_set_amount_xof();

-- RLS policies
alter table public.expenses enable row level security;

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select using (true);

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert with check (true);

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update using (true);

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete using (true);
