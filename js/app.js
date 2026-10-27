/* Arranque: sesión → elegir álbum → abrirlo y escuchar cambios en vivo. */
(function () {
  const CLAVE_ALBUM = 'album_choxi_album', CLAVE_CODIGO = 'album_choxi_codigo';
  // El código de invitación se guarda en la pestaña: al volver de Google la URL ya no lo trae.
  const ses = { get: () => { try { return sessionStorage.getItem(CLAVE_CODIGO) || ''; } catch (_) { return ''; } },
    set: v => { try { v ? sessionStorage.setItem(CLAVE_CODIGO, v) : sessionStorage.removeItem(CLAVE_CODIGO); } catch (_) {} } };
  let codigo = new URLSearchParams(location.search).get('codigo') || ses.get();
  ses.set(codigo);
  let usuario = null, albumId = null, reintentar = null, huboCorte = false;

  const ultimo = () => { try { return localStorage.getItem(CLAVE_ALBUM); } catch (_) { return null; } };
  const guardarUltimo = id => { try { localStorage.setItem(CLAVE_ALBUM, id); } catch (_) {} };
  const limpiarCodigo = () => { codigo = ''; ses.set(''); history.replaceState(null, '', location.pathname); };
  function fallo(e, otraVez) { reintentar = otraVez; Vistas.errorCarga(e.message, otraVez); }

  async function entrar() {
    albumId = null; Api.dejarDeEscuchar();
    Vistas.cargando('Buscando tus álbumes…');
    let lista, todos;
    try { ({ lista, todos } = await buscarAlbumes()); } catch (e) { return fallo(e, entrar); }
    UI.alCambiarAlbum = lista.length > 1 || todos.length ? cambiarAlbum : null;
    if (codigo || (!lista.length && !todos.length)) return Vistas.bienvenida(codigo, id => { limpiarCodigo(); guardarUltimo(id); entrar(); });
    const u = ultimo(), id = lista.some(m => m.album_id === u) || todos.some(a => a.album_id === u) ? u : lista.length === 1 ? lista[0].album_id : null;
    if (!id) return Vistas.elegirAlbum(lista, abrirAlbum, todos);
    abrirAlbum(id);
  }

  // Mis álbumes; el dueño de la app recibe además todos (puede entrar aunque no sea miembro)
  async function buscarAlbumes() {
    const [lista, dueno] = await Promise.all([Api.misAlbumes(usuario.id), Api.rpc('es_dueno').catch(() => false)]);
    Estado.E.duenoApp = !!dueno;
    const todos = dueno ? await VistaPanel.albumes().catch(() => []) : [];
    return { lista, todos };
  }
  async function cambiarAlbum() {
    albumId = null; Api.dejarDeEscuchar();
    Vistas.cargando('Buscando tus álbumes…');
    try { const { lista, todos } = await buscarAlbumes(); Vistas.elegirAlbum(lista, abrirAlbum, todos); }
    catch (e) { fallo(e, cambiarAlbum); }
  }

  async function abrirAlbum(id) {
    guardarUltimo(id); Vistas.cargando();
    try { await Estado.cargar(id); } catch (e) { return fallo(e, () => abrirAlbum(id)); }
    albumId = id; huboCorte = false;
    Vistas.mostrarAlbum();
    Api.escuchar(id, Estado.aplicar, estado => {
      if (estado === 'SUBSCRIBED') { if (huboCorte) recargar(); huboCorte = false; }
      else huboCorte = true; // CHANNEL_ERROR, TIMED_OUT o CLOSED: al reconectar se recarga todo
    });
  }

  // Al volver a la pestaña o reconectar: recargar todo sin mover la página que se está viendo.
  async function recargar() {
    if (!albumId) { if (reintentar && navigator.onLine) reintentar(); return; }
    try { await Estado.cargar(albumId); Estado.cambio(); } catch (e) { Vistas.toast(e.message); }
  }

  function conexion() {
    document.getElementById('offline').hidden = navigator.onLine;
  }

  Estado.E.uid = null;
  Estado.alCambiar(recien => { Vistas.pintar(recien); VistaPost.pintar(); Pestanas.alCambiarDatos(); });
  Estado.alSerExpulsado(() => { Vistas.toast('Te sacaron de ese álbum.'); entrar(); });
  UI.alSalir = () => Api.salir();
  UI.abrirAlbum = id => abrirAlbum(id);
  Vistas.iniciarEventos();
  Pestanas.iniciar();
  Arrastre.iniciar();

  Api.alCambiarSesion((ev, user) => {
    // Se difiere: dentro de este aviso no conviene llamar a otras funciones de Supabase.
    setTimeout(() => {
      if (user && (!usuario || user.id !== usuario.id)) { usuario = user; Estado.E.uid = user.id; entrar(); }
      else if (!user) { usuario = null; albumId = null; Api.dejarDeEscuchar(); Vistas.login(); }
    }, 0);
  });

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && usuario) recargar(); });
  window.addEventListener('online', () => { conexion(); if (usuario) recargar(); });
  window.addEventListener('offline', conexion);
  conexion();
  // En local no se registra, para no ver archivos viejos mientras se programa.
  if ('serviceWorker' in navigator && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
