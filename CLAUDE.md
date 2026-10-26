# Álbum Choxi

Álbum de figuritas con selfies para un grupo de amigos. Proyecto personal, **separado de los juegos Choxi**: no usar la skill de juegos ni engancharlo a ningún hub. Todo en español rioplatense con voseo (interfaz, commits, respuestas).

`demo-album-choxi.html` es la demo aprobada (un archivo, localStorage): referencia de pantallas, textos, animaciones, reglas y diseño.

## Estructura
- `index.html`, `css/estilos.css` (CSS de la demo + agregados al final).
- `js/` scripts clásicos sin módulos, se comparten por `window.X`, en este orden: `config` → `vendor/supabase` → `reglas` → `api` → `fotos` → `estado` → `vistas` → `arrastre` → `app`.
- `supabase/schema.sql` ya aplicado. Cambios nuevos: `supabase/migraciones/AAAA-MM-DD-descripcion.sql`, **los aplica el usuario**, nunca vos.
- Tests: `node tests/reglas.test.js`. Local: `npx serve -l 3000 .`

## Decisiones
- **Álbum compartido**: un canal realtime por álbum (`postgres_changes`, INSERT/UPDATE filtrados por `album_id`; DELETE sin filtro porque Supabase no los filtra, se ignoran si el id no está). Al volver a la pestaña o reconectar se recarga todo.
- **Pegar, despegar, cambiar destino, abrir sobre, ordenar páginas** van por RPC; `reglas.js` replica la regla de `pegar()` del SQL y las acciones son optimistas (si el RPC falla, se deshace y se muestra el error del servidor).
- **Fotos privadas** en el bucket `fotos` (`<album>/<uuid>.jpg` y `_t.jpg`), mostradas con URLs firmadas de 1 h guardadas en memoria (`Api.firmar`).
- **Sin build**. `vendor/supabase.js` = supabase-js 2.117.3 UMD.
- Borrar una página: las figuritas pegadas ahí vuelven a "Sin pegar" como comodín (`cambiar_destino` a `libre` después de borrar). No se borran fotos.
- Los sobres sin figuritas (todavía subiendo) no se muestran, para que nadie abra uno a medio armar.
- La fecha de la selfie se muestra pero no se edita (no hay permiso de update en `figuritas`).
- Si alguien está en varios álbumes, entra directo al último (`album_choxi_album` en localStorage); "Cambiar de álbum" en Ajustes.
- Service worker solo fuera de localhost. Al cambiar archivos, subir `VERSION` en `sw.js`.

## Diseño
Tema único de noche, tokens en `:root` de `estilos.css` (mesa `#0a0b0f`, hoja `#14151b`, acento `#c9a96e` y tapa `#111217` editables). Botones ≥44 px (los puntitos de página son 32×44), zonas seguras, `prefers-reduced-motion`, confirmaciones dentro de la pantalla (sin `alert`/`confirm`).

## Estado
V1 escrita y probada contra el Supabase real (26/10/2026): crear álbum, sobre con 2 fotos (rotación EXIF ok), abrir, pegar arrastrando, detalle, despegar, editar destino, rechazo del servidor con vuelta atrás, borrar página → comodín, reordenar, nuevo código, apodo, tirar figurita (borra archivos), expulsión. En vivo probado con dos pestañas de la misma cuenta.
Sin probar todavía: unirse con código desde **otra cuenta** (necesita SMTP propio en Supabase), la app instalada en iPhone/Android y el modo sin conexión (el service worker solo corre fuera de localhost).

## Pendientes (fuera de la V1)
- Notificaciones cuando llega un sobre.
- Varios álbumes por temporada ("2027").
- Descargar el álbum como imagen.
- Cola de cambios offline.
- Reacciones o comentarios en figuritas.
- Editar la fecha de la selfie (necesita migración).
