-- Si se agrega, edita o quita un gasto, los saldos cambian: se borran las transferencias marcadas de esa cuenta.
-- Lo hace el servidor porque un miembro no tiene permiso para borrar pagos que marcó otro.

create or replace function public.borrar_pagos_de_cuenta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.pagos where cuenta_id = coalesce(new.cuenta_id, old.cuenta_id);
  if tg_op = 'UPDATE' and new.cuenta_id <> old.cuenta_id then
    delete from public.pagos where cuenta_id = old.cuenta_id;
  end if;
  return null;
end $$;

create trigger gastos_borrar_pagos after insert or update or delete on public.gastos
  for each row execute function public.borrar_pagos_de_cuenta();

revoke execute on function public.borrar_pagos_de_cuenta() from public, anon, authenticated;
