-- Álbum Choxi · esquema de base de datos (Supabase / Postgres)
-- Un álbum compartido por grupo. Todos los miembros cargan fotos, abren sobres y pegan.
-- El modo diseño (tapa, páginas, lugares, colores) es solo para admins.
-- Las escrituras sensibles pasan por funciones (RPC) que validan en el servidor.

-- ───────────────────────── Tablas ─────────────────────────

create table public.albumes (
  id          uuid primary key default gen_random_uuid(),
  diseno      jsonb not null default '{}'::jsonb,   -- edicion, titulo, nombre, lema, mono, acento, tapa
  codigo      text not null unique default encode(extensions.gen_random_bytes(5), 'hex'), -- para invitar
  creado_por  uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now()
);

create table public.miembros (
  album_id   uuid not null references public.albumes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  apodo      text not null check (char_length(apodo) between 1 and 30),
  rol        text not null default 'miembro' check (rol in ('admin','miembro')),
  created_at timestamptz not null default now(),
  primary key (album_id, user_id)
);
create index miembros_user_idx on public.miembros(user_id);

create table public.paginas (
  id         uuid primary key default gen_random_uuid(),
  album_id   uuid not null references public.albumes(id) on delete cascade,
  orden      int  not null,
  titulo     text not null default 'Nueva sección' check (char_length(titulo) <= 40),
  bajada     text not null default '' check (char_length(bajada) <= 60),
  color      text not null default '#7e3139' check (color ~ '^#[0-9a-fA-F]{6}$'),
  brillante  boolean not null default false,
  created_at timestamptz not null default now()
);
create index paginas_album_idx on public.paginas(album_id, orden);

create table public.lugares (
  id        uuid primary key default gen_random_uuid(),
  album_id  uuid not null references public.albumes(id) on delete cascade,
  pagina_id uuid not null references public.paginas(id) on delete cascade,
  orden     int  not null,
  nombre    text not null default '' check (char_length(nombre) <= 40),
  detalle   text not null default '' check (char_length(detalle) <= 40)
);
create index lugares_pagina_idx on public.lugares(pagina_id, orden);
create index lugares_album_idx on public.lugares(album_id);

create table public.sobres (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references public.albumes(id) on delete cascade,
  creado_por  uuid not null default auth.uid() references auth.users(id),
  created_at  timestamptz not null default now(),
  abierto_por uuid references auth.users(id),
  abierto_at  timestamptz
);
create index sobres_album_idx on public.sobres(album_id);

create table public.figuritas (
  id           uuid primary key default gen_random_uuid(),
  album_id     uuid not null references public.albumes(id) on delete cascade,
  sobre_id     uuid not null references public.sobres(id) on delete cascade,
  foto_path    text not null,                      -- ruta en el bucket "fotos": <album_id>/<archivo>.jpg
  fecha_foto   date,
  destino_tipo text not null default 'libre' check (destino_tipo in ('libre','pagina','lugar')),
  destino_id   uuid,                               -- pagina_id o lugar_id según destino_tipo
  subida_por   uuid not null default auth.uid() references auth.users(id),
  lugar_id     uuid unique references public.lugares(id) on delete set null, -- dónde está pegada (null = sin pegar)
  pegada_por   uuid references auth.users(id),
  pegada_at    timestamptz,
  created_at   timestamptz not null default now(),
  check (destino_tipo = 'libre' or destino_id is not null)
);
create index figuritas_album_idx on public.figuritas(album_id);
create index figuritas_sobre_idx on public.figuritas(sobre_id);

-- ───────────────────────── Ayudantes de permisos ─────────────────────────

create or replace function public.es_miembro(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.miembros m where m.album_id = a and m.user_id = (select auth.uid()));
$$;

create or replace function public.es_admin(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.miembros m where m.album_id = a and m.user_id = (select auth.uid()) and m.rol = 'admin');
$$;

-- ───────────────────────── RLS ─────────────────────────

alter table public.albumes   enable row level security;
alter table public.miembros  enable row level security;
alter table public.paginas   enable row level security;
alter table public.lugares   enable row level security;
alter table public.sobres    enable row level security;
alter table public.figuritas enable row level security;

