-- Álbum Choxi · migración 2: Cuentas (gastos repartidos), perfiles, dueño y panel
-- Un "grupo" es un álbum: los mismos miembros comparten álbum y cuentas.

-- ───────────── Dueño (ve y administra todo) ─────────────
create table public.duenos (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.duenos enable row level security;
create policy duenos_ver on public.duenos for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.es_dueno() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.duenos d where d.user_id = (select auth.uid()));
$$;

-- El dueño cuenta como miembro y admin de todos los álbumes.
create or replace function public.es_miembro(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.miembros m where m.album_id = a and m.user_id = (select auth.uid()))
      or exists (select 1 from public.duenos d where d.user_id = (select auth.uid()));
$$;
create or replace function public.es_admin(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.miembros m where m.album_id = a and m.user_id = (select auth.uid()) and m.rol = 'admin')
      or exists (select 1 from public.duenos d where d.user_id = (select auth.uid()));
$$;

-- ───────────── Perfil: datos para que te transfieran ─────────────
create table public.perfiles (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  nombre     text not null default '' check (char_length(nombre) <= 40),
  tipo_alias text not null default '' check (tipo_alias in ('','Cédula','Celular','Email','RUC','Otro')),
  alias      text not null default '' check (char_length(alias) <= 60),
  titular    text not null default '' check (char_length(titular) <= 60),
  cedula     text not null default '' check (char_length(cedula) <= 20),
  banco      text not null default '' check (char_length(banco) <= 40),
  cuenta     text not null default '' check (char_length(cuenta) <= 40),
  updated_at timestamptz not null default now()
);
alter table public.perfiles enable row level security;

