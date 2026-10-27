# Álbum Choxi

Un álbum de figuritas estilo mundial, pero con selfies. Cada lugar al que va el grupo es un hueco del álbum y se llena con la selfie que se sacaron ahí. El álbum es **compartido**: todos ven lo mismo y los cambios llegan en vivo.

Abajo hay cuatro pestañas: **Álbum**, **Cuentas** (los gastos repartidos de Cuentas Choxi, compartidos por el grupo), **Grupo** (tu perfil, la gente, invitar) y **Panel** (solo lo ve el dueño de la app).

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

```bash
node tests/calculo.test.js
```

```bash
node tests/importar.test.js
```

- `reglas`: numeración, adónde puede ir cada figurita y las etiquetas. Tienen que dar lo mismo que la función `pegar` del SQL.
- `calculo`: los de Cuentas Choxi (reparto exacto, transferencias mínimas, texto final).
- `importar`: leer el respaldo de Cuentas Choxi y pasar contactos a personas del grupo.

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

1. **Authentication → URL Configuration** (también la usa Google para volver a la app)
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

## Entrar con Google

Se hace una sola vez. Si alguien entra con Google y con el código por mail usando el mismo mail, Supabase lo toma como la misma cuenta.

**Google Cloud Console** (<https://console.cloud.google.com>):

1. Creá un proyecto "Álbum Choxi".
2. **APIs y servicios → Pantalla de consentimiento OAuth**: tipo **Externo**, nombre de la app y tu mail. Después **publicala** ("En producción"). Si queda en "Prueba", solo pueden entrar los mails que agregues a mano.
3. **Credenciales → Crear credenciales → ID de cliente OAuth**, tipo **Aplicación web**:
   - Orígenes autorizados: `https://choxi01.github.io` y `http://localhost:3000`.
   - URI de redirección: `https://xepoipniwlypdpskdyvn.supabase.co/auth/v1/callback`.
4. Copiá el **Client ID** y el **Client Secret**.

**Supabase → Authentication → Sign In / Providers → Google**: activalo y pegá el Client ID y el Secret. En **URL Configuration** tiene que seguir estando la URL de la app (paso 1 de la sección anterior).

## Invitar amigos

1. Entrá a la pestaña **Grupo** (la parte de invitar solo la ven los admins).
2. Tocá **Copiar** y mandá el link por WhatsApp. Es del estilo `https://choxi01.github.io/album-choxi/?codigo=xxxxxxxxxx`.
3. Tu amigo abre el link, entra con su mail, pone su apodo y toca **Unirme**. El código ya viene completado.
4. Si el link se filtró, tocá **Nuevo código**: el anterior deja de andar (los que ya están siguen adentro).

Desde **Grupo** también podés sacar gente del álbum.

## Cuentas

- **Gasto rápido** (una compra) o **Salida** (varios gastos). Todos los del grupo ven y cargan; cada cuenta y gasto dice quién lo cargó, y lo edita o quita quien lo cargó o un admin.
- **Saldar** muestra quién le pasa a quién y el texto para pegar en el grupo. "✓ Pasó" marca la transferencia como hecha; "Deshacer" la desmarca. Si alguien cambia un gasto, las transferencias marcadas de esa cuenta se borran (los saldos cambiaron).
- Una salida se puede enlazar con un **lugar del álbum**. Desde el lugar ves cuánto se gastó; desde la cuenta, "Ver en el álbum".
- En **Grupo** cada uno carga sus datos para que le transfieran (alias, o titular/cédula/banco/cuenta). La gente sin la app se agrega como **invitado**.

### Importar tu historial de Cuentas Choxi

1. En Cuentas Choxi: **Ajustes → Descargar copia de seguridad**.
2. Acá: **Grupo → Importar desde Cuentas Choxi** → elegí ese `.json`.
3. Emparejá cada contacto con alguien del grupo o dejalo como invitado nuevo. Tu contacto "yo" va directo a vos.
4. Revisá el resumen y tocá **Importar**. Todo queda cargado por vos. Si una cuenta falla, te dice cuál y sigue con las demás. El archivo no se toca.

## Admins, dueño del álbum y dueño de la app

- El **dueño del álbum** es quien lo creó. Es el único que puede **Hacer admin** o **Quitar admin** a otros, desde **Grupo**.
- Los admins usan el modo diseño, invitan y sacan miembros comunes. A otro admin solo lo saca el dueño, y al dueño no lo saca nadie.
- El **dueño de la app** (tu cuenta, en la tabla `duenos`) cuenta como admin de todos los álbumes y ve la pestaña **Panel**.

## Panel (dueño de la app)

- **Resumen**: usuarios, álbumes, figuritas, gastos y el uso del plan gratis (base 500 MB, fotos 1 GB; en rojo pasado el 80 %).
- **Usuarios**: cómo entra cada uno, alta, último ingreso y sus grupos. Podés cambiar el rol, sacarlo de un grupo o de todos. Borrar la cuenta del todo se hace en Supabase: **Authentication → Users**.
- **Álbumes**: números de cada álbum, **Abrir** (aunque no seas miembro), **Copiar invitación** y **Borrar álbum** (pide escribir el nombre del grupo; borra primero las fotos y después todo lo demás).
- **Duplicados**: gastos que parecen cargados dos veces. "Borrar este" o "No es duplicado" (se acuerda en ese navegador).
- Al cambiar de álbum, abajo aparecen **Todos los álbumes**.

## Instalarla en el celu

- **Android (Chrome)**: abrí el link, menú ⋮ → **Agregar a la pantalla principal** (o **Instalar app**).
- **iPhone (Safari)**: abrí el link, botón **Compartir** → **Agregar a inicio**. Al entrar desde la app instalada, usá el **código** que viene en el mail (no el link).

## Cómo está hecha

```
index.html
css/estilos.css
js/config.js       URL y clave publishable de Supabase
js/reglas.js       lógica pura: numeración, destino real, puede pegar, etiqueta
js/formato.js      montos en Gs. y fechas (de Cuentas Choxi)
js/calculo.js      lógica pura de cuentas: reparto, balances, transferencias, texto final
js/importar.js     leer el respaldo de Cuentas Choxi y emparejar contactos
js/api.js          todo lo que habla con Supabase
js/fotos.js        achicar, rotar y miniatura (se pierden los datos EXIF y el GPS)
js/estado.js       estado en memoria y acciones (con actualización optimista)
js/vistas.js       pantallas, álbum, cajón, paneles, apertura de sobre
js/arrastre.js     arrastrar y soltar con el dedo
js/cuentas.js      datos y acciones de cuentas, perfiles e invitados
js/pestanas.js     barra de abajo y dibujo de las otras pestañas
js/vista-cuentas.js  vista-grupo.js  vista-panel.js
js/app.js          arranque y rutas
vendor/supabase.js @supabase/supabase-js 2.117.3 (build UMD, descargado de jsDelivr)
sw.js  manifest.webmanifest  fonts/  icons/
supabase/schema.sql          esquema ya aplicado
supabase/migraciones/        cambios nuevos al esquema (los aplicás vos)
tests/reglas.test.js  tests/calculo.test.js  tests/importar.test.js
```

Fuentes: Bodoni Moda, Barlow Condensed y Barlow (Google Fonts, licencia OFL), empaquetadas en `fonts/` con el subconjunto latino.
