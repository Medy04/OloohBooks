-- Sales table with currency handling and XOF conversion
-- Run this in Supabase SQL editor

-- 1) Table
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_price numeric not null check (unit_price >= 0),
  total numeric not null check (total >= 0),
  location text not null,
  payment_method text not null,
  currency text not null default 'XOF',      -- derived from location (Abidjan=XOF, others=EUR)
  total_xof numeric not null default 0,      -- computed in trigger from currency
  created_at timestamp with time zone default now()
);

create index if not exists sales_created_at_idx on public.sales (created_at);
create index if not exists sales_location_idx on public.sales (location);
create index if not exists sales_product_id_idx on public.sales (product_id);

-- 2) Trigger to derive currency and convert to XOF
create or replace function public.sales_set_currency_total_xof()
returns trigger
language plpgsql
as $$
begin
  -- currency from location
  if lower(coalesce(new.location, '')) = 'abidjan' then
    new.currency := 'XOF';
  else
    new.currency := 'EUR';
  end if;

  -- convert to XOF (FCFA)
  if new.currency = 'XOF' then
    new.total_xof := new.total;
  else
    -- EUR to XOF fixed peg (approx)
    new.total_xof := new.total * 655.957;
  end if;

  return new;
end;
$$;

create or replace trigger trg_sales_currency_xof
before insert or update on public.sales
for each row execute function public.sales_set_currency_total_xof();

-- 3) RLS policies
alter table public.sales enable row level security;

drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales for select using (true);

drop policy if exists sales_insert on public.sales;
create policy sales_insert on public.sales for insert with check (true);

drop policy if exists sales_update on public.sales;
create policy sales_update on public.sales for update using (true);

drop policy if exists sales_delete on public.sales;
create policy sales_delete on public.sales for delete using (true);
