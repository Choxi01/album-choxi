/* Pestaña Cuentas: lista y detalle (Gastos), formulario de gasto y de salida, y Saldar. Pantallas de Cuentas Choxi. */
(function () {
  const K = Cuentas, C = Calculo, F = Formato, S = Estado, R = Reglas;
  const gs = F.gs, esc = F.esc, $ = id => document.getElementById(id);
  const MODOS = { igual: 'Iguales', exacto: 'Montos exactos', partes: 'Por partes' };
  const U = { sub: 'gastos', activa: null, form: null, salida: null, verTodas: false, conf: null };
  const dibujar = () => Pestanas.dibujar();
  const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
  const av = c => `<span class="avatar" style="background:${esc(c.color)}" aria-hidden="true">${esc((c.nombre || '?').charAt(0).toUpperCase())}</span>`;
  const nom = c => esc(c.nombre) + (c.yo ? ' <span class="yo-tag">vos</span>' : '');
  const activa = () => K.cuenta(U.activa) || K.lista()[0] || null;
  const lugarTexto = lid => { const r = R.buscar(S.E.a, lid); return r ? `N.º ${r.n} · ${r.l.nombre || 'Sin nombre'}` : ''; };
  const confirma = (clave, txt, ok, okTxt) => U.conf === clave
    ? `<div class="confirma"><span>${esc(txt)}</span><div class="acciones"><button class="btn peligro" data-a="${ok}">${okTxt}</button><button class="btn" data-a="cancelar">No</button></div></div>` : '';

  /* ---------- Gastos ---------- */
  function gastos() {
    let h = '';
    const todas = K.lista();
    if (S.E.personas.length < 2 && !todas.length) {
      h += `<div class="tarj vacio"><h3>Falta gente para dividir</h3><p class="chico apagado">Invitá a alguien al grupo o agregá un invitado (alguien sin la app) en Grupo.</p><button class="btn" data-a="aGrupo">Ir a Grupo</button></div>`;
    }
    h += '<div class="fila"><button class="btn pri" data-a="gastoRapido">+ Gasto rápido</button><button class="btn" data-a="nuevaSalida">+ Salida</button></div>';
    h += '<p class="chico apagado">Gasto rápido: una compra y listo. Salida: varios gastos del mismo grupo.</p>';
    if (U.salida && !U.salida.id) h += formSalida(U.salida);
    if (U.form && U.form.rapido && !U.form.cuentaId) return h + formGasto(U.form, null);
    if (!todas.length) return h + '<div class="tarj vacio"><h3>Todavía no hay cuentas</h3><p class="chico apagado">Tocá "+ Gasto rápido" para una compra suelta, o "+ Salida" si van a ser varios gastos.</p></div>';
    const s = activa(), lista = U.verTodas ? todas : todas.slice(0, 4), yo = K.yoId();
    h += `<div class="fila entre"><h2>Cuentas del grupo</h2><span class="chip">${todas.length}</span></div><div class="cuentas">`;
    lista.forEach(x => {
      const pend = C.transferencias(C.balances(x), yo).length;
      h += `<button class="cuenta" data-a="abrir" data-id="${x.id}" aria-current="${x.id === s.id}"><span class="crece"><b>${esc(x.nombre)}</b>
        <small>${x.tipo === 'rapido' ? 'Gasto rápido' : 'Salida · ' + plural(x.gastos.length, 'gasto', 'gastos')} · ${plural(x.miembros.length, 'persona', 'personas')} · ${F.fechaCorta(x.fecha)}</small></span>
        <span class="der"><b class="num">${gs(C.totalCuenta(x))}</b><small class="${pend ? 'debe' : 'cobra'}">${pend ? plural(pend, 'pendiente', 'pendientes') : 'Saldado'}</small></span></button>`;
    });
    h += '</div>';
    if (todas.length > 4) h += `<button class="btn fantasmita" data-a="verTodas">${U.verTodas ? 'Ver menos' : 'Ver todas (' + todas.length + ')'}</button>`;
    return h + detalle(s);
  }

  function detalle(s) {
    const salida = s.tipo !== 'rapido', puede = K.puedeEditar(s);
    let h = `<div class="tarj hoja-cuenta"><div class="fila entre"><div class="crece"><div class="ojo">${salida ? 'Salida' : 'Gasto rápido'} · ${F.fechaCorta(s.fecha)}</div>
      <h2>${esc(s.nombre)}</h2><div class="chico apagado">Cargada por ${esc(K.quien(s.creado_por))}</div></div><span class="num total">${gs(C.totalCuenta(s))}</span></div>`;
    if (s.lugar_id && lugarTexto(s.lugar_id)) h += `<button class="lugar-link" data-a="verLugar" data-id="${s.lugar_id}"><span>Lugar del álbum: <b>${esc(lugarTexto(s.lugar_id))}</b></span><span>Ver en el álbum →</span></button>`;
    h += `<div class="fila envolver">${s.miembros.map(m => `<span class="chip">${nom(K.contacto(m))}</span>`).join('')}</div>`;
    if (salida && puede && !(U.salida && U.salida.id === s.id)) {
      h += `<div class="fila"><button class="btn chico" data-a="editarSalida" data-id="${s.id}">Editar salida</button><button class="btn chico peligro" data-a="quitarCuenta" data-id="${s.id}">Quitar salida</button></div>`;
      h += confirma('c:' + s.id, `¿Quitar "${s.nombre}"? Se borran sus ${plural(s.gastos.length, 'gasto', 'gastos')} para todos.`, 'quitarCuentaOk', 'Sí, quitar');
    }
    h += '</div>';
    if (U.salida && U.salida.id === s.id) h += formSalida(U.salida);
    if (U.form && U.form.cuentaId === s.id) h += formGasto(U.form, s);
    else if (salida) h += '<button class="btn pri ancho" data-a="nuevoGasto">+ Agregar gasto a esta salida</button>';
    h += '<div class="tarj">';
    if (!s.gastos.length) h += '<div class="vacio chico">Todavía no hay gastos. Tocá "Agregar gasto" y cargá el primero.</div>';
    s.gastos.forEach(g => {
      const pagaron = Object.keys(g.pagadores).map(k => K.contacto(k).nombre).join(' y ');
      const entre = Object.keys(g.entre).filter(k => g.entre[k] > 0).map(k => K.contacto(k).nombre);
      h += `<div class="gasto">${av(K.contacto(Object.keys(g.pagadores)[0]))}<div class="crece"><div class="fila entre"><h3>${esc(g.descripcion)}</h3><span class="monto">${gs(g.monto)}</span></div>
        <div class="chico apagado">Pagó ${esc(pagaron)} · entre ${esc(entre.join(', '))} <span class="etiq">${MODOS[g.modo]}</span></div>
        <div class="chico apagado">Cargado por ${esc(K.quien(g.creado_por))}</div>`;
      if (K.puedeEditar(g)) {
        h += `<div class="fila acc"><button class="btn mini-btn" data-a="editarGasto" data-id="${g.id}">Editar</button>${U.conf === 'g:' + g.id
          ? `<button class="btn mini-btn peligro" data-a="quitarGastoOk" data-id="${g.id}">Sí, quitar</button><button class="btn mini-btn" data-a="cancelar">No</button>`
          : `<button class="btn mini-btn" data-a="quitarGasto" data-id="${g.id}">Quitar</button>`}</div>`;
      }
      h += '</div></div>';
    });
    h += '</div>';
    if (s.gastos.length) h += '<button class="btn ancho" data-a="sub" data-v="saldar">Ver quién le pasa a quién →</button>';
    return h;
  }

  function opcionesLugar(sel) {
    return '<option value="">Sin lugar</option>' + S.E.a.secciones.map((sec, si) =>
      `<optgroup label="Pág ${si + 1} · ${esc(sec.p.titulo)}">${sec.lugares.map(l =>
        `<option value="${l.id}"${l.id === sel ? ' selected' : ''}>N.º ${R.numero(S.E.a, l.id)} · ${esc(l.nombre || 'Sin nombre')}</option>`).join('')}</optgroup>`).join('');
  }
  function formSalida(f) {
    let h = `<div class="tarj hoja-form"><h3>${f.id ? 'Editar salida' : 'Nueva salida'}</h3>
      <label class="f">Nombre<input id="nsNombre" value="${esc(f.nombre)}" maxlength="60" placeholder="Ej: Cumple de Beto" autocomplete="off"></label>
      <label class="f">Fecha<input id="nsFecha" type="date" value="${esc(f.fecha)}"></label>
      <label class="f">Lugar del álbum (opcional)<select id="nsLugar">${opcionesLugar(f.lugar_id)}</select></label>
      <div class="ojo">¿Quiénes fueron? (frecuentes primero)</div><div class="pick">`;
    K.ordenados().forEach(c => { h += `<label><input type="checkbox" class="nsM" value="${c.id}"${f.miembros.includes(c.id) ? ' checked' : ''}>${av(c)}${esc(c.nombre)}</label>`; });
    return h + `</div><div id="nsErr" class="err" role="alert"></div><div class="fila"><button class="btn" data-a="cancelarSalida">Cancelar</button><button class="btn pri" data-a="guardarSalida">${f.id ? 'Guardar' : 'Crear'}</button></div></div>`;
  }

  // En gasto rápido: 6 (yo y frecuentes) + los que ya estén elegidos; "Ver todos" muestra el resto
  function personasForm(f, s) {
    if (!f.rapido) return s.miembros;
    const ord = K.ordenados().map(c => c.id);
    if (f.verTodos || ord.length <= 6) return ord;
    const top = ord.slice(0, 6);
    ord.forEach(id => { if (!top.includes(id) && (f.entre[id] || f.pagadores[id] || f.pagador === id)) top.push(id); });
    return top;
  }
  function filaMonto(id, clase, valor, etiqueta, ph) {
    const c = K.contacto(id);
    return `<div class="splitrow"><span class="fila">${av(c)}${esc(c.nombre)}</span><input class="${clase} num" data-id="${id}" inputmode="numeric" placeholder="${ph}" value="${valor}" aria-label="${etiqueta} ${esc(c.nombre)}"></div>`;
  }
  function formGasto(f, s) {
    const ps = personasForm(f, s), todos = f.rapido ? K.ordenados().map(c => c.id) : s.miembros;
    const titulo = f.rapido ? (f.cuentaId ? 'Editar gasto rápido' : 'Gasto rápido') : (f.id ? 'Editar gasto' : 'Nuevo gasto');
    let h = `<div class="tarj hoja-form"><h3>${titulo}</h3>
      <label class="f">¿Qué fue?<input id="fDesc" value="${esc(f.descripcion)}" maxlength="60" placeholder="Ej: Pizza" autocomplete="off"></label>
      <label class="f">Monto total (Gs.)<input id="fMonto" inputmode="numeric" class="num" value="${f.monto ? F.puntos(f.monto) : ''}" placeholder="0" autocomplete="off"></label>
      <div class="ojo">¿Quién pagó?</div><div class="seg" role="group" aria-label="Quién pagó"><button data-a="multi" data-v="0" aria-pressed="${!f.multi}">Una persona</button><button data-a="multi" data-v="1" aria-pressed="${!!f.multi}">Pagaron varios</button></div>`;
    if (!f.multi) {
      h += `<select id="fPagador" aria-label="Quién pagó">${todos.map(m => { const c = K.contacto(m); return `<option value="${m}"${f.pagador === m ? ' selected' : ''}>${esc(c.nombre)}${c.yo ? ' (vos)' : ''}</option>`; }).join('')}</select>`;
    } else {
      h += '<div class="chico apagado">Poné cuánto puso cada uno (tiene que sumar el total).</div>';
      ps.forEach(m => { h += filaMonto(m, 'fPag', f.pagadores[m] ? F.puntos(f.pagadores[m]) : '', 'Cuánto pagó', '0'); });
    }
    h += '<div class="ojo">¿Entre quiénes se divide?</div><div class="seg" role="group" aria-label="Cómo se divide">' +
      [['igual', 'Iguales'], ['exacto', 'Montos'], ['partes', 'Partes']].map(o => `<button data-a="modo" data-v="${o[0]}" aria-pressed="${f.modo === o[0]}">${o[1]}</button>`).join('') + '</div>';
    if (f.modo === 'igual') {
      h += `<div class="pick">${ps.map(m => { const c = K.contacto(m); return `<label><input type="checkbox" class="fEntre" value="${m}"${f.entre[m] ? ' checked' : ''}>${av(c)}${esc(c.nombre)}</label>`; }).join('')}</div>`;
      h += `<div class="fila">${f.rapido ? '' : '<button class="btn mini-btn" data-a="todos">Todos</button>'}<button class="btn mini-btn" data-a="nadie">Ninguno</button></div>`;
    } else {
      h += `<div class="chico apagado">${f.modo === 'exacto' ? 'Poné cuánto le toca a cada uno (tiene que sumar el total). Dejá vacío a quien no entra.' : 'Partes: ej. 2 para quien comió doble, 1 para el resto, vacío si no entra.'}</div>`;
      ps.forEach(m => { const v = f.entre[m] || ''; h += filaMonto(m, 'fVal', v ? (f.modo === 'exacto' ? F.puntos(v) : v) : '', 'Valor para', f.modo === 'exacto' ? '0' : '—'); });
    }
    if (f.rapido && !f.verTodos && todos.length > ps.length) h += `<button class="btn mini-btn" data-a="verTodos">Ver toda la gente (${todos.length})</button>`;
    return h + '<div id="fErr" class="err" role="alert"></div><div class="fila"><button class="btn" data-a="cancelarGasto">Cancelar</button><button class="btn pri" data-a="guardarGasto" id="fOk">Guardar</button></div></div>';
  }

  /* ---------- Saldar ---------- */
  function saldar() {
    const s = activa();
    if (!s) return '<div class="tarj vacio"><h3>Nada para saldar</h3><p class="chico apagado">Cargá un gasto primero.</p><button class="btn pri" data-a="sub" data-v="gastos">Ir a Gastos</button></div>';
    const yo = K.yoId(), b = C.balances(s), tr = C.transferencias(b, yo);
    let h = `<div><div class="ojo">${esc(s.nombre)} · <button class="enlace" data-a="sub" data-v="gastos">cambiar de cuenta</button></div><h2>Saldar cuentas</h2></div>`;
    const mias = tr.filter(t => t.de === yo), cobros = tr.filter(t => t.a === yo);
    if (mias.length) {
      h += '<div class="aviso-debe"><div class="ojo debe">Te toca pasar</div>';
      mias.forEach(t => {
        const a = K.contacto(t.a);
        h += `<div class="fila entre envolver"><div><div class="monto-grande num">${gs(t.monto)}</div><div class="chico">a <b>${esc(a.nombre)}</b></div></div><button class="btn chico" data-a="copiarCuenta" data-id="${a.id}">Copiar ${a.alias ? 'alias' : 'datos'}</button></div>`;
        h += `<div class="chico num">${C.datosCuenta(a).map(esc).join('<br>')}</div>`;
      });
      h += '</div>';
    } else if (cobros.length) {
      const tc = cobros.reduce((x, t) => x + t.monto, 0);
      h += `<div class="aviso-cobra"><div class="ojo cobra">Te tienen que pasar</div><div class="monto-grande num">${gs(tc)}</div><div class="chico">${cobros.map(t => esc(K.contacto(t.de).nombre) + ' ' + gs(t.monto)).join(' · ')}</div></div>`;
    } else if (yo && s.miembros.includes(yo)) {
      h += '<div class="aviso-cobra"><div class="ojo cobra">Estás a mano</div><div class="chico">No tenés que pasar ni cobrar nada en esta cuenta.</div></div>';
    }

    // Balance de cada uno, con barra proporcional al mayor
    const ids = Object.keys(b), max = Math.max(1, ...ids.map(k => Math.abs(b[k])));
    h += '<h2>Balance</h2><div class="tarj">';
    K.ordenados().filter(c => ids.includes(c.id)).forEach(c => {
      const v = b[c.id], pct = Math.round(Math.abs(v) / max * 50);
      h += `<div class="bal">${av(c)}<div class="crece"><div class="chico">${nom(c)}</div><div class="barrita" aria-hidden="true"><i class="${v < 0 ? 'debe-bg' : 'cobra-bg'}" style="${v < 0 ? 'right:50%' : 'left:50%'};width:${pct}%"></i></div></div>
        <span class="num chico b ${v < 0 ? 'debe' : v > 0 ? 'cobra' : 'apagado'}">${v > 0 ? '+' : ''}${gs(v)}</span></div>`;
    });
    h += '</div>';

    h += `<div class="fila entre"><h2>Transferencias</h2><span class="chip">${tr.length} pendiente${tr.length === 1 ? '' : 's'}</span></div><div class="tarj">`;
    if (!tr.length) h += '<div class="vacio chico">Nadie le debe a nadie. Todos a mano.</div>';
    tr.forEach((t, i) => {
      const de = K.contacto(t.de), a = K.contacto(t.a);
      h += `<div class="transfer${t.de === yo ? ' mia' : ''}"><div class="fila">${av(de)}<span class="apagado" aria-hidden="true">→</span>${av(a)}
        <div class="crece"><div class="chico"><b>${de.yo ? 'Vos' : esc(de.nombre)}</b> le ${de.yo ? 'pasás' : 'pasa'} a <b>${a.yo ? 'vos' : esc(a.nombre)}</b></div>
        <div class="num b">${gs(t.monto)}</div><div class="chico apagado">${esc(C.datosCuenta(a)[0])}${a.alias ? '' : ' …'}</div></div></div>
        <button class="btn chico" data-a="pagado" data-i="${i}" aria-label="Marcar que ${esc(de.nombre)} le pasó a ${esc(a.nombre)}">✓ Pasó</button></div>`;
    });
    h += '</div>';
    if (s.pagos.length) {
      h += `<h3>${plural(s.pagos.length, 'transferencia hecha', 'transferencias hechas')}</h3><div class="tarj">`;
      s.pagos.forEach(p => {
        h += `<div class="transfer"><div class="chico"><b>${esc(K.contacto(p.de).nombre)}</b> → <b>${esc(K.contacto(p.a).nombre)}</b> · <span class="num">${gs(p.monto)}</span><div class="apagado">Marcó ${esc(K.quien(p.marcado_por))}</div></div>
          ${K.puedeDeshacerPago(p) ? `<button class="btn chico" data-a="deshacerPago" data-id="${p.id}">Deshacer</button>` : ''}</div>`;
      });
      h += '</div>';
    }
    h += `<h2>Texto para pasar al grupo</h2><div class="ticket num" id="ticket">${esc(C.textoFinal(s, K.contactos(), yo))}</div>`;
    return h + '<button class="btn pri ancho" data-a="copiarTexto">Copiar texto</button>';
  }

  function html() {
    if (!S.E.a) return '';
    return `<header class="sec-cab"><h1>Cuentas</h1></header>
      <div class="seg" role="group" aria-label="Vista"><button data-a="sub" data-v="gastos" aria-pressed="${U.sub === 'gastos'}">Gastos</button><button data-a="sub" data-v="saldar" aria-pressed="${U.sub === 'saldar'}">Saldar</button></div>
      ${U.sub === 'saldar' ? saldar() : gastos()}`;
  }

  /* ---------- Formulario ---------- */
  function formVacio(rapido, miembros) {
    const yo = K.yoId();
    const f = { descripcion: '', monto: 0, pagador: yo && miembros.includes(yo) ? yo : miembros[0], multi: false, pagadores: {}, modo: 'igual', entre: {}, rapido, cuentaId: rapido ? null : activa().id };
    if (rapido) { if (yo) f.entre[yo] = 1; } else miembros.forEach(m => f.entre[m] = 1);
    return f;
  }
  function leerForm() {
    const f = U.form; if (!f) return;
    if ($('fDesc')) f.descripcion = $('fDesc').value;
    if ($('fMonto')) f.monto = F.parseGs($('fMonto').value);
    if ($('fPagador')) f.pagador = $('fPagador').value;
    const q = sel => document.querySelectorAll('#seccion ' + sel);
    if (q('.fPag').length) { f.pagadores = {}; q('.fPag').forEach(i => { const v = F.parseGs(i.value); if (v) f.pagadores[i.dataset.id] = v; }); }
    if (q('.fEntre').length) { f.entre = {}; q('.fEntre').forEach(i => { if (i.checked) f.entre[i.value] = 1; }); }
    if (q('.fVal').length) {
      f.entre = {};
      q('.fVal').forEach(i => { const v = f.modo === 'exacto' ? F.parseGs(i.value) : parseFloat(String(i.value).replace(',', '.')) || 0; if (v > 0) f.entre[i.dataset.id] = v; });
    }
  }
  function leerSalida() {
    const f = U.salida;
    f.nombre = $('nsNombre').value.trim(); f.fecha = $('nsFecha').value || F.hoy(); f.lugar_id = $('nsLugar').value;
    f.miembros = [...document.querySelectorAll('#seccion .nsM:checked')].map(i => i.value);
    return f;
  }
  const errEn = (id, t) => { if ($(id)) $(id).textContent = t; };

  const acciones = {
    sub: b => { U.sub = b.dataset.v; U.form = null; U.salida = null; U.conf = null; dibujar(); document.getElementById('seccion').scrollTop = 0; },
    abrir: b => { U.activa = b.dataset.id; U.form = null; U.salida = null; U.conf = null; dibujar(); },
    verTodas: () => { U.verTodas = !U.verTodas; dibujar(); },
    aGrupo: () => Pestanas.ir('grupo'),
    gastoRapido: () => { U.salida = null; U.form = formVacio(true, K.ordenados().map(c => c.id)); dibujar(); },
    nuevoGasto: () => { U.salida = null; U.form = formVacio(false, activa().miembros); dibujar(); },
    editarGasto: b => {
      const s = activa(), g = s.gastos.find(x => x.id === b.dataset.id), ks = Object.keys(g.pagadores);
      U.salida = null;
      U.form = { id: g.id, descripcion: g.descripcion, monto: g.monto, pagador: ks[0], multi: ks.length > 1, pagadores: Object.assign({}, g.pagadores),
        modo: g.modo, entre: Object.assign({}, g.entre), rapido: s.tipo === 'rapido', cuentaId: s.id };
      dibujar();
    },
    multi: b => {
      leerForm(); U.form.multi = b.dataset.v === '1';
      if (U.form.multi && !Object.keys(U.form.pagadores).length && U.form.monto) U.form.pagadores[U.form.pagador] = U.form.monto;
      dibujar();
    },
    modo: b => {
      leerForm(); const f = U.form, antes = f.modo; f.modo = b.dataset.v;
      if (antes === f.modo) return;
      const unos = {}; Object.keys(f.entre).filter(k => f.entre[k] > 0).forEach(k => unos[k] = 1);
      f.entre = f.modo === 'exacto' ? C.repartir(f.monto, unos) : unos; // al pasar a montos, arranca con el reparto igual
      dibujar();
    },
    verTodos: () => { leerForm(); U.form.verTodos = true; dibujar(); },
    todos: () => { leerForm(); activa().miembros.forEach(m => U.form.entre[m] = 1); dibujar(); },
    nadie: () => { leerForm(); U.form.entre = {}; dibujar(); },
    cancelarGasto: () => { U.form = null; dibujar(); },
    guardarGasto: async () => {
      leerForm();
      const f = U.form, pag = {};
      if (f.multi) Object.assign(pag, f.pagadores); else pag[f.pagador] = f.monto;
      const g = { id: f.id, descripcion: f.descripcion.trim(), monto: f.monto, pagadores: pag, modo: f.modo, entre: f.entre };
      const err = C.validarGasto(g);
      if (err) return errEn('fErr', err);
      $('fOk').disabled = true;
      try { U.activa = await K.guardarGasto(f.cuentaId, f.rapido, g); }
      catch (e) { if ($('fOk')) $('fOk').disabled = false; return errEn('fErr', e.message); } // el error del servidor, tal cual
      U.form = null;
      if (f.rapido) U.sub = 'saldar'; // gasto rápido: directo a saldar
      dibujar(); Vistas.toast('Gasto guardado');
    },
    quitarGasto: b => { U.conf = 'g:' + b.dataset.id; dibujar(); },
    quitarGastoOk: async b => { U.conf = null; await K.quitarGasto(activa().id, b.dataset.id); dibujar(); Vistas.toast('Gasto quitado'); },
    cancelar: () => { U.conf = null; dibujar(); },
    nuevaSalida: () => { const yo = K.yoId(); U.form = null; U.salida = { nombre: '', fecha: F.hoy(), miembros: yo ? [yo] : [], lugar_id: '' }; dibujar(); },
    editarSalida: b => { const s = K.cuenta(b.dataset.id); U.form = null; U.salida = { id: s.id, nombre: s.nombre, fecha: s.fecha, miembros: s.miembros.slice(), lugar_id: s.lugar_id || '' }; dibujar(); },
    cancelarSalida: () => { U.salida = null; dibujar(); },
    guardarSalida: async () => {
      const f = leerSalida();
      if (!f.nombre) return errEn('nsErr', 'Ponele un nombre a la salida.');
      if (f.miembros.length < 2) return errEn('nsErr', 'Elegí al menos 2 personas.');
      if (f.id) {
        const fuera = K.cuenta(f.id).miembros.filter(m => !f.miembros.includes(m) && K.usada(m, f.id));
        if (fuera.length) return errEn('nsErr', `No podés sacar a ${fuera.map(m => K.contacto(m).nombre).join(', ')}: aparece en un gasto o pago.`);
      }
      try { if (f.id) await K.editarSalida(f.id, f); else U.activa = await K.crearSalida(f); }
      catch (e) { return errEn('nsErr', e.message); }
      U.salida = null; dibujar(); Vistas.toast(f.id ? 'Salida guardada' : 'Salida creada');
    },
    quitarCuenta: b => { U.conf = 'c:' + b.dataset.id; dibujar(); },
    quitarCuentaOk: async () => { const id = activa().id; U.conf = null; await K.quitarCuenta(id); U.activa = null; dibujar(); Vistas.toast('Salida quitada'); },
    pagado: async b => {
      const s = activa(), t = C.transferencias(C.balances(s), K.yoId())[+b.dataset.i];
      if (!t) return;
      b.disabled = true;
      await K.marcarPago(s.id, t); dibujar(); Vistas.toast('Marcada como transferida');
    },
    deshacerPago: async b => { await K.deshacerPago(b.dataset.id); dibujar(); Vistas.toast('Transferencia desmarcada'); },
    copiarTexto: () => { const s = activa(); Pestanas.copiar(C.textoFinal(s, K.contactos(), K.yoId()), 'Copiado. Pegalo donde quieras', $('ticket')); },
    copiarCuenta: b => { const c = K.contacto(b.dataset.id); Pestanas.copiar(C.textoCopiarCuenta(c), (c.alias ? 'Alias' : 'Datos') + ' de ' + c.nombre + ' copiados'); },
    verLugar: b => Vistas.verLugar(b.dataset.id)
  };

  // Montos con puntos mientras escribís, sin que salte el cursor
  function alEscribir(e) {
    const t = e.target;
    const esMonto = t.id === 'fMonto' || t.classList.contains('fPag') || (t.classList.contains('fVal') && U.form && U.form.modo === 'exacto');
    if (!esMonto) return;
    const cursor = t.selectionStart == null ? t.value.length : t.selectionStart;
    const despues = t.value.slice(cursor).replace(/\D/g, '').length;
    const v = F.parseGs(t.value);
    t.value = v ? F.puntos(v) : '';
    let pos = t.value.length;
    for (let n = 0; n < despues && pos > 0; pos--) if (/\d/.test(t.value[pos - 1])) n++;
    try { t.setSelectionRange(pos, pos); } catch (_) { /* algunos inputs no soportan selección */ }
  }

  Pestanas.registrar('cuentas', { html, acciones, alEscribir, ocupado: () => !!(U.form || U.salida) });

  // Desde el álbum
  window.VistaCuentas = {
    abrirCuenta(id) { U.activa = id; U.sub = 'gastos'; U.form = null; U.salida = null; Pestanas.ir('cuentas'); },
    reiniciar() { Object.assign(U, { sub: 'gastos', activa: null, form: null, salida: null, verTodas: false, conf: null }); }
  };
})();
