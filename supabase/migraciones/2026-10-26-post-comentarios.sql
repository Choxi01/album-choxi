-- Álbum Choxi · migración 3: figurita como post (descripción + comentarios)
-- YA APLICADA en Supabase el 2026-10-26.

-- Descripción de la figurita (la escribe quien la subió; un admin también puede corregirla)
alter table public.figuritas add column descripcion text not null default '' check (char_length(descripcion) <= 280);

create or replace function public.editar_descripcion(p_figurita uuid, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.figuritas;
begin
  select * into f from public.figuritas where id = p_figurita;
  if f.id is null or not public.es_miembro(f.album_id) then raise exception 'Figurita no encontrada'; end if;
  if f.subida_por <> (select auth.uid()) and not public.es_admin(f.album_id) then
    raise exception 'Solo quien subió la foto puede cambiar la descripción'; end if;
  if char_length(trim(coalesce(p_texto,''))) > 280 then raise exception 'La descripción puede tener hasta 280 caracteres'; end if;
  update public.figuritas set descripcion = trim(coalesce(p_texto,'')) where id = p_figurita;
end $$;
revoke execute on function public.editar_descripcion(uuid,text) from public, anon;
grant execute on function public.editar_descripcion(uuid,text) to authenticated;

-- Comentarios: los ve y escribe cualquier miembro; borra el autor o un admin. No se editan.
create table public.comentarios (
  id          uuid primary key default gen_random_uuid(),
  album_id    uuid not null references public.albumes(id) on delete cascade,
  figurita_id uuid not null references public.figuritas(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto       text not null check (char_length(trim(texto)) between 1 and 300),
  created_at  timestamptz not null default now()
);
create index comentarios_figurita_idx on public.comentarios(figurita_id, created_at);
create index comentarios_album_idx on public.comentarios(album_id);
alter table public.comentarios enable row level security;

create policy comentarios_ver on public.comentarios for select to authenticated using (public.es_miembro(album_id));
create policy comentarios_ins on public.comentarios for insert to authenticated with check (
  public.es_miembro(album_id) and user_id = (select auth.uid())
  and exists (select 1 from public.figuritas f where f.id = figurita_id and f.album_id = comentarios.album_id));
create policy comentarios_del on public.comentarios for delete to authenticated using (
  user_id = (select auth.uid()) or public.es_admin(album_id));

alter publication supabase_realtime add table public.comentarios;
