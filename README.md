# Álbum Choxi

Un álbum de figuritas estilo mundial, pero con selfies. Cada lugar al que va el grupo es un hueco del álbum y se llena con la selfie que se sacaron ahí. El álbum es **compartido**: todos ven lo mismo y los cambios llegan en vivo.

- App estática (HTML + CSS + JS, sin build) publicada en GitHub Pages: <https://choxi01.github.io/album-choxi/>
- Backend: Supabase (base de datos, ingreso por mail, fotos y tiempo real).
- Se puede instalar en el celu como app (PWA).

## Abrirla en tu compu

```bash
npx serve -l 3000 .
```

Después entrá a <http://localhost:3000>. Usa el Supabase real, así que todo lo que hagas queda guardado de verdad.

> En `localhost` el service worker no se registra a propósito, para que siempre veas los archivos nuevos.

## Tests

```bash
node tests/reglas.test.js
```

Prueban las reglas puras (`js/reglas.js`): numeración, adónde puede ir cada figurita y las etiquetas. Tienen que dar lo mismo que la función `pegar` del SQL.

## Publicar en GitHub Pages

1. Creá el repo vacío `album-choxi` en GitHub con el usuario `Choxi01` (sin README).
2. Desde esta carpeta:

   ```bash
   git remote add origin https://github.com/Choxi01/album-choxi.git
   ```

   ```bash
   git push -u origin main
   ```

3. En GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, rama `main`, carpeta `/ (root)` → **Save**.
4. En un par de minutos queda en <https://choxi01.github.io/album-choxi/>.

**Cada vez que cambies un archivo de la app**, subí la `VERSION` en `sw.js` (por ejemplo `album-choxi-v2`). Si no, los celus que ya la tienen instalada siguen viendo la versión vieja.

## Pasos que tenés que hacer en el panel de Supabase

1. **Authentication → URL Configuration**
   - Site URL: `https://choxi01.github.io/album-choxi/`
   - Redirect URLs: esa misma y `http://localhost:3000/**`
2. **Authentication → Emails → SMTP Settings**: activá un SMTP propio. Sin eso, Supabase solo manda mails a los miembros del equipo del proyecto (y unos 2 por hora), y tus amigos no podrían entrar. Lo simple es Gmail:
   - Host `smtp.gmail.com`, puerto `587`.
   - Usuario: tu mail.
   - Contraseña: una **contraseña de aplicación** de Google (necesita la verificación en 2 pasos activada).
   - Remitente: "Álbum Choxi".
   - Después, en **Rate Limits**, subí el límite de mails por hora a unos 30.
3. **Authentication → Emails → Templates**: hay que editar **dos** plantillas, **Magic Link** y **Confirm signup**. La primera vez que alguien entra, Supabase le manda "Confirm signup"; las siguientes, "Magic Link". Las dos tienen que traer el link **y** el código. Mensaje corto, sin imágenes. Por ejemplo:

   ```html
   <h2>Entrá al Álbum Choxi</h2>
   <p>Tu código: <strong>{{ .Token }}</strong></p>
   <p>O tocá este link: <a href="{{ .ConfirmationURL }}">Entrar</a></p>
   ```

   El código es lo que se usa en la app instalada en iPhone, porque el link abre Safari y no la app.

## Invitar amigos

1. Entrá, tocá **Diseño** (solo lo ven los admins) → **Grupo**.
2. Tocá **Copiar** y mandá el link por WhatsApp. Es del estilo `https://choxi01.github.io/album-choxi/?codigo=xxxxxxxxxx`.
3. Tu amigo abre el link, entra con su mail, pone su apodo y toca **Unirme**. El código ya viene completado.
4. Si el link se filtró, tocá **Nuevo código**: el anterior deja de andar (los que ya están siguen adentro).

Desde **Grupo** también podés sacar gente del álbum.

## Admins y dueño

- El **dueño** es quien creó el álbum. Es el único que puede **Hacer admin** o **Quitar admin** a otros, desde **Diseño → Grupo**.
- Los admins usan el modo diseño, invitan y sacan miembros comunes. A otro admin solo lo saca el dueño, y al dueño no lo saca nadie.
- Lo que la app no hace (borrar un álbum entero, borrar una cuenta) se hace en el panel de Supabase: **Table Editor → albumes** y **Authentication → Users**.

## Instalarla en el celu

- **Android (Chrome)**: abrí el link, menú ⋮ → **Agregar a la pantalla principal** (o **Instalar app**).
- **iPhone (Safari)**: abrí el link, botón **Compartir** → **Agregar a inicio**. Al entrar desde la app instalada, usá el **código** que viene en el mail (no el link).

## Cómo está hecha

```
index.html
css/estilos.css
js/config.js       URL y clave publishable de Supabase
js/reglas.js       lógica pura: numeración, destino real, puede pegar, etiqueta
js/api.js          todo lo que habla con Supabase
js/fotos.js        achicar, rotar y miniatura (se pierden los datos EXIF y el GPS)
js/estado.js       estado en memoria y acciones (con actualización optimista)
js/vistas.js       pantallas, álbum, cajón, paneles, apertura de sobre
js/arrastre.js     arrastrar y soltar con el dedo
js/app.js          arranque y rutas
vendor/supabase.js @supabase/supabase-js 2.117.3 (build UMD, descargado de jsDelivr)
sw.js  manifest.webmanifest  fonts/  icons/
supabase/schema.sql          esquema ya aplicado
supabase/migraciones/        cambios nuevos al esquema (los aplicás vos)
tests/reglas.test.js
```

Fuentes: Bodoni Moda, Barlow Condensed y Barlow (Google Fonts, licencia OFL), empaquetadas en `fonts/` con el subconjunto latino.
