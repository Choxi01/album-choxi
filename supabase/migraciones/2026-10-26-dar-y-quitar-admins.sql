-- Dar y quitar admins desde el menú Grupo.
-- Solo el dueño del álbum (quien lo creó: albumes.creado_por) puede hacer admin a alguien o sacarle el admin.
-- Además, el dueño queda protegido: ningún otro admin lo puede sacar del álbum, y solo el dueño puede sacar a otro admin.

create or replace function public.es_dueno(a uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.albumes x where x.id = a and x.creado_por = (select auth.uid()));
$$;

create or replace function public.cambiar_rol(p_album uuid, p_user uuid, p_rol text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.es_dueno(p_album) then raise exception 'Solo el dueño del álbum puede cambiar admins'; end if;
  if p_user = (select auth.uid()) then raise exception 'No podés cambiar tu propio rol'; end if;
  if p_rol not in ('admin','miembro') then raise exception 'Rol inválido'; end if;
  update public.miembros set rol = p_rol where album_id = p_album and user_id = p_user;
  if not found then raise exception 'Esa persona no está en el álbum'; end if;
end $$;

-- Sacar gente: un admin saca miembros; a otro admin solo lo saca el dueño; al dueño no lo saca nadie.
drop policy if exists miembros_sacar on public.miembros;
create policy miembros_sacar on public.miembros for delete to authenticated using (
  public.es_admin(album_id)
  and user_id <> (select auth.uid())
  and user_id <> (select a.creado_por from public.albumes a where a.id = album_id)
  and (rol <> 'admin' or public.es_dueno(album_id)));

revoke execute on function public.es_dueno(uuid), public.cambiar_rol(uuid,uuid,text) from public, anon;
grant execute on function public.es_dueno(uuid), public.cambiar_rol(uuid,uuid,text) to authenticated;