-- Álbum: lo ven los miembros; solo admin cambia el diseño. Se crea con crear_album().
create policy albumes_ver    on public.albumes for select to authenticated using (public.es_miembro(id));
create policy albumes_editar on public.albumes for update to authenticated using (public.es_admin(id)) with check (public.es_admin(id));

-- Miembros: se ven entre ellos; el admin puede sacar gente. Entrar es con unirse(); el apodo se cambia con cambiar_apodo().
create policy miembros_ver   on public.miembros for select to authenticated using (public.es_miembro(album_id));
create policy miembros_sacar on public.miembros for delete to authenticated using (public.es_admin(album_id) and user_id <> (select auth.uid()));

-- Páginas y lugares: los ven todos los miembros; los edita solo admin (modo diseño).
create policy paginas_ver on public.paginas for select to authenticated using (public.es_miembro(album_id));
create policy paginas_ins on public.paginas for insert to authenticated with check (public.es_admin(album_id));
create policy paginas_upd on public.paginas for update to authenticated using (public.es_admin(album_id)) with check (public.es_admin(album_id));
create policy paginas_del on public.paginas for delete to authenticated using (public.es_admin(album_id));

create policy lugares_ver on public.lugares for select to authenticated using (public.es_miembro(album_id));
create policy lugares_ins on public.lugares for insert to authenticated with check (
  public.es_admin(album_id) and exists (select 1 from public.paginas p where p.id = pagina_id and p.album_id = lugares.album_id));
create policy lugares_upd on public.lugares for update to authenticated using (public.es_admin(album_id)) with check (
  public.es_admin(album_id) and exists (select 1 from public.paginas p where p.id = pagina_id and p.album_id = lugares.album_id));
create policy lugares_del on public.lugares for delete to authenticated using (public.es_admin(album_id));

-- Sobres: cualquier miembro arma uno; se abre con abrir_sobre(); lo borra quien lo armó (si no se abrió) o un admin.
create policy sobres_ver on public.sobres for select to authenticated using (public.es_miembro(album_id));
create policy sobres_ins on public.sobres for insert to authenticated with check (
  public.es_miembro(album_id) and creado_por = (select auth.uid()) and abierto_at is null and abierto_por is null);
create policy sobres_del on public.sobres for delete to authenticated using (
  public.es_admin(album_id) or (creado_por = (select auth.uid()) and abierto_at is null));

-- Figuritas: se cargan dentro de un sobre propio y sin abrir; pegar/despegar/cambiar destino van por RPC.
create policy figuritas_ver on public.figuritas for select to authenticated using (public.es_miembro(album_id));
create policy figuritas_ins on public.figuritas for insert to authenticated with check (
  public.es_miembro(album_id)
  and subida_por = (select auth.uid())
  and lugar_id is null and pegada_por is null
  and foto_path like album_id::text || '/%'
  and exists (select 1 from public.sobres s where s.id = sobre_id and s.album_id = figuritas.album_id
              and s.creado_por = (select auth.uid()) and s.abierto_at is null));
create policy figuritas_del on public.figuritas for delete to authenticated using (
  public.es_admin(album_id) or subida_por = (select auth.uid()));

-- ───────────────────────── Funciones (RPC) ─────────────────────────

