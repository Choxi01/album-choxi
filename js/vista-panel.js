/* Pestaña Panel: solo para el dueño de la app (es_dueno() sin argumentos). Resumen y uso del plan,
   usuarios, álbumes y posibles gastos duplicados. Todo sale de las funciones panel_* del servidor. */
(function () {
  const F = Formato, esc = F.esc, $ = id => document.getElementById(id);
  const CLAVE_OCULTOS = 'album_choxi_no_duplicados';
  const U = { sub: 'resumen', d: null, cargando: false, error: '', conf: null, borrar: null };
  const dibujar = () => Pestanas.dibujar();
  const fecha = iso => iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const fechaHora = iso => iso ? new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const mb = b => (b / 1048576).toLocaleString('es-AR', { maximumFractionDigits: b < 10485760 ? 1 : 0 }) + ' MB';
  const PROV = { google: 'Google', email: 'Email' };
  const confirma = (clave, txt, ok, okTxt, extra) => U.conf === clave
    ? `<div class="confirma"><span>${esc(txt)}</span><div class="acciones"><button class="btn peligro" data-a="${ok}"${extra || ''}>${okTxt}</button><button class="btn" data-a="cancelar">No</button></div></div>` : '';

  function ocultos() { try { return JSON.parse(localStorage.getItem(CLAVE_OCULTOS)) || []; } catch (_) { return []; } }
  function ocultar(k) { try { localStorage.setItem(CLAVE_OCULTOS, JSON.stringify(ocultos().concat([k]))); } catch (_) {} }

  async function cargar() {
    U.cargando = true; U.error = ''; dibujar();
    try {
      const [resumen, usuarios, albumes, duplicados] = await Promise.all(['panel_resumen', 'panel_usuarios', 'panel_albumes', 'panel_duplicados'].map(f => Api.rpc(f)));
      U.d = { resumen, usuarios, albumes, duplicados };
    } catch (e) { U.error = e.message; }
    U.cargando = false; dibujar();
  }

  function barra(nombre, usado, limite) {
    const pct = limite ? usado / limite * 100 : 0;
    return `<div class="uso${pct > 80 ? ' alerta' : ''}"><div class="fila entre chico"><span>${nombre}</span><span class="num">${mb(usado)} de ${mb(limite)} · ${pct.toFixed(pct < 10 ? 1 : 0)} %</span></div>
      <div class="uso-barra" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-label="${nombre}"><i style="width:${Math.min(100, pct)}%"></i></div></div>`;
  }
  function resumen(r) {
    const tile = (n, t) => `<div class="dato"><b class="num">${Number(n).toLocaleString('es-AR')}</b><span>${t}</span></div>`;
    return `<div class="datos">${tile(r.usuarios, 'Usuarios')}${tile(r.albumes, 'Álbumes')}${tile(r.figuritas, 'Figuritas')}${tile(r.gastos, 'Gastos')}</div>
      <div class="tarj"><h3>Uso del plan gratis</h3>${barra('Base de datos', r.base_bytes, r.base_limite)}${barra('Fotos', r.fotos_bytes, r.fotos_limite)}
      <p class="chico apagado">Pasado el 80 % se marca en rojo.</p></div>`;
  }

  function usuarios(lista) {
    let h = '<p class="chico apagado">Borrar la cuenta de alguien del todo se hace en el panel de Supabase (Authentication → Users). Acá podés sacarlo de los grupos.</p>';
    lista.forEach(u => {
      const prov = (u.proveedores || '').split(', ').filter(Boolean).map(p => PROV[p] || p).join(' y ') || '—';
      h += `<div class="tarj"><div class="fila entre"><div class="crece"><b>${esc(u.nombre || 'Sin nombre')}</b>${u.es_dueno ? ' <span class="yo-tag">dueño</span>' : ''}<div class="chico apagado">${esc(u.email || '')}</div></div></div>
        <div class="chico apagado">Entra con ${esc(prov)} · alta ${fecha(u.creado)} · último ingreso ${fechaHora(u.ultimo_ingreso)}</div>`;
      if (!u.grupos.length) h += '<div class="chico apagado">No está en ningún grupo.</div>';
      u.grupos.forEach(g => {
        const k = g.album_id + '|' + u.user_id, admin = g.rol === 'admin';
        h += `<div class="grupo-fila"><div class="crece chico"><b>${esc(g.grupo || 'Sin nombre')}</b> · ${esc(g.apodo)} · ${admin ? 'Admin' : 'Miembro'}</div>
          <button class="btn mini-btn" data-a="rol" data-al="${g.album_id}" data-u="${u.user_id}" data-r="${admin ? 'miembro' : 'admin'}">${admin ? 'Hacer miembro' : 'Hacer admin'}</button>
          <button class="btn mini-btn peligro" data-a="sacar" data-k="${k}">Sacar</button></div>
          ${confirma('sacar:' + k, `¿Sacar a ${g.apodo} de ${g.grupo}?`, 'sacarOk', 'Sacar', ` data-al="${g.album_id}" data-u="${u.user_id}"`)}`;
      });
      if (!u.es_dueno && u.grupos.length) {
        h += `<button class="btn chico peligro" data-a="bloquear" data-u="${u.user_id}">Sacar de todos los grupos</button>
          ${confirma('bloq:' + u.user_id, `¿Sacar a ${u.nombre || u.email} de todos sus grupos? Su cuenta sigue existiendo; sus figuritas y gastos quedan.`, 'bloquearOk', 'Sacar de todos', ` data-u="${u.user_id}"`)}`;
      }
      h += '</div>';
    });
    return h;
  }

  function albumes(lista) {
    let h = '';
    lista.forEach(a => {
      const b = U.borrar && U.borrar.id === a.album_id ? U.borrar : null;
      const stat = (n, uno, varios) => `<span><b class="num">${Number(n).toLocaleString('es-AR')}</b> ${Number(n) === 1 ? uno : varios}</span>`;
      h += `<div class="tarj"><div class="ojo">${esc(a.grupo || 'Sin nombre')}</div><h3>${esc(a.titulo || 'Sin título')}</h3>
        <div class="chico apagado">Creado por ${esc(a.creador || '—')} · ${fecha(a.creado)}</div>
        <div class="stats chico">${stat(a.miembros, 'miembro', 'miembros')}${stat(a.paginas, 'página', 'páginas')}${stat(a.pegadas, 'pegada', 'pegadas')}${stat(a.sin_pegar, 'sin pegar', 'sin pegar')}${stat(a.sobres_cerrados, 'sobre cerrado', 'sobres cerrados')}
          ${stat(a.cuentas, 'cuenta', 'cuentas')}<span><b class="num">${F.gs(a.total_gastado)}</b> gastado</span>${stat(a.fotos, 'foto', 'fotos')}<span><b class="num">${mb(a.fotos_bytes)}</b></span></div>
        <div class="fila envolver"><button class="btn chico pri" data-a="abrir" data-id="${a.album_id}">Abrir</button><button class="btn chico" data-a="invitacion" data-c="${esc(a.codigo)}">Copiar invitación</button>
          ${b ? '' : `<button class="btn chico peligro" data-a="borrar" data-id="${a.album_id}">Borrar álbum</button>`}</div>`;
      if (b) {
        h += `<div class="confirma"><span>Se borra el álbum entero para todos: fotos, páginas, cuentas y gastos. No se puede deshacer. Escribí <b>${esc(a.grupo)}</b> para confirmar.</span>
          <input id="borrar-nombre" class="campo" autocomplete="off" aria-label="Nombre del grupo"${b.corriendo ? ' disabled' : ''}>
          <p class="chico" role="status">${esc(b.progreso || '')}</p><div class="err" role="alert">${esc(b.error || '')}</div>
          <div class="acciones"><button class="btn peligro" data-a="borrarOk" id="borrar-ok" disabled>Borrar todo</button><button class="btn" data-a="borrarNo"${b.corriendo ? ' disabled' : ''}>Cancelar</button></div></div>`;
      }
      h += '</div>';
    });
    return h || '<div class="tarj vacio chico">No hay álbumes.</div>';
  }

  function duplicados(lista) {
    const oc = ocultos(), vis = lista.filter(d => !oc.includes(d.gasto_a + '|' + d.gasto_b));
    if (!vis.length) return '<div class="tarj vacio chico">No hay gastos que parezcan duplicados.</div>';
    const lado = (d, x) => `<div class="lado"><b>${esc(d['desc_' + x])}</b><span class="chico">${esc(d['cuenta_' + x])}</span><span class="num b">${F.gs(d.monto)}</span>
      <span class="chico apagado">${esc(d['por_' + x] || '—')} · ${fechaHora(d['fecha_' + x])}</span><button class="btn mini-btn peligro" data-a="borrarGasto" data-id="${d['gasto_' + x]}">Borrar este</button></div>`;
    return '<p class="chico apagado">Mismo grupo y monto, con menos de 2 días de diferencia y la misma descripción o cuenta.</p>' + vis.map(d => {
      const k = d.gasto_a + '|' + d.gasto_b;
      return `<div class="tarj"><div class="ojo">${esc(d.grupo || '')}</div><div class="par">${lado(d, 'a')}${lado(d, 'b')}</div>
        <button class="btn chico" data-a="noDup" data-k="${k}">No es duplicado</button>
        ${[d.gasto_a, d.gasto_b].map(id => confirma('gasto:' + id, `¿Borrar "${id === d.gasto_a ? d.desc_a : d.desc_b}"? Se borra para todos los del grupo.`, 'borrarGastoOk', 'Borrar', ` data-id="${id}"`)).join('')}</div>`;
    }).join('');
  }

  function html() {
    let h = `<header class="sec-cab"><h1>Panel</h1><button class="btn chico" data-a="recargar"${U.cargando ? ' disabled' : ''}>${U.cargando ? 'Cargando…' : 'Actualizar'}</button></header>
      <div class="seg" role="group" aria-label="Parte del panel">${[['resumen', 'Resumen'], ['usuarios', 'Usuarios'], ['albumes', 'Álbumes'], ['duplicados', 'Duplicados']].map(o =>
        `<button data-a="sub" data-v="${o[0]}" aria-pressed="${U.sub === o[0]}">${o[1]}</button>`).join('')}</div>`;
    if (U.error) h += `<p class="err">${esc(U.error)}</p>`;
    if (!U.d) return h + (U.cargando ? '<p class="chico apagado">Cargando…</p>' : '');
    if (U.sub === 'resumen') h += resumen(U.d.resumen);
    if (U.sub === 'usuarios') h += usuarios(U.d.usuarios);
    if (U.sub === 'albumes') h += albumes(U.d.albumes);
    if (U.sub === 'duplicados') h += duplicados(U.d.duplicados);
    return h;
  }

  async function hacer(fn) { U.conf = null; await fn(); await cargar(); }
  const acciones = {
    sub: b => { U.sub = b.dataset.v; U.conf = null; dibujar(); },
    recargar: cargar,
    cancelar: () => { U.conf = null; dibujar(); },
    rol: b => hacer(() => Api.rpc('panel_cambiar_rol', { p_album: b.dataset.al, p_user: b.dataset.u, p_rol: b.dataset.r })),
    sacar: b => { U.conf = 'sacar:' + b.dataset.k; dibujar(); },
    sacarOk: b => hacer(() => Api.rpc('panel_sacar', { p_album: b.dataset.al, p_user: b.dataset.u })),
    bloquear: b => { U.conf = 'bloq:' + b.dataset.u; dibujar(); },
    bloquearOk: b => hacer(() => Api.rpc('panel_bloquear', { p_user: b.dataset.u })),
    abrir: b => UI.abrirAlbum(b.dataset.id),
    invitacion: b => Pestanas.copiar(location.origin + location.pathname + '?codigo=' + b.dataset.c, 'Invitación copiada'),
    borrar: b => { U.borrar = { id: b.dataset.id }; dibujar(); },
    borrarNo: () => { U.borrar = null; dibujar(); },
    borrarOk: async () => {
      const b = U.borrar, a = U.d.albumes.find(x => x.album_id === b.id);
      if ($('borrar-nombre').value.trim() !== (a.grupo || '').trim()) return;
      b.corriendo = true; b.error = ''; b.progreso = 'Borrando fotos…'; dibujar();
      try {
        // Primero las fotos (si no, quedan huérfanas en el Storage) y recién después el álbum
        const n = await Api.borrarFotosDe(b.id, k => { b.progreso = `Borrando fotos… ${k}`; dibujar(); });
        b.progreso = `${n} fotos borradas. Borrando el álbum…`; dibujar();
        await Api.rpc('panel_borrar_album', { p_album: b.id });
      } catch (e) { b.corriendo = false; b.error = e.message; dibujar(); return; }
      U.borrar = null; Vistas.toast('Álbum borrado');
      if (Estado.E.albumId === b.id) { UI.alCambiarAlbum && UI.alCambiarAlbum(); return; }
      await cargar();
    },
    borrarGasto: b => { U.conf = 'gasto:' + b.dataset.id; dibujar(); },
    borrarGastoOk: b => hacer(async () => { if (!(await Api.borrar('gastos', b.dataset.id)).length) throw new Error('No se pudo borrar.'); Estado.quitarFilas('gastos', g => g.id === b.dataset.id); }),
    noDup: b => { ocultar(b.dataset.k); dibujar(); }
  };

  // El botón de borrar se habilita solo con el nombre exacto del grupo
  function alEscribir(e) {
    if (e.target.id !== 'borrar-nombre' || !U.borrar) return;
    const a = U.d.albumes.find(x => x.album_id === U.borrar.id);
    $('borrar-ok').disabled = e.target.value.trim() !== (a.grupo || '').trim();
  }

  Pestanas.registrar('panel', { html, acciones, alEscribir, alEntrar: () => { if (!U.d && !U.cargando) cargar(); }, ocupado: () => !!U.borrar });
  window.VistaPanel = { albumes: () => Api.rpc('panel_albumes') };
})();