create or replace function public.comparte_grupo(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select u = (select auth.uid())
      or exists (select 1 from public.duenos d where d.user_id = (select auth.uid()))
      or exists (select 1 from public.miembros a join public.miembros b on a.album_id = b.album_id
                 where a.user_id = (select auth.uid()) and b.user_id = u);
$$;
create policy perfiles_ver on public.perfiles for select to authenticated using (public.comparte_grupo(user_id));
create policy perfiles_ins on public.perfiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy perfiles_upd on public.perfiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ───────────── Personas de las cuentas (miembros + invitados sin app) ─────────────
create table public.personas (
  id         uuid primary key default gen_random_uuid(),
  album_id   uuid not null references public.albumes(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,   -- null = invitado sin cuenta
  nombre     text not null check (char_length(nombre) between 1 and 40),
  color      text not null default '#9a968c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- datos para transferir (solo invitados; los miembros usan su perfil)
  tipo_alias text not null default '' check (tipo_alias in ('','Cédula','Celular','Email','RUC','Otro')),
  alias      text not null default '' check (char_length(alias) <= 60),
  titular    text not null default '' check (char_length(titular) <= 60),
  cedula     text not null default '' check (char_length(cedula) <= 20),
  banco      text not null default '' check (char_length(banco) <= 40),
  cuenta     text not null default '' check (char_length(cuenta) <= 40),
  creado_por uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (album_id, user_id)
);
create index personas_album_idx on public.personas(album_id);
alter table public.personas enable row level security;
create policy personas_ver on public.personas for select to authenticated using (public.es_miembro(album_id));
create policy personas_ins on public.personas for insert to authenticated with check (public.es_miembro(album_id) and user_id is null);
create policy personas_upd on public.personas for update to authenticated
  using (public.es_admin(album_id) or (user_id is null and creado_por = (select auth.uid())))
  with check (public.es_admin(album_id) or (user_id is null and creado_por = (select auth.uid())));
create policy personas_del on public.personas for delete to authenticated using (public.es_admin(album_id) and user_id is null);

-- Cada miembro tiene su persona en el grupo, con su apodo.
create or replace function public.persona_de_miembro() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.personas (album_id, user_id, nombre, creado_por)
  values (new.album_id, new.user_id, new.apodo, new.user_id)
  on conflict (album_id, user_id) do update set nombre = excluded.nombre;
  return new;
end $$;
create trigger miembros_persona after insert or update of apodo on public.miembros
  for each row execute function public.persona_de_miembro();
insert into public.personas (album_id, user_id, nombre, creado_por)
  select album_id, user_id, apodo, user_id from public.miembros on conflict do nothing;

-- ───────────── Cuentas, gastos y pagos ─────────────
create table public.cuentas (
  id         uuid primary key default gen_random_uuid(),
  album_id   uuid not null references public.albumes(id) on delete cascade,
  tipo       text not null default 'salida' check (tipo in ('rapido','salida')),
  nombre     text not null check (char_length(nombre) between 1 and 60),
  fecha      date not null default current_date,
  miembros   uuid[] not null default '{}',                           -- ids de personas
  lugar_id   uuid references public.lugares(id) on delete set null,  -- salida enlazada a un lugar del álbum
  creado_por uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cuentas_album_idx on public.cuentas(album_id, fecha desc);
create index cuentas_lugar_idx on public.cuentas(lugar_id);

create table public.gastos (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references public.albumes(id) on delete cascade,
  cuenta_id   uuid not null references public.cuentas(id) on delete cascade,
  descripcion text not null check (char_length(descripcion) between 1 and 60),
  monto       bigint not null check (monto > 0),                    -- guaraníes enteros
  pagadores   jsonb not null,                                       -- {persona_id: monto}
  modo        text not null check (modo in ('igual','exacto','partes')),
  entre       jsonb not null,                                       -- {persona_id: valor}
  creado_por  uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index gastos_cuenta_idx on public.gastos(cuenta_id);
create index gastos_album_idx on public.gastos(album_id);

create table public.pagos (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references public.albumes(id) on delete cascade,
  cuenta_id   uuid not null references public.cuentas(id) on delete cascade,
  de          uuid not null references public.personas(id) on delete cascade,
  a           uuid not null references public.personas(id) on delete cascade,
  monto       bigint not null check (monto > 0),
  marcado_por uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now(),
  check (de <> a)
);
create index pagos_cuenta_idx on public.pagos(cuenta_id);

-- Validación en el servidor: montos exactos y personas del mismo grupo.
create or replace function public.validar_gasto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare k text; v jsonb; suma bigint := 0;
begin
  if not exists (select 1 from public.cuentas c where c.id = new.cuenta_id and c.album_id = new.album_id) then
    raise exception 'La cuenta no es de este grupo'; end if;
  if jsonb_typeof(new.pagadores) <> 'object' or new.pagadores = '{}'::jsonb then raise exception 'Falta quién pagó'; end if;
  if jsonb_typeof(new.entre) <> 'object' or new.entre = '{}'::jsonb then raise exception 'Falta entre quiénes se divide'; end if;
  for k, v in select * from jsonb_each(new.pagadores) loop
    if jsonb_typeof(v) <> 'number' or (v::text)::numeric <> floor((v::text)::numeric) or (v::text)::numeric < 0 then raise exception 'Monto inválido'; end if;
    if not exists (select 1 from public.personas p where p.id = k::uuid and p.album_id = new.album_id) then raise exception 'Persona inválida'; end if;
    suma := suma + (v::text)::bigint;
  end loop;
  if suma <> new.monto then raise exception 'Lo pagado suma % y el total es %', suma, new.monto; end if;
  suma := 0;
  for k, v in select * from jsonb_each(new.entre) loop
    if jsonb_typeof(v) <> 'number' or (v::text)::numeric < 0 then raise exception 'Valor inválido'; end if;
    if not exists (select 1 from public.personas p where p.id = k::uuid and p.album_id = new.album_id) then raise exception 'Persona inválida'; end if;
    if new.modo = 'exacto' then suma := suma + (v::text)::bigint; end if;
  end loop;
  if new.modo = 'exacto' and suma <> new.monto then
    raise exception 'Los montos suman % y el total es %. Faltan %', suma, new.monto, new.monto - suma; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger gastos_validar before insert or update on public.gastos for each row execute function public.validar_gasto();

create or replace function public.validar_pago() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.cuentas c where c.id = new.cuenta_id and c.album_id = new.album_id) then raise exception 'La cuenta no es de este grupo'; end if;
  if (select count(*) from public.personas p where p.id in (new.de, new.a) and p.album_id = new.album_id) <> 2 then raise exception 'Persona inválida'; end if;
  return new;
end $$;
create trigger pagos_validar before insert on public.pagos for each row execute function public.validar_pago();

create or replace function public.tocar_cuenta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger cuentas_tocar before update on public.cuentas for each row execute function public.tocar_cuenta();

alter table public.cuentas enable row level security;
alter table public.gastos  enable row level security;
alter table public.pagos   enable row level security;

-- Todos los del grupo ven y cargan; edita/borra quien lo cargó o un admin.
create policy cuentas_ver on public.cuentas for select to authenticated using (public.es_miembro(album_id));
create policy cuentas_ins on public.cuentas for insert to authenticated with check (public.es_miembro(album_id) and creado_por = (select auth.uid()));
create policy cuentas_upd on public.cuentas for update to authenticated
  using (public.es_admin(album_id) or creado_por = (select auth.uid()))
  with check (public.es_admin(album_id) or creado_por = (select auth.uid()));
create policy cuentas_del on public.cuentas for delete to authenticated using (public.es_admin(album_id) or creado_por = (select auth.uid()));

create policy gastos_ver on public.gastos for select to authenticated using (public.es_miembro(album_id));
create policy gastos_ins on public.gastos for insert to authenticated with check (public.es_miembro(album_id) and creado_por = (select auth.uid()));
create policy gastos_upd on public.gastos for update to authenticated
  using (public.es_admin(album_id) or creado_por = (select auth.uid()))
  with check (public.es_admin(album_id) or creado_por = (select auth.uid()));
create policy gastos_del on public.gastos for delete to authenticated using (public.es_admin(album_id) or creado_por = (select auth.uid()));

create policy pagos_ver on public.pagos for select to authenticated using (public.es_miembro(album_id));
create policy pagos_ins on public.pagos for insert to authenticated with check (public.es_miembro(album_id) and marcado_por = (select auth.uid()));
create policy pagos_del on public.pagos for delete to authenticated using (public.es_admin(album_id) or marcado_por = (select auth.uid()));

alter publication supabase_realtime add table public.personas, public.cuentas, public.gastos, public.pagos, public.perfiles;

-- ───────────── Panel del dueño ─────────────
create or replace function public.panel_resumen() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Solo el dueño puede ver el panel'; end if;
  return jsonb_build_object(
    'usuarios',  (select count(*) from auth.users),
    'albumes',   (select count(*) from public.albumes),
    'figuritas', (select count(*) from public.figuritas),
    'gastos',    (select count(*) from public.gastos),
    'base_bytes',  pg_database_size(current_database()),
    'base_limite', 500 * 1024 * 1024,
    'fotos_bytes', coalesce((select sum((metadata->>'size')::bigint) from storage.objects where bucket_id = 'fotos'), 0),
    'fotos_limite', 1024 * 1024 * 1024);
end $$;

create or replace function public.panel_usuarios()
returns table (user_id uuid, email text, nombre text, proveedores text, creado timestamptz, ultimo_ingreso timestamptz, es_dueno boolean, grupos jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Solo el dueño puede ver el panel'; end if;
  return query
  select u.id, u.email::text, coalesce(nullif(p.nombre,''), (select m.apodo from public.miembros m where m.user_id = u.id limit 1), ''),
    coalesce((select string_agg(distinct i.provider, ', ') from auth.identities i where i.user_id = u.id), ''),
    u.created_at, u.last_sign_in_at,
    exists (select 1 from public.duenos d where d.user_id = u.id),
    coalesce((select jsonb_agg(jsonb_build_object('album_id', m.album_id, 'grupo', a.diseno->>'nombre', 'apodo', m.apodo, 'rol', m.rol) order by m.created_at)
              from public.miembros m join public.albumes a on a.id = m.album_id where m.user_id = u.id), '[]'::jsonb)
  from auth.users u left join public.perfiles p on p.user_id = u.id
  order by u.last_sign_in_at desc nulls last;
end $$;

create or replace function public.panel_albumes()
returns table (album_id uuid, grupo text, titulo text, codigo text, creado timestamptz, creador text,
  miembros int, paginas int, lugares int, pegadas int, sin_pegar int, sobres_cerrados int,
  cuentas int, gastos int, total_gastado bigint, fotos int, fotos_bytes bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Solo el dueño puede ver el panel'; end if;
  return query
  select a.id, a.diseno->>'nombre', a.diseno->>'titulo', a.codigo, a.created_at,
    (select u.email::text from auth.users u where u.id = a.creado_por),
    (select count(*)::int from public.miembros m where m.album_id = a.id),
    (select count(*)::int from public.paginas p where p.album_id = a.id),
    (select count(*)::int from public.lugares l where l.album_id = a.id),
    (select count(*)::int from public.figuritas f where f.album_id = a.id and f.lugar_id is not null),
    (select count(*)::int from public.figuritas f join public.sobres s on s.id = f.sobre_id where f.album_id = a.id and f.lugar_id is null and s.abierto_at is not null),
    (select count(*)::int from public.sobres s where s.album_id = a.id and s.abierto_at is null),
    (select count(*)::int from public.cuentas c where c.album_id = a.id),
    (select count(*)::int from public.gastos g where g.album_id = a.id),
    (select coalesce(sum(g.monto),0)::bigint from public.gastos g where g.album_id = a.id),
    (select count(*)::int from storage.objects o where o.bucket_id = 'fotos' and o.name like a.id::text || '/%'),
    (select coalesce(sum((o.metadata->>'size')::bigint),0)::bigint from storage.objects o where o.bucket_id = 'fotos' and o.name like a.id::text || '/%')
  from public.albumes a order by a.created_at;
end $$;

-- Posibles gastos duplicados: mismo grupo, mismo monto, cargados con menos de 2 días de diferencia
-- y con la misma descripción o en la misma cuenta.
create or replace function public.panel_duplicados()
returns table (album_id uuid, grupo text, gasto_a uuid, gasto_b uuid, monto bigint,
  desc_a text, desc_b text, cuenta_a text, cuenta_b text, por_a text, por_b text, fecha_a timestamptz, fecha_b timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Solo el dueño puede ver el panel'; end if;
  return query
  select g1.album_id, al.diseno->>'nombre', g1.id, g2.id, g1.monto, g1.descripcion, g2.descripcion, c1.nombre, c2.nombre,
    coalesce((select m.apodo from public.miembros m where m.user_id = g1.creado_por and m.album_id = g1.album_id), ''),
    coalesce((select m.apodo from public.miembros m where m.user_id = g2.creado_por and m.album_id = g2.album_id), ''),
    g1.created_at, g2.created_at
  from public.gastos g1
  join public.gastos g2 on g2.album_id = g1.album_id and g2.monto = g1.monto and g1.id < g2.id
       and abs(extract(epoch from g1.created_at - g2.created_at)) < 172800
       and (lower(trim(g1.descripcion)) = lower(trim(g2.descripcion)) or g1.cuenta_id = g2.cuenta_id)
  join public.cuentas c1 on c1.id = g1.cuenta_id
  join public.cuentas c2 on c2.id = g2.cuenta_id
  join public.albumes al on al.id = g1.album_id
  order by g2.created_at desc;
end $$;

create or replace function public.panel_cambiar_rol(p_album uuid, p_user uuid, p_rol text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Solo el dueño puede hacer esto'; end if;
  if p_rol not in ('admin','miembro') then raise exception 'Rol inválido'; end if;
  if p_rol = 'miembro' and (select count(*) from public.miembros where album_id = p_album and rol = 'admin' and user_id <> p_user) = 0 then
    raise exception 'El grupo tiene que quedar con al menos un admin'; end if;
  update public.miembros set rol = p_rol where album_id = p_album and user_id = p_user;
end $$;

create or replace function public.panel_sacar(p_album uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Solo el dueño puede hacer esto'; end if;
  delete from public.miembros where album_id = p_album and user_id = p_user;
end $$;

-- Saca a un usuario de todos los grupos (no borra su cuenta de acceso).
create or replace function public.panel_bloquear(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Solo el dueño puede hacer esto'; end if;
  if p_user = (select auth.uid()) then raise exception 'No te podés sacar a vos mismo'; end if;
  delete from public.miembros where user_id = p_user;
end $$;

-- Borra un álbum con todo su contenido (antes, la app borra sus fotos del Storage).
create or replace function public.panel_borrar_album(p_album uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_dueno() then raise exception 'Solo el dueño puede hacer esto'; end if;
  delete from public.albumes where id = p_album;
end $$;

-- Permisos de ejecución
revoke execute on function public.es_dueno(), public.comparte_grupo(uuid), public.panel_resumen(), public.panel_usuarios(),
  public.panel_albumes(), public.panel_duplicados(), public.panel_cambiar_rol(uuid,uuid,text), public.panel_sacar(uuid,uuid),
  public.panel_bloquear(uuid), public.panel_borrar_album(uuid),
  public.persona_de_miembro(), public.validar_gasto(), public.validar_pago(), public.tocar_cuenta() from public, anon;
grant execute on function public.es_dueno(), public.comparte_grupo(uuid), public.panel_resumen(), public.panel_usuarios(),
  public.panel_albumes(), public.panel_duplicados(), public.panel_cambiar_rol(uuid,uuid,text), public.panel_sacar(uuid,uuid),
  public.panel_bloquear(uuid), public.panel_borrar_album(uuid) to authenticated;

-- Dueño inicial
insert into public.duenos (user_id) select id from auth.users where email = 'msaid.rd@gmail.com' on conflict do nothing;

-- Las funciones de trigger no se llaman por la API.
revoke execute on function public.persona_de_miembro(), public.validar_gasto(), public.validar_pago(), public.tocar_cuenta() from authenticated;
