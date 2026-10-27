# Álbum Choxi

Álbum de figuritas con selfies para un grupo de amigos. Proyecto personal, **separado de los juegos Choxi**: no usar la skill de juegos ni engancharlo a ningún hub. Todo en español rioplatense con voseo (interfaz, commits, respuestas).

`demo-album-choxi.html` es la demo aprobada (un archivo, localStorage): referencia de pantallas, textos, animaciones, reglas y diseño.

## Estructura
- `index.html`, `css/estilos.css` (CSS de la demo + agregados al final).
- `js/` scripts clásicos sin módulos, se comparten por `window.X`, en este orden: `config` → `vendor/supabase` → `reglas` → `formato` → `calculo` → `importar` → `api` → `fotos` → `estado` → `vistas` → `arrastre` → `cuentas` → `pestanas` → `vista-cuentas` → `vista-grupo` → `vista-panel` → `app`.
- Pestañas abajo: Álbum (`vistas.js`) · Cuentas · Grupo · Panel. Las tres últimas se registran en `Pestanas` con `{ html, acciones }` (botones con `data-a`) y se redibujan enteras; si hay un formulario abierto o estás escribiendo, el cambio en vivo espera a que lo cierres.
- `supabase/schema.sql` ya aplicado. Cambios nuevos: `supabase/migraciones/AAAA-MM-DD-descripcion.sql`, **los aplica el usuario**, nunca vos.
- Tests: `node tests/reglas.test.js`, `node tests/calculo.test.js`, `node tests/importar.test.js`. Local: `npx serve -l 3000 .`

## Decisiones
- **Álbum compartido**: un canal realtime por álbum (`postgres_changes`, INSERT/UPDATE filtrados por `album_id`; DELETE sin filtro porque Supabase no los filtra, se ignoran si el id no está). Al volver a la pestaña o reconectar se recarga todo.
- **Pegar, despegar, cambiar destino, abrir sobre, ordenar páginas** van por RPC; `reglas.js` replica la regla de `pegar()` del SQL y las acciones son optimistas (si el RPC falla, se deshace y se muestra el error del servidor).
- **Fotos privadas** en el bucket `fotos` (`<album>/<uuid>.jpg` y `_t.jpg`), mostradas con URLs firmadas de 1 h guardadas en memoria (`Api.firmar`).
- **Sin build**. `vendor/supabase.js` = supabase-js 2.117.3 UMD.
- Borrar una página: las figuritas pegadas ahí vuelven a "Sin pegar" como comodín (`cambiar_destino` a `libre` después de borrar). No se borran fotos.
- Los sobres sin figuritas (todavía subiendo) no se muestran, para que nadie abra uno a medio armar.
- La fecha de la selfie se muestra pero no se edita (no hay permiso de update en `figuritas`).
- **Dueño** = `albumes.creado_por`. Solo él da y quita admins (RPC `cambiar_rol`, migración `2026-10-26-dar-y-quitar-admins.sql`); nadie saca al dueño y a un admin solo lo saca el dueño.
- El código del mail en este proyecto es de 8 dígitos (Email OTP Length); la app acepta hasta 10, por eso los textos no dicen el largo.
- Si alguien está en varios álbumes, entra directo al último (`album_choxi_album` en localStorage); "Cambiar de álbum" en Ajustes.
- Service worker solo fuera de localhost. Al cambiar archivos, subir `VERSION` en `sw.js`.

- **Dueño de la app ≠ dueño del álbum.** `es_dueno()` sin argumentos = dueño de la app (tabla `duenos`, `msaid.rd@gmail.com`): cuenta como miembro y admin de todos los álbumes, ve Panel y "Todos los álbumes" (`Estado.E.duenoApp`). `es_dueno(a)` = creador de ese álbum (`Estado.esDueno()`): da y quita admins.
- **Personas**: cada miembro tiene una (la crea un trigger con su apodo); los invitados son personas sin `user_id` y guardan sus datos de transferencia ahí. Los de un miembro salen de su `perfil`. `calculo.js` trabaja con ids de personas y nombres de columna de la base (`descripcion`, `tipo_alias`).
- **Permisos de cuentas**: todos ven y cargan; edita o borra quien lo cargó (`creado_por`) o un admin. Los botones se ocultan con la misma regla y, si RLS no deja (0 filas), se muestra "No tenés permiso".
- Cambiar un gasto borra los pagos marcados de esa cuenta: lo hace un trigger (`2026-10-26-pagos-al-cambiar-gasto.sql`) porque un miembro no puede borrar pagos de otro.
- **Salida ↔ lugar**: `cuentas.lugar_id`. El detalle del lugar muestra los gastos o "Cargar gastos de esta salida"; la cuenta tiene "Ver en el álbum" (resalta el lugar 3 s).
- Google: `signInWithOAuth` con `redirectTo` = URL de la app; el `?codigo=` se guarda en `sessionStorage` para no perderlo en la vuelta.
- Borrar álbum (Panel): primero las fotos del Storage de a 100, después `panel_borrar_album`.

## Diseño
Tema único de noche, tokens en `:root` de `estilos.css` (mesa `#0a0b0f`, hoja `#14151b`, acento `#c9a96e` y tapa `#111217` editables; debe `#ff6b5e`, cobra `#6fbf8f`; el texto de Saldar va en un ticket de papel claro). Botones ≥44 px (los puntitos de página son 32×44), zonas seguras, `prefers-reduced-motion`, confirmaciones dentro de la pantalla (sin `alert`/`confirm`).

## Estado
V1 escrita y probada contra el Supabase real (26/10/2026): crear álbum, sobre con 2 fotos (rotación EXIF ok), abrir, pegar arrastrando, detalle, despegar, editar destino, rechazo del servidor con vuelta atrás, borrar página → comodín, reordenar, nuevo código, apodo, tirar figurita (borra archivos), expulsión. En vivo probado con dos pestañas de la misma cuenta.
Fase 2 (Cuentas, Grupo, Panel) probada a 390 px contra el Supabase real (26/10/2026), en un álbum de prueba ya borrado: salida enlazada a un lugar con 3 gastos (uno pagado por un invitado), saldar con ✓ Pasó y Deshacer, ticket, Ver en el álbum, errores del servidor tal cual. Segundo usuario simulado por SQL: no puede editar gastos ajenos y sus cambios llegan en vivo (el trigger borra los pagos). Importar: emparejar, cuenta que falla sin cortar el resto, invitado nuevo. Panel: resumen, cambiar rol, sacar de todos, duplicados, borrar álbum con fotos.
Sin probar todavía: **entrar con Google** (falta configurarlo en Google Cloud y Supabase, ver README), unirse con código desde **otra cuenta real** (necesita SMTP propio), la app instalada en iPhone/Android y el modo sin conexión (el service worker solo corre fuera de localhost).

## Pendientes (fuera de la V1)
- Notificaciones cuando llega un sobre.
- Varios álbumes por temporada ("2027").
- Descargar el álbum como imagen.
- Cola de cambios offline.
- Reacciones o comentarios en figuritas.
- Editar la fecha de la selfie (necesita migración).
- Link de solo lectura sin cuenta para una cuenta.
- Notificaciones de "te deben" o "debés".
- Respaldo automático.
