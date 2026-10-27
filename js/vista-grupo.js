/* Pestaña Grupo: mi perfil, la gente del grupo (miembros e invitados), invitar (admins),
   importar desde Cuentas Choxi, mi apodo y cerrar sesión. */
(function () {
  const K = Cuentas, C = Calculo, F = Formato, S = Estado, E = S.E;
  const esc = F.esc, $ = id => document.getElementById(id);
  const TIPOS = ['Cédula', 'Celular', 'Email', 'RUC', 'Otro'];
  const U = { perfil: null, invitado: null, conf: null, imp: null };
  const dibujar = () => Pestanas.dibujar();
  const av = c => `<span class="avatar" style="background:${esc(c.color)}" aria-hidden="true">${esc((c.nombre || '?').charAt(0).toUpperCase())}</span>`;
  const confirma = (clave, txt, ok, okTxt, extra) => U.conf === clave
    ? `<div class="confirma"><span>${esc(txt)}</span><div class="acciones"><button class="btn peligro" data-a="${ok}"${extra || ''}>${okTxt}</button><button class="btn" data-a="cancelar">No</button></div></div>` : '';
  const link = () => location.origin + location.pathname + '?codigo=' + E.album.codigo;

  function datos(c) {
    return C.datosCuenta(c).map(l => {
      const i = l.indexOf(': ');
      return i > 0 ? `<div class="kv">${esc(l.slice(0, i))}: <b class="num">${esc(l.slice(i + 2))}</b></div>` : `<div class="kv">${esc(l)}</div>`;
    }).join('');
  }
  // Mismo formulario que los contactos de Cuentas Choxi
  function formDatos(d, titulo, nombreLbl, guardar, cancelar, tiene) {
    return `<div class="tarj hoja-form"><h3>${titulo}</h3>
      <label class="f">${nombreLbl}<input id="pNombre" value="${esc(d.nombre || '')}" maxlength="40" autocomplete="off"></label>
      <div class="sub"><div class="ojo">Si ${tiene} alias</div><div class="splitrow alias"><select id="pTipo" aria-label="Tipo de alias">${TIPOS.map(t => `<option${(d.tipo_alias || 'Celular') === t ? ' selected' : ''}>${t}</option>`).join('')}</select>
        <input id="pAlias" value="${esc(d.alias || '')}" maxlength="60" placeholder="Alias" aria-label="Alias" autocomplete="off"></div></div>
      <div class="sub"><div class="ojo">Si no ${tiene} alias: datos de la cuenta</div>
        <label class="f">Titular<input id="pTitular" value="${esc(d.titular || '')}" maxlength="60" autocomplete="off"></label>
        <label class="f">Cédula<input id="pCedula" inputmode="numeric" value="${esc(d.cedula || '')}" maxlength="20" autocomplete="off"></label>
        <label class="f">Banco<input id="pBanco" value="${esc(d.banco || '')}" maxlength="40" autocomplete="off"></label>
        <label class="f">Nro. de cuenta<input id="pCuenta" inputmode="numeric" value="${esc(d.cuenta || '')}" maxlength="40" autocomplete="off"></label></div>
      <div id="pErr" class="err" role="alert"></div>
      <div class="fila"><button class="btn" data-a="${cancelar}">Cancelar</button><button class="btn pri" data-a="${guardar}" id="pOk">Guardar</button></div></div>`;
  }
  const leerDatos = () => ({ nombre: $('pNombre').value.trim(), tipo_alias: $('pTipo').value, alias: $('pAlias').value.trim(),
    titular: $('pTitular').value.trim(), cedula: $('pCedula').value.trim(), banco: $('pBanco').value.trim(), cuenta: $('pCuenta').value.trim() });

  function miPerfil() {
    const p = E.perfiles.find(x => x.user_id === E.uid) || {}, yo = S.yo();
    if (U.perfil) return formDatos(U.perfil, 'Mis datos para que me transfieran', 'Nombre', 'guardarPerfil', 'cancelarPerfil', 'tenés');
    const c = Object.assign({ nombre: p.nombre || (yo && yo.apodo) || 'Vos', color: E.album && E.album.diseno.acento || '#c9a96e' }, p);
    return `<div class="tarj"><div class="fila entre"><h3>Mi perfil</h3><button class="btn chico" data-a="editarPerfil">Editar</button></div>
      <div class="persona">${av(c)}<div class="crece"><b>${esc(c.nombre)}</b>${datos(c)}</div></div>
      <p class="chico apagado">Lo ven los de tus grupos, para saber a dónde pasarte. Con alias se muestra solo el alias.</p></div>`;
  }

  function invitar() {
    if (!S.esAdmin()) return '';
    return `<div class="tarj"><h3>Invitar</h3><p class="chico apagado">Mandales este link para que se sumen.</p>
      <label class="f">Link de invitación<input id="g-link" readonly value="${esc(link())}"></label>
      <div class="fila"><button class="btn pri" data-a="copiarLink">Copiar</button><button class="btn" data-a="nuevoCodigo">Nuevo código</button></div>
      <div class="chico apagado">Código: <b class="codigo">${esc(E.album.codigo)}</b></div>
      ${confirma('codigo', 'El link y el código de ahora dejan de andar. Los que ya están en el grupo siguen adentro.', 'nuevoCodigoOk', 'Cambiar código')}</div>`;
  }

  function gente() {
    const dueno = S.esDueno(), admin = S.esAdmin();
    let h = `<div class="fila entre"><h2>Gente del grupo</h2><span class="chip">${E.miembros.length}</span></div>`;
    if (dueno) h += '<p class="chico apagado">Como dueño del álbum, sos el único que puede dar y quitar admins.</p>';
    h += '<div class="tarj">';
    E.miembros.slice().sort((a, b) => a.apodo.localeCompare(b.apodo)).forEach(m => {
      const p = E.personas.find(x => x.user_id === m.user_id), c = p ? K.contacto(p.id) : { nombre: m.apodo, color: '#555', alias: '' };
      const otro = m.user_id !== E.uid, esAd = m.rol === 'admin';
      // Mismas reglas que el servidor: al dueño no lo saca nadie y a un admin solo lo saca el dueño.
      const sacable = admin && otro && !S.esDueno(m.user_id) && (!esAd || dueno);
      h += `<div class="persona">${av(c)}<div class="crece"><b>${esc(m.apodo)}${otro ? '' : ' <span class="yo-tag">vos</span>'}</b>
        <div class="chico apagado">${S.esDueno(m.user_id) ? 'Dueño · Admin' : esAd ? 'Admin' : 'Miembro'}</div>${datos(c)}
        <div class="fila acc">${c.id ? `<button class="btn mini-btn" data-a="copiar" data-id="${c.id}">Copiar ${c.alias ? 'alias' : 'datos'}</button>` : ''}
          ${dueno && otro ? `<button class="btn mini-btn" data-a="rol" data-u="${m.user_id}" data-r="${esAd ? 'miembro' : 'admin'}">${esAd ? 'Quitar admin' : 'Hacer admin'}</button>` : ''}
          ${sacable ? `<button class="btn mini-btn peligro" data-a="sacar" data-u="${m.user_id}">Sacar</button>` : ''}</div>
        ${confirma('rol:' + m.user_id, esAd ? `¿Quitarle el admin a ${m.apodo}?` : `¿Hacer admin a ${m.apodo}? Va a poder usar el modo diseño, invitar y sacar gente, y editar cualquier gasto.`, 'rolOk', esAd ? 'Quitar admin' : 'Hacer admin', ` data-u="${m.user_id}" data-r="${esAd ? 'miembro' : 'admin'}"`)}
        ${confirma('sacar:' + m.user_id, `¿Sacar a ${m.apodo} del grupo? Sus figuritas y gastos quedan.`, 'sacarOk', 'Sacar', ` data-u="${m.user_id}"`)}</div></div>`;
    });
    h += '</div>';

    const invitados = E.personas.filter(p => !p.user_id).sort((a, b) => a.nombre.localeCompare(b.nombre));
    h += `<div class="fila entre"><h3>Invitados (sin la app)</h3><span class="chip">${invitados.length}</span></div>`;
    if (U.invitado) h += formDatos(U.invitado, U.invitado.id ? 'Editar invitado' : 'Nuevo invitado', 'Nombre o apodo', 'guardarInvitado', 'cancelarInvitado', 'tiene');
    else h += '<button class="btn ancho" data-a="nuevoInvitado">+ Agregar invitado</button>';
    if (invitados.length) {
      h += '<div class="tarj">';
      invitados.forEach(p => {
        const c = K.contacto(p.id), edita = admin || p.creado_por === E.uid;
        h += `<div class="persona">${av(c)}<div class="crece"><b>${esc(c.nombre)}</b><div class="chico apagado">Invitado · lo agregó ${esc(K.quien(p.creado_por))}</div>${datos(c)}
          <div class="fila acc"><button class="btn mini-btn" data-a="copiar" data-id="${c.id}">Copiar ${c.alias ? 'alias' : 'datos'}</button>
            ${edita ? `<button class="btn mini-btn" data-a="editarInvitado" data-id="${c.id}">Editar</button>` : ''}
            ${admin ? `<button class="btn mini-btn peligro" data-a="quitarInv" data-id="${c.id}">Quitar</button>` : ''}</div>
          ${confirma('inv:' + p.id, `¿Quitar a ${p.nombre}?`, 'quitarInvOk', 'Quitar', ` data-id="${p.id}"`)}</div></div>`;
      });
      h += '</div>';
    }
    return h;
  }

  /* Importar desde Cuentas Choxi */
  function importar() {
    const x = U.imp;
    let h = '<div class="tarj"><h3>Importar desde Cuentas Choxi</h3>';
    if (!x) {
      return h + `<p class="chico apagado">Elegí el archivo de respaldo (.json) de Cuentas Choxi. Se suma a las cuentas de este grupo como cargado por vos; el archivo no se toca.</p>
        <label class="btn archivo">Elegir archivo…<input type="file" id="imp-archivo" accept=".json,application/json"></label>
        <div class="err" role="alert">${esc(U.impErr || '')}</div></div>`;
    }
    if (x.paso === 'subiendo') return h + `<p class="chico" role="status">${esc(x.progreso || 'Importando…')}</p></div>`;
    if (x.paso === 'listo') {
      return h + `<p class="chico">${x.errores.length ? 'Terminó, pero algunas cuentas fallaron:' : 'Listo, se importó todo.'}</p>
        ${x.errores.map(e => `<p class="err">${esc(e)}</p>`).join('')}<button class="btn" data-a="impCerrar">Listo</button></div>`;
    }
    const yo = K.yoId(), personas = E.personas.slice().sort((a, b) => (b.user_id ? 1 : 0) - (a.user_id ? 1 : 0) || a.nombre.localeCompare(b.nombre));
    h += '<p class="chico apagado">Emparejá cada contacto con alguien del grupo, o crealo como invitado.</p>';
    x.usados.forEach(c => {
      const fijo = c.yo && yo;
      h += `<label class="f">${esc(c.nombre)}${c.yo ? ' (vos en Cuentas Choxi)' : ''}<select class="imp-sel" data-c="${esc(c.id)}"${fijo ? ' disabled' : ''}>
        <option value="nuevo"${x.mapa[c.id] === 'nuevo' ? ' selected' : ''}>Crear como invitado nuevo</option>
        ${personas.map(p => `<option value="${p.id}"${x.mapa[c.id] === p.id ? ' selected' : ''}>${esc(p.nombre)}${p.user_id ? (p.user_id === E.uid ? ' (vos)' : ' · miembro') : ' · invitado'}</option>`).join('')}</select></label>`;
    });
    const r = Importar.resumen(Importar.armar(x.datos, x.mapa, F.hoy())), nuevos = Object.values(x.mapa).filter(v => v === 'nuevo').length;
    h += `<div class="confirma"><span>Se van a importar <b>${r.cuentas}</b> ${r.cuentas === 1 ? 'cuenta' : 'cuentas'}, <b>${r.gastos}</b> ${r.gastos === 1 ? 'gasto' : 'gastos'}, <b>${r.pagos}</b> ${r.pagos === 1 ? 'pago' : 'pagos'}${nuevos ? ` y ${nuevos === 1 ? 'se crea 1 invitado' : `se crean ${nuevos} invitados`}` : ''}.</span>
      <div class="acciones"><button class="btn pri" data-a="impOk">Importar</button><button class="btn" data-a="impCerrar">Cancelar</button></div></div>`;
    return h + '</div>';
  }
  function elegirArchivo(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = Importar.leer(String(r.result)), usados = Importar.usados(d), yo = K.yoId(), mapa = {};
        // "yo" va directo a mi persona; el resto, a quien se llame igual, o invitado nuevo
        usados.forEach(c => {
          const igual = E.personas.find(p => p.nombre.trim().toLowerCase() === String(c.nombre).trim().toLowerCase());
          mapa[c.id] = c.yo && yo ? yo : igual ? igual.id : 'nuevo';
        });
        U.imp = { datos: d, usados, mapa, paso: 'emparejar' }; U.impErr = '';
      } catch (e) { U.imp = null; U.impErr = e.message; }
      dibujar();
    };
    r.onerror = () => { U.impErr = 'No se pudo leer el archivo.'; dibujar(); };
    r.readAsText(file);
  }

  function sesion() {
    const yo = S.yo();
    return `<div class="tarj"><h3>Mi cuenta</h3>
      ${yo ? `<label class="f">Mi apodo en este grupo<input id="a-apodo" value="${esc(yo.apodo)}" maxlength="30"></label><button class="btn" data-a="apodo">Guardar apodo</button>` : '<p class="chico apagado">Estás viendo este álbum como dueño de la app, sin ser miembro.</p>'}
      ${UI.alCambiarAlbum ? '<button class="btn" data-a="cambiarAlbum">Cambiar de álbum</button>' : ''}
      <button class="btn peligro" data-a="salir">Cerrar sesión</button></div>`;
  }

  function html() {
    if (!E.album) return '';
    return `<header class="sec-cab"><h1>Grupo</h1><span class="chico apagado">${esc(S.D().nombre)}</span></header>
      ${miPerfil()}${invitar()}${gente()}${importar()}${sesion()}`;
  }

  const acciones = {
    cancelar: () => { U.conf = null; dibujar(); },
    editarPerfil: () => { const p = E.perfiles.find(x => x.user_id === E.uid) || {}, yo = S.yo(); U.perfil = Object.assign({ nombre: (yo && yo.apodo) || '' }, p); dibujar(); },
    cancelarPerfil: () => { U.perfil = null; dibujar(); },
    guardarPerfil: async () => {
      const d = leerDatos(); $('pOk').disabled = true;
      try { await K.guardarPerfil(d); } catch (e) { $('pOk').disabled = false; $('pErr').textContent = e.message; return; }
      U.perfil = null; dibujar(); Vistas.toast('Datos guardados');
    },
    nuevoInvitado: () => { U.invitado = { tipo_alias: 'Cédula' }; dibujar(); },
    editarInvitado: b => { const p = E.personas.find(x => x.id === b.dataset.id); U.invitado = Object.assign({}, p); dibujar(); },
    cancelarInvitado: () => { U.invitado = null; dibujar(); },
    guardarInvitado: async () => {
      const d = leerDatos();
      if (!d.nombre) { $('pErr').textContent = 'Poné un nombre.'; return; }
      $('pOk').disabled = true;
      try { await K.guardarInvitado(U.invitado.id, d); } catch (e) { $('pOk').disabled = false; $('pErr').textContent = e.message; return; }
      U.invitado = null; dibujar(); Vistas.toast('Invitado guardado');
    },
    quitarInv: b => { U.conf = 'inv:' + b.dataset.id; dibujar(); },
    quitarInvOk: async b => { U.conf = null; await K.quitarInvitado(b.dataset.id); dibujar(); Vistas.toast('Invitado quitado'); },
    copiar: b => { const c = K.contacto(b.dataset.id); Pestanas.copiar(C.textoCopiarCuenta(c), (c.alias ? 'Alias' : 'Datos') + ' de ' + c.nombre + ' copiados'); },
    copiarLink: () => Pestanas.copiar(link(), 'Link copiado', $('g-link')),
    nuevoCodigo: () => { U.conf = 'codigo'; dibujar(); },
    nuevoCodigoOk: async () => { U.conf = null; await S.nuevoCodigo(); dibujar(); Vistas.toast('Código nuevo listo'); },
    rol: b => { U.conf = 'rol:' + b.dataset.u; dibujar(); },
    rolOk: async b => { U.conf = null; await S.cambiarRol(b.dataset.u, b.dataset.r); dibujar(); },
    sacar: b => { U.conf = 'sacar:' + b.dataset.u; dibujar(); },
    sacarOk: async b => { U.conf = null; await S.sacar(b.dataset.u); dibujar(); },
    impCerrar: () => { U.imp = null; dibujar(); },
    impOk: async () => {
      const x = U.imp; x.paso = 'subiendo'; dibujar();
      try { x.errores = await K.importar(x.datos, x.mapa, t => { x.progreso = t; dibujar(); }); }
      catch (e) { x.errores = [e.message]; }
      x.paso = 'listo'; dibujar();
    },
    apodo: async () => { const ap = $('a-apodo').value.trim(); if (!ap) return; await S.cambiarApodo(ap); dibujar(); Vistas.toast('Apodo guardado'); },
    cambiarAlbum: () => UI.alCambiarAlbum(),
    salir: () => UI.alSalir()
  };

  function alCambiarCampo(t) {
    if (t.id === 'imp-archivo') return elegirArchivo(t);
    if (t.classList.contains('imp-sel') && U.imp) { U.imp.mapa[t.dataset.c] = t.value; dibujar(); }
  }

  Pestanas.registrar('grupo', { html, acciones, alCambiarCampo, ocupado: () => !!(U.perfil || U.invitado || (U.imp && U.imp.paso === 'emparejar')) });
  window.VistaGrupo = { reiniciar() { Object.assign(U, { perfil: null, invitado: null, conf: null, imp: null }); } };
})();
