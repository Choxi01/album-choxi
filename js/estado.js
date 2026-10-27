/* Estado en memoria del álbum abierto y acciones. Las acciones cambian primero en pantalla
   (optimista) y, si el servidor dice que no, vuelven atrás y tiran el error para mostrarlo. */
(function () {
  const COLORES = ['#7e3139', '#2f5c4d', '#33497a', '#5c3f6a', '#7a5f33', '#3d4a52', '#6b3a2a'];
  const DIS = { edicion: 'Edición 2026 · Colección oficial', titulo: 'Álbum de los Lugares', nombre: 'Los de Siempre',
    lema: 'Una selfie por lugar. Llenalo entre todos.', mono: '', acento: '#c9a96e', tapa: '#111217' };
  const POR_PAG = 6;

  const E = { uid: null, albumId: null, album: null, miembros: [], paginas: [], lugares: [], sobres: [], figuritas: [], a: null };
  let oyente = () => {}, alExpulsar = () => {}, frame = 0, recienPend = null;

  function recalcular() { E.a = Reglas.armar(E.paginas, E.lugares, E.figuritas); }
  // Recalcula ya y redibuja en el próximo cuadro (junta ráfagas de cambios en un solo dibujo).
  function cambio(recien) {
    recalcular();
    if (recien) recienPend = recien;
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = 0; const r = recienPend; recienPend = null; oyente(r); });
  }

  /* Lecturas */
  const D = () => Object.assign({}, DIS, E.album && E.album.diseno);
  const yo = () => E.miembros.find(m => m.user_id === E.uid);
  const esAdmin = () => (yo() || {}).rol === 'admin';
  const esDueno = uid => !!E.album && E.album.creado_por === (uid || E.uid);
  const apodo = uid => { const m = E.miembros.find(x => x.user_id === uid); return m ? m.apodo : 'alguien que ya no está'; };
  const fig = id => E.figuritas.find(f => f.id === id);
  const miniPath = f => f.foto_path.replace(/\.jpg$/, '_t.jpg');
  // Las figuritas de un mismo sobre tienen la misma hora: se desempata por id para que el orden sea igual en todos los celus.
  const porFecha = (a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id);
  const abierto = sid => { const s = E.sobres.find(x => x.id === sid); return s && s.abierto_at; };
  const mano = () => E.figuritas.filter(f => !f.lugar_id && abierto(f.sobre_id)).sort(porFecha);
  // Los sobres vacíos (todavía subiendo) no se muestran, así nadie abre uno a medio armar.
  const sobresCerrados = () => E.sobres.filter(s => !s.abierto_at).sort(porFecha)
    .map(s => ({ s, figs: E.figuritas.filter(f => f.sobre_id === s.id) })).filter(x => x.figs.length);
  const pegadaEn = lid => E.a.ocupados.get(lid);
  const puedeTirar = f => esAdmin() || f.subida_por === E.uid;

  async function firmarMinis() {
    if (await Api.firmar(E.figuritas.map(miniPath))) cambio();
  }

  /* Carga y tiempo real */
  async function cargar(id) {
    const d = await Api.cargarTodo(id);
    Object.assign(E, d, { albumId: id });
    recalcular();
    await Api.firmar(E.figuritas.map(miniPath)).catch(() => {});
  }

  const clave = t => t === 'miembros' ? (r => r.album_id + '|' + r.user_id) : (r => r.id);
  function aplicar(t, ev, nuevo, viejo) {
    if (t === 'albumes') { if (nuevo) E.album = nuevo; return cambio(); }
    const lista = E[t], k = clave(t);
    if (ev === 'DELETE') {
      const i = lista.findIndex(r => k(r) === k(viejo));
      if (i < 0) return;
      lista.splice(i, 1);
      if (t === 'miembros' && viejo.user_id === E.uid) return alExpulsar();
      return cambio();
    }
    const i = lista.findIndex(r => k(r) === k(nuevo));
    let recien = null;
    if (t === 'figuritas' && nuevo.lugar_id && !(i >= 0 && lista[i].lugar_id)) recien = nuevo.lugar_id;
    if (i >= 0) lista[i] = nuevo; else lista.push(nuevo);
    if (t === 'figuritas' && i < 0) firmarMinis().catch(() => {});
    cambio(recien);
  }

  /* Acciones con vuelta atrás si falla */
  async function optimista(obj, cambios, llamada, recien) {
    const antes = {}; Object.keys(cambios).forEach(k => antes[k] = obj[k]);
    Object.assign(obj, cambios); cambio(recien);
    try { await llamada(); } catch (e) { Object.assign(obj, antes); cambio(); throw e; }
  }
  const pegar = (fid, lid) => optimista(fig(fid), { lugar_id: lid, pegada_por: E.uid, pegada_at: new Date().toISOString() },
    () => Api.rpc('pegar', { p_figurita: fid, p_lugar: lid }), lid);
  const despegar = fid => { const f = fig(fid); return optimista(f, { destino_tipo: 'lugar', destino_id: f.lugar_id, lugar_id: null, pegada_por: null, pegada_at: null },
    () => Api.rpc('despegar', { p_figurita: fid })); };
  const cambiarDestino = (fid, tipo, id) => optimista(fig(fid), { destino_tipo: tipo, destino_id: tipo === 'libre' ? null : id },
    () => Api.rpc('cambiar_destino', { p_figurita: fid, p_tipo: tipo, p_destino: tipo === 'libre' ? null : id }));
  const abrirSobre = sid => optimista(E.sobres.find(s => s.id === sid), { abierto_por: E.uid, abierto_at: new Date().toISOString() },
    () => Api.rpc('abrir_sobre', { p_sobre: sid }));

  async function tirar(fid) {
    const f = fig(fid), i = E.figuritas.indexOf(f);
    E.figuritas.splice(i, 1); cambio();
    try { await Api.borrar('figuritas', fid); } catch (e) { E.figuritas.push(f); cambio(); throw e; }
    Api.borrarArchivos([f.foto_path, miniPath(f)]).catch(() => {});
  }

  // fotos: [{ foto, mini, fecha, vista, tipo, destino }]. progreso(n, total) para "Subiendo 3 de 7…".
  async function armarSobre(fotos, progreso) {
    let sobre = null; const subidos = [];
    try {
      [sobre] = await Api.insertar('sobres', { album_id: E.albumId });
      const filas = [];
      for (let i = 0; i < fotos.length; i++) {
        progreso(i + 1, fotos.length);
        const x = fotos[i], base = `${E.albumId}/${crypto.randomUUID()}`;
        await Api.subir(base + '.jpg', x.foto); subidos.push(base + '.jpg');
        await Api.subir(base + '_t.jpg', x.mini); subidos.push(base + '_t.jpg');
        Api.guardarLocal(base + '_t.jpg', x.vista);
        filas.push({ album_id: E.albumId, sobre_id: sobre.id, foto_path: base + '.jpg', fecha_foto: x.fecha,
          destino_tipo: x.tipo, destino_id: x.tipo === 'libre' ? null : x.destino });
      }
      const nuevas = await Api.insertar('figuritas', filas);
      [sobre, ...nuevas].forEach(r => { const l = r === sobre ? E.sobres : E.figuritas; if (!l.some(y => y.id === r.id)) l.push(r); });
      cambio();
      return sobre.id;
    } catch (e) {
      await Api.borrarArchivos(subidos).catch(() => {});
      if (sobre) await Api.borrar('sobres', sobre.id).catch(() => {});
      throw new Error(/conexión/.test(e.message) ? e.message : 'No se pudo armar el sobre. Probá de nuevo.');
    }
  }

  /* Diseño (solo admin) */
  async function guardarDiseno(d) { E.album.diseno = d; cambio(); await Api.actualizar('albumes', E.albumId, { diseno: d }); }
  const guardarFila = (t, obj, cambios) => optimista(obj, cambios, () => Api.actualizar(t, obj.id, cambios));
  const guardarPagina = (id, cambios) => guardarFila('paginas', E.paginas.find(p => p.id === id), cambios);
  const guardarLugar = (id, cambios) => guardarFila('lugares', E.lugares.find(l => l.id === id), cambios);

  async function agregarPagina() {
    const n = E.paginas.length + 1, orden = Math.max(0, ...E.paginas.map(p => p.orden)) + 1;
    const [p] = await Api.insertar('paginas', { album_id: E.albumId, orden, titulo: 'Sección ' + n, bajada: 'Por definir', color: COLORES[(n - 1) % COLORES.length] });
    const lugs = await Api.insertar('lugares', Array.from({ length: POR_PAG }, (_, i) => ({ album_id: E.albumId, pagina_id: p.id, orden: i + 1 })));
    if (!E.paginas.some(x => x.id === p.id)) E.paginas.push(p);
    lugs.forEach(l => { if (!E.lugares.some(x => x.id === l.id)) E.lugares.push(l); });
    cambio();
  }

  // Borra la página y sus lugares. Las figuritas pegadas ahí vuelven a "Sin pegar" como comodín (no se borra ninguna foto).
  async function borrarPagina(id) {
    const lids = new Set(E.lugares.filter(l => l.pagina_id === id).map(l => l.id));
    const pegadas = E.figuritas.filter(f => lids.has(f.lugar_id));
    await Api.borrar('paginas', id);
    E.paginas = E.paginas.filter(p => p.id !== id);
    E.lugares = E.lugares.filter(l => !lids.has(l.id));
    pegadas.forEach(f => Object.assign(f, { lugar_id: null, pegada_por: null, pegada_at: null, destino_tipo: 'libre', destino_id: null }));
    cambio();
    await Promise.all(pegadas.map(f => Api.rpc('cambiar_destino', { p_figurita: f.id, p_tipo: 'libre', p_destino: null })));
  }

  async function ordenar(ids) {
    const antes = E.paginas.map(p => [p, p.orden]);
    ids.forEach((id, i) => { E.paginas.find(p => p.id === id).orden = i + 1; }); cambio();
    try { await Api.rpc('ordenar_paginas', { p_album: E.albumId, p_ids: ids }); }
    catch (e) { antes.forEach(([p, o]) => p.orden = o); cambio(); throw e; }
  }

  /* Grupo */
  async function nuevoCodigo() { E.album.codigo = await Api.rpc('nuevo_codigo', { p_album: E.albumId }); cambio(); }
  async function sacar(uid) { await Api.sacarMiembro(E.albumId, uid); E.miembros = E.miembros.filter(m => m.user_id !== uid); cambio(); }
  const cambiarRol = (uid, rol) => { const m = E.miembros.find(x => x.user_id === uid);
    return optimista(m, { rol }, () => Api.rpc('cambiar_rol', { p_album: E.albumId, p_user: uid, p_rol: rol })); };
  async function cambiarApodo(ap) { await Api.rpc('cambiar_apodo', { p_album: E.albumId, p_apodo: ap }); yo().apodo = ap; cambio(); }

  window.Estado = {
    E, COLORES, DIS, cargar, aplicar, cambio, alCambiar: f => oyente = f, alSerExpulsado: f => alExpulsar = f,
    D, yo, esAdmin, esDueno, apodo, fig, miniPath, mano, sobresCerrados, pegadaEn, puedeTirar,
    pegar, despegar, cambiarDestino, abrirSobre, tirar, armarSobre,
    guardarDiseno, guardarPagina, guardarLugar, agregarPagina, borrarPagina, ordenar,
    nuevoCodigo, sacar, cambiarRol, cambiarApodo
  };
})();
