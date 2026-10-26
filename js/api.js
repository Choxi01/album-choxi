/* Todo lo que habla con Supabase: sesión, consultas, RPC, fotos y tiempo real. */
(function () {
  const C = window.CONFIG;
  const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
  const TABLAS = ['albumes', 'miembros', 'paginas', 'lugares', 'sobres', 'figuritas'];

  // Convierte el error de Supabase en un Error con texto en español.
  function falla(error) {
    const m = (error && error.message) || String(error);
    if (/fetch|network|Load failed/i.test(m) || !navigator.onLine) return new Error('Sin conexión: los cambios vuelven cuando haya internet');
    return new Error(m);
  }
  async function ok(p) {
    const { data, error } = await p;
    if (error) throw falla(error);
    return data;
  }

  /* Sesión */
  const url = () => location.origin + location.pathname;
  async function usuario() {
    const { data } = await sb.auth.getSession();
    return data.session ? data.session.user : null;
  }
  async function enviarCodigo(email) {
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: url(), shouldCreateUser: true } });
    if (!error) return;
    const seg = /(\d+)\s*seconds?/i.exec(error.message || '');
    if (seg || error.status === 429) throw new Error(seg ? `Esperá ${seg[1]} segundos para pedir otro código.` : 'Se pidieron muchos códigos. Esperá un rato y probá de nuevo.');
    throw falla(error);
  }
  async function verificar(email, token) {
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'Ese código venció o no es correcto, pedí otro.' : falla(error).message);
    return data.user;
  }
  const salir = () => sb.auth.signOut();
  const alCambiarSesion = cb => sb.auth.onAuthStateChange((ev, s) => cb(ev, s ? s.user : null));

  /* Consultas */
  async function misAlbumes(uid) {
    return ok(sb.from('miembros').select('album_id, apodo, rol, albumes(diseno)').eq('user_id', uid));
  }
  async function cargarTodo(id) {
    const [album, miembros, paginas, lugares, sobres, figuritas] = await Promise.all([
      ok(sb.from('albumes').select('*').eq('id', id).single()),
      ...TABLAS.slice(1).map(t => ok(sb.from(t).select('*').eq('album_id', id)))
    ]);
    return { album, miembros, paginas, lugares, sobres, figuritas };
  }
  const rpc = (nombre, args) => ok(sb.rpc(nombre, args));

  /* Escrituras directas (las cubre RLS) */
  const tabla = t => sb.from(t);
  const insertar = (t, filas) => ok(tabla(t).insert(filas).select());
  const actualizar = (t, id, cambios) => ok(tabla(t).update(cambios).eq('id', id));
  const borrar = (t, id) => ok(tabla(t).delete().eq('id', id));
  const sacarMiembro = (album, uid) => ok(tabla('miembros').delete().eq('album_id', album).eq('user_id', uid));

  /* Fotos: bucket privado, se muestran con URLs firmadas que se guardan en memoria */
  const bucket = () => sb.storage.from(C.BUCKET);
  const subir = (path, blob) => ok(bucket().upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
  const borrarArchivos = paths => paths.length ? ok(bucket().remove(paths)) : Promise.resolve();
  const URLS = new Map(); // path → { url, vence }
  const HORA = 3600;
  function verUrl(path) { const u = URLS.get(path); return u ? u.url : ''; }
  function guardarLocal(path, url) { URLS.set(path, { url, vence: Infinity }); }
  // Firma en lote las que faltan o vencen en menos de 10 minutos. Devuelve true si firmó alguna.
  async function firmar(paths) {
    const ahora = Date.now();
    const faltan = [...new Set(paths)].filter(p => { const u = URLS.get(p); return !u || u.vence - ahora < 600e3; });
    if (!faltan.length) return false;
    const data = await ok(bucket().createSignedUrls(faltan, HORA));
    data.forEach(d => { if (d.signedUrl) URLS.set(d.path, { url: d.signedUrl, vence: ahora + HORA * 1000 }); });
    return true;
  }

  /* Tiempo real: un solo canal por álbum */
  let canal = null;
  function escuchar(id, alCambio, alEstado) {
    dejarDeEscuchar();
    canal = sb.channel('album-' + id);
    TABLAS.forEach(t => {
      const filtro = (t === 'albumes' ? 'id' : 'album_id') + '=eq.' + id;
      ['INSERT', 'UPDATE'].forEach(ev => canal.on('postgres_changes', { event: ev, schema: 'public', table: t, filter: filtro },
        p => alCambio(t, ev, p.new, p.old)));
      // Los DELETE no se pueden filtrar: llegan solo con la clave y se ignoran si no son de este álbum.
      canal.on('postgres_changes', { event: 'DELETE', schema: 'public', table: t }, p => alCambio(t, 'DELETE', null, p.old));
    });
    canal.subscribe(estado => alEstado && alEstado(estado));
  }
  function dejarDeEscuchar() { if (canal) { sb.removeChannel(canal); canal = null; } }

  window.Api = {
    usuario, enviarCodigo, verificar, salir, alCambiarSesion,
    misAlbumes, cargarTodo, rpc, insertar, actualizar, borrar, sacarMiembro,
    subir, borrarArchivos, verUrl, guardarLocal, firmar, escuchar, dejarDeEscuchar
  };
})();