-- Crea un álbum, deja a quien lo crea como admin y siembra 3 páginas (1 de ejemplo + 2 vacías) de 6 lugares.
create or replace function public.crear_album(p_apodo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a uuid; p uuid; i int; ej text[][] := array[
  ['Costanera','Asunción'],['Palacio de López','Centro'],['Mercado 4','Asunción'],
  ['Loma San Jerónimo','Barrio histórico'],['Paseo Carmelitas','Villa Morra'],['Bar de siempre','Nuestro lugar']];
begin
  if (select auth.uid()) is null then raise exception 'Tenés que iniciar sesión'; end if;
  insert into public.albumes (creado_por, diseno) values ((select auth.uid()), jsonb_build_object(
    'edicion','Edición 2026 · Colección oficial','titulo','Álbum de los Lugares','nombre','Los de Siempre',
    'lema','Una selfie por lugar. Llenalo entre todos.','mono','','acento','#c9a96e','tapa','#111217'))
  returning id into a;
  insert into public.miembros (album_id, user_id, apodo, rol) values (a, (select auth.uid()), left(trim(p_apodo),30), 'admin');
  insert into public.paginas (album_id, orden, titulo, bajada, color) values (a, 1, 'Asunción', 'La ciudad de noche', '#7e3139') returning id into p;
  for i in 1..6 loop
    insert into public.lugares (album_id, pagina_id, orden, nombre, detalle) values (a, p, i, ej[i][1], ej[i][2]);
  end loop;
  insert into public.paginas (album_id, orden, titulo, bajada, color) values (a, 2, 'Sección 2', 'Por definir', '#2f5c4d') returning id into p;
  for i in 1..6 loop insert into public.lugares (album_id, pagina_id, orden) values (a, p, i); end loop;
  insert into public.paginas (album_id, orden, titulo, bajada, color) values (a, 3, 'Sección 3', 'Por definir', '#33497a') returning id into p;
  for i in 1..6 loop insert into public.lugares (album_id, pagina_id, orden) values (a, p, i); end loop;
  return a;
end $$;

-- Entrar a un álbum con el código de invitación.
create or replace function public.unirse(p_codigo text, p_apodo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a uuid;
begin
  if (select auth.uid()) is null then raise exception 'Tenés que iniciar sesión'; end if;
  select id into a from public.albumes where codigo = lower(trim(p_codigo));
  if a is null then raise exception 'Ese código no existe'; end if;
  insert into public.miembros (album_id, user_id, apodo) values (a, (select auth.uid()), left(trim(p_apodo),30))
  on conflict (album_id, user_id) do update set apodo = excluded.apodo;
  return a;
end $$;

create or replace function public.cambiar_apodo(p_album uuid, p_apodo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.miembros set apodo = left(trim(p_apodo),30)
  where album_id = p_album and user_id = (select auth.uid());
end $$;

-- Admin: genera un código de invitación nuevo (invalida el anterior).
create or replace function public.nuevo_codigo(p_album uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not public.es_admin(p_album) then raise exception 'Solo el admin puede hacer esto'; end if;
  c := encode(extensions.gen_random_bytes(5), 'hex');
  update public.albumes set codigo = c where id = p_album;
  return c;
end $$;

-- Abrir un sobre: lo abre una sola vez cualquier miembro.
create or replace function public.abrir_sobre(p_sobre uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.sobres;
begin
  select * into s from public.sobres where id = p_sobre for update;
  if s.id is null or not public.es_miembro(s.album_id) then raise exception 'Sobre no encontrado'; end if;
  if s.abierto_at is not null then return; end if;
  update public.sobres set abierto_por = (select auth.uid()), abierto_at = now() where id = p_sobre;
end $$;

-- ¿Le quedan lugares libres a una página?
create or replace function public.pagina_con_lugar(p_pagina uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lugares l where l.pagina_id = p_pagina
                 and not exists (select 1 from public.figuritas f where f.lugar_id = l.id));
$$;

-- Pegar una figurita. Misma regla que la demo:
--  · lugar fijo libre → solo ahí; si ya lo ocuparon → cualquier lugar libre de esa página; si la página está llena o no existe → comodín.
--  · página → cualquier lugar libre de esa página; si está llena o no existe → comodín.
--  · comodín → cualquier lugar libre.
create or replace function public.pegar(p_figurita uuid, p_lugar uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.figuritas; l public.lugares; d public.lugares;
begin
  select * into f from public.figuritas where id = p_figurita for update;
  if f.id is null or not public.es_miembro(f.album_id) then raise exception 'Figurita no encontrada'; end if;
  if f.lugar_id is not null then raise exception 'Esa figurita ya está pegada'; end if;
  if not exists (select 1 from public.sobres s where s.id = f.sobre_id and s.abierto_at is not null) then
    raise exception 'Primero hay que abrir el sobre'; end if;
  select * into l from public.lugares where id = p_lugar and album_id = f.album_id;
  if l.id is null then raise exception 'Ese lugar no existe'; end if;
  if exists (select 1 from public.figuritas x where x.lugar_id = p_lugar) then raise exception 'Ese lugar ya tiene figurita'; end if;

  if f.destino_tipo = 'lugar' then
    select * into d from public.lugares where id = f.destino_id;
    if d.id is not null then
      if not exists (select 1 from public.figuritas x where x.lugar_id = d.id) then
        if p_lugar <> d.id then raise exception 'Esta figurita va en otro lugar'; end if;
      elsif public.pagina_con_lugar(d.pagina_id) and l.pagina_id <> d.pagina_id then
        raise exception 'Esta figurita va en otra página';
      end if;
    end if;
  elsif f.destino_tipo = 'pagina' then
    if exists (select 1 from public.paginas p where p.id = f.destino_id)
       and public.pagina_con_lugar(f.destino_id) and l.pagina_id <> f.destino_id then
      raise exception 'Esta figurita va en otra página';
    end if;
  end if;

  update public.figuritas set lugar_id = p_lugar, pegada_por = (select auth.uid()), pegada_at = now() where id = p_figurita;
end $$;

-- Despegar: vuelve a "sin pegar" apuntando al lugar donde estaba.
create or replace function public.despegar(p_figurita uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.figuritas;
begin
  select * into f from public.figuritas where id = p_figurita for update;
  if f.id is null or not public.es_miembro(f.album_id) then raise exception 'Figurita no encontrada'; end if;
  if f.lugar_id is null then return; end if;
  update public.figuritas set destino_tipo = 'lugar', destino_id = f.lugar_id,
    lugar_id = null, pegada_por = null, pegada_at = null where id = p_figurita;
end $$;

-- Cambiar adónde va una figurita que todavía no se pegó.
create or replace function public.cambiar_destino(p_figurita uuid, p_tipo text, p_destino uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.figuritas;
begin
  select * into f from public.figuritas where id = p_figurita for update;
  if f.id is null or not public.es_miembro(f.album_id) then raise exception 'Figurita no encontrada'; end if;
  if f.lugar_id is not null then raise exception 'Primero despegala'; end if;
  if p_tipo = 'libre' then p_destino := null;
  elsif p_tipo = 'pagina' then
    if not exists (select 1 from public.paginas where id = p_destino and album_id = f.album_id) then raise exception 'Página inválida'; end if;
  elsif p_tipo = 'lugar' then
    if not exists (select 1 from public.lugares where id = p_destino and album_id = f.album_id) then raise exception 'Lugar inválido'; end if;
  else raise exception 'Destino inválido'; end if;
  update public.figuritas set destino_tipo = p_tipo, destino_id = p_destino where id = p_figurita;
end $$;

-- Admin: reordenar páginas en una sola llamada (lista de ids en el orden nuevo).
create or replace function public.ordenar_paginas(p_album uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare i int;
begin
  if not public.es_admin(p_album) then raise exception 'Solo el admin puede hacer esto'; end if;
  for i in 1..coalesce(array_length(p_ids,1),0) loop
    update public.paginas set orden = i where id = p_ids[i] and album_id = p_album;
  end loop;
end $$;

-- Permisos de ejecución: solo usuarios logueados.
revoke execute on function public.crear_album(text), public.unirse(text,text), public.cambiar_apodo(uuid,text),
  public.nuevo_codigo(uuid), public.abrir_sobre(uuid), public.pegar(uuid,uuid), public.despegar(uuid),
  public.cambiar_destino(uuid,text,uuid), public.ordenar_paginas(uuid,uuid[]),
  public.es_miembro(uuid), public.es_admin(uuid), public.pagina_con_lugar(uuid) from public, anon;
grant execute on function public.crear_album(text), public.unirse(text,text), public.cambiar_apodo(uuid,text),
  public.nuevo_codigo(uuid), public.abrir_sobre(uuid), public.pegar(uuid,uuid), public.despegar(uuid),
  public.cambiar_destino(uuid,text,uuid), public.ordenar_paginas(uuid,uuid[]),
  public.es_miembro(uuid), public.es_admin(uuid), public.pagina_con_lugar(uuid) to authenticated;

-- ───────────────────────── Fotos (Storage) ─────────────────────────
-- Bucket privado. Ruta: <album_id>/<uuid>.jpg. Se leen con URLs firmadas.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 3145728, array['image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.es_miembro(((storage.foldername(name))[1])::uuid));
create policy fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and public.es_miembro(((storage.foldername(name))[1])::uuid));
create policy fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (owner_id = (select auth.uid())::text or public.es_admin(((storage.foldername(name))[1])::uuid)));

-- ───────────────────────── Tiempo real ─────────────────────────

alter publication supabase_realtime add table public.albumes, public.miembros, public.paginas, public.lugares, public.sobres, public.figuritas;
