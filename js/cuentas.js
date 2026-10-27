/* Cuentas del grupo: lecturas sobre Estado.E (personas, perfiles, cuentas, gastos, pagos) y acciones.
   Las acciones esperan al servidor y después ponen la fila (el tiempo real también llega, sin duplicar).
   Si el servidor rechaza, el error sube tal cual para mostrarlo. */
(function () {
  const S = Estado, E = S.E, C = Calculo, F = Formato;
  const PALETA = ['#c9a96e', '#7e9cc7', '#c47f6b', '#7fb08f', '#b08fc4', '#c4b26b', '#6bb3c4', '#c46b95'];
  const SIN_COLOR = '#9a968c'; // el color por defecto de personas: se reemplaza por uno de la paleta

  function colorDe(p) {
    if (p.color && p.color !== SIN_COLOR) return p.color;
    let h = 0; for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return PALETA[Math.abs(h) % PALETA.length];
  }
  const persona = id => E.personas.find(p => p.id === id);
  const perfilDe = uid => E.perfiles.find(x => x.user_id === uid) || {};
  const esMiembro = uid => E.miembros.some(m => m.user_id === uid);

  // Contacto con la forma que usa Calculo. Un miembro usa los datos de su perfil; un invitado, los guardados en personas.
  function contacto(id) {
    const p = persona(id);
    if (!p) return { id, nombre: '?', color: '#555', alias: '' };
    const d = p.user_id ? perfilDe(p.user_id) : p;
    return { id, nombre: p.nombre, color: colorDe(p), user_id: p.user_id, yo: !!p.user_id && p.user_id === E.uid,
      invitado: !p.user_id, creado_por: p.creado_por,
      tipo_alias: d.tipo_alias || '', alias: d.alias || '', titular: d.titular || '', cedula: d.cedula || '', banco: d.banco || '', cuenta: d.cuenta || '' };
  }
  const contactos = () => E.personas.map(p => contacto(p.id));
  const yoId = () => { const p = E.personas.find(x => x.user_id && x.user_id === E.uid); return p ? p.id : null; };
  const porCreado = (a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id);

  function cuenta(id) {
    const c = E.cuentas.find(x => x.id === id);
    if (!c) return null;
    return Object.assign({}, c, { gastos: E.gastos.filter(g => g.cuenta_id === id).sort(porCreado), pagos: E.pagos.filter(p => p.cuenta_id === id).sort(porCreado) });
  }
  const lista = () => E.cuentas.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.created_at || '').localeCompare(a.created_at || '')).map(c => cuenta(c.id));
  const ordenados = () => C.ordenarContactos(contactos(), lista());
  const deLugar = lid => lista().filter(c => c.lugar_id === lid);
  // Edita o borra quien lo cargó, o un admin (igual que RLS)
  const puedeEditar = fila => S.esAdmin() || fila.creado_por === E.uid;
  const puedeDeshacerPago = p => S.esAdmin() || p.marcado_por === E.uid;
  function quien(uid) {
    const m = E.miembros.find(x => x.user_id === uid);
    if (m) return m.apodo;
    const p = E.personas.find(x => x.user_id === uid);
    return p ? p.nombre : 'alguien que ya no está';
  }
  // ¿La persona aparece en alguna cuenta? (si es así no se puede borrar ni sacar de la salida)
  function usada(pid, enCuenta) {
    return lista().some(c => (!enCuenta || c.id === enCuenta) && ((!enCuenta && c.miembros.includes(pid)) ||
      c.gastos.some(g => g.pagadores[pid] || g.entre[pid]) || c.pagos.some(p => p.de === pid || p.a === pid)));
  }

  // RLS no da error cuando no deja: devuelve 0 filas
  function una(filas) {
    if (!filas || !filas.length) throw new Error('No tenés permiso para cambiar esto.');
    return filas;
  }
  const insertar = async (t, fila) => S.ponerFilas(t, una(await Api.insertar(t, Object.assign({ album_id: E.albumId }, fila))));
  const actualizar = async (t, id, cambios) => S.ponerFilas(t, una(await Api.actualizar(t, id, cambios)));
  async function borrar(t, id) { una(await Api.borrar(t, id)); S.quitarFilas(t, x => x.id === id); }

  /* Gastos y cuentas */
  // g: { id?, descripcion, monto, pagadores, modo, entre }. Devuelve el id de la cuenta donde quedó.
  async function guardarGasto(cuentaId, rapido, g) {
    const fila = { descripcion: g.descripcion, monto: g.monto, pagadores: g.pagadores, modo: g.modo, entre: g.entre };
    if (rapido) {
      const miembros = ordenados().map(c => c.id).filter(id => g.pagadores[id] || g.entre[id]);
      if (cuentaId) {
        await actualizar('gastos', g.id, fila);
        await actualizar('cuentas', cuentaId, { nombre: fila.descripcion, miembros });
      } else {
        cuentaId = (await insertar('cuentas', { tipo: 'rapido', nombre: fila.descripcion, fecha: F.hoy(), miembros })).id;
        try { await insertar('gastos', Object.assign({ cuenta_id: cuentaId }, fila)); }
        catch (e) { await borrar('cuentas', cuentaId).catch(() => {}); throw e; }
      }
    } else if (g.id) await actualizar('gastos', g.id, fila);
    else await insertar('gastos', Object.assign({ cuenta_id: cuentaId }, fila));
    S.quitarFilas('pagos', p => p.cuenta_id === cuentaId); // el servidor los borra: los saldos cambiaron
    return cuentaId;
  }
  async function quitarGasto(cuentaId, gastoId) {
    await borrar('gastos', gastoId);
    S.quitarFilas('pagos', p => p.cuenta_id === cuentaId);
    const c = cuenta(cuentaId);
    if (c && c.tipo === 'rapido' && !c.gastos.length) await borrar('cuentas', cuentaId);
  }
  const crearSalida = async s => (await insertar('cuentas', { tipo: 'salida', nombre: s.nombre, fecha: s.fecha || F.hoy(), miembros: s.miembros, lugar_id: s.lugar_id || null })).id;
  const editarSalida = (id, s) => actualizar('cuentas', id, { nombre: s.nombre, fecha: s.fecha, miembros: s.miembros, lugar_id: s.lugar_id || null });
  async function quitarCuenta(id) { await borrar('cuentas', id); S.quitarFilas('gastos', g => g.cuenta_id === id); S.quitarFilas('pagos', p => p.cuenta_id === id); }

  /* Saldar */
  const marcarPago = (cuentaId, t) => insertar('pagos', { cuenta_id: cuentaId, de: t.de, a: t.a, monto: t.monto });
  const deshacerPago = id => borrar('pagos', id);

  /* Perfil e invitados */
  const CAMPOS = ['tipo_alias', 'alias', 'titular', 'cedula', 'banco', 'cuenta'];
  const datosDe = d => { const o = {}; CAMPOS.forEach(k => o[k] = String(d[k] || '').trim()); if (!o.alias) o.tipo_alias = ''; return o; };
  async function guardarPerfil(d) {
    S.ponerFilas('perfiles', una(await Api.guardarPerfil(Object.assign({ user_id: E.uid, nombre: String(d.nombre || '').trim() }, datosDe(d)))));
  }
  const guardarInvitado = (id, d) => {
    const fila = Object.assign({ nombre: d.nombre.trim() }, datosDe(d));
    return id ? actualizar('personas', id, fila) : insertar('personas', fila);
  };
  async function quitarInvitado(id) {
    if (usada(id)) throw new Error('No se puede quitar: aparece en alguna cuenta.');
    await borrar('personas', id);
  }

  /* Importar desde Cuentas Choxi. mapa: {contacto_id: persona_id | 'nuevo'}. progreso(texto). Devuelve los errores por cuenta. */
  async function importar(datos, mapa, progreso) {
    const final = Object.assign({}, mapa);
    const nuevos = datos.contactos.filter(c => final[c.id] === 'nuevo');
    for (let i = 0; i < nuevos.length; i++) {
      progreso(`Creando invitados: ${i + 1} de ${nuevos.length}…`);
      final[nuevos[i].id] = (await insertar('personas', Importar.invitado(nuevos[i]))).id;
    }
    const armado = Importar.armar(datos, final, F.hoy()), errores = [];
    for (let i = 0; i < armado.length; i++) {
      const x = armado[i];
      progreso(`Importando cuentas: ${i + 1} de ${armado.length}…`);
      let id = null;
      try {
        id = (await insertar('cuentas', x.cuenta)).id;
        if (x.gastos.length) S.ponerFilas('gastos', una(await Api.insertar('gastos', x.gastos.map(g => Object.assign({ album_id: E.albumId, cuenta_id: id }, g)))));
        if (x.pagos.length) S.ponerFilas('pagos', una(await Api.insertar('pagos', x.pagos.map(p => Object.assign({ album_id: E.albumId, cuenta_id: id }, p)))));
      } catch (e) {
        if (id) await borrar('cuentas', id).catch(() => {}); // no dejar una cuenta a medias
        errores.push(`${x.nombre}: ${e.message}`);
      }
    }
    return errores;
  }

  window.Cuentas = {
    contacto, contactos, yoId, cuenta, lista, ordenados, deLugar, puedeEditar, puedeDeshacerPago, quien, usada, esMiembro,
    guardarGasto, quitarGasto, crearSalida, editarSalida, quitarCuenta, marcarPago, deshacerPago,
    guardarPerfil, guardarInvitado, quitarInvitado, importar, total: c => C.totalCuenta(c)
  };
})();
