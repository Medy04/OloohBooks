-- Update sales trigger to respect provided currency if given, else derive from location.
create or replace function public.sales_set_currency_total_xof()
returns trigger
language plpgsql
as $$
begin
  -- If currency provided, keep it. Else set from location.
  if new.currency is null or new.currency = '' then
    if lower(coalesce(new.location, '')) = 'abidjan' then
      new.currency := 'XOF';
    else
      new.currency := 'EUR';
    end if;
  end if;

  -- Convert to XOF (FCFA)
  if new.currency = 'XOF' then
    new.total_xof := new.total;
  else
    new.total_xof := new.total * 655.957; -- EUR to XOF
  end if;

  return new;
end;
$$;
