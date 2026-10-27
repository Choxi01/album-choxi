/* Post de una figurita pegada: foto entera, descripción y comentarios del grupo. Sube desde abajo a pantalla completa.
   Se redibuja por partes (cabecera, descripción, comentarios) para no perder lo que estás escribiendo. */
(function () {
  const S = Estado, R = Reglas, E = S.E, esc = Formato.esc;
  const $ = id => document.getElementById(id);
  const MAX_DESC = 280;
  const I = {
    atras: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    mas: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg>',
    der: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'
  };
  // fid: figurita abierta · vistos: comentarios ya dibujados (para animar solo los nuevos) · clave: lo que muestra la cabecera
  const P = { fid: null, si: 0, lid: null, editando: false, borrando: null, menu: null, vistos: null, clave: '', pidiendo: null, reloj: 0 };

  // Figuritas pegadas en el orden del álbum
  const orden = () => E.a.secciones.flatMap((sec, si) => sec.lugares.filter(l => S.pegadaEn(l.id)).map(l => ({ l, si, f: S.pegadaEn(l.id) })));
  function color(uid) {
    const p = E.personas.find(x => x.user_id === uid);
    return p ? Cuentas.contacto(p.id).color : '#555';
  }
  const av = (uid, chico) => `<span class="pp-av${chico ? ' chico' : ''}" style="background:${esc(color(uid))}" aria-hidden="true">${esc(S.apodo(uid).charAt(0).toUpperCase())}</span>`;
  function hace(iso) {
    const m = Math.round((Date.now() - new Date(iso)) / 6e4);
    if (m < 1) return 'recién';
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
  }
  function fecha(f) {
    const [y, m, d] = String(f.fecha_foto || f.created_at || '').slice(0, 10).split('-').map(Number);
    if (!y) return '';
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', y === new Date().getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function abrir(fid) {
    Object.assign(P, { fid, editando: false, borrando: null, menu: null, vistos: null, clave: '' });
    const yo = S.yo(), apodo = yo ? yo.apodo : 'vos';
    $('post').innerHTML = `<div class="post" id="pp" role="dialog" aria-modal="true" aria-labelledby="pp-tit"><div class="pp-col">
      <div class="pp-barra"><button class="pp-ic" id="pp-volver" aria-label="Volver al álbum">${I.atras}</button>
        <h2 class="pp-tit" id="pp-tit"></h2><button class="pp-ic" id="pp-mas" aria-label="Más opciones" aria-haspopup="dialog">${I.mas}</button></div>
      <div class="pp-scroll" id="pp-scroll"><div id="pp-cab"></div><div class="pp-texto" id="pp-desc"></div><div class="pp-sep"></div><div class="pp-coms" id="pp-coms"></div></div>
      <form class="pp-pie" id="pp-form">${av(E.uid)}
        <input id="pp-in" type="text" maxlength="300" placeholder="Comentá como ${esc(apodo)}…" aria-label="Escribir un comentario" autocomplete="off" enterkeyhint="send">
        <button class="pp-pub" id="pp-pub" type="submit" disabled>Publicar</button></form>
    </div><div id="pp-menu"></div></div>`;
    $('pp-volver').onclick = cerrar;
    $('pp-mas').onclick = () => menu('inicio');
    const inp = $('pp-in');
    inp.oninput = () => { $('pp-pub').disabled = !inp.value.trim(); };
    $('pp-form').onsubmit = e => {
      e.preventDefault(); const t = inp.value.trim(); if (!t) return;
      inp.value = ''; $('pp-pub').disabled = true;
      S.comentar(P.fid, t).catch(err => { Vistas.toast(err.message); if (!inp.value) { inp.value = t; $('pp-pub').disabled = false; } });
    };
    $('pp-cab').addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) ir(+b.dataset.ir); });
    let x0 = null, y0 = null; const cab = $('pp-cab');
    cab.addEventListener('touchstart', e => { if (!e.target.closest('.pp-foto')) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    cab.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) ir(dx < 0 ? 1 : -1);
    }, { passive: true });
    $('pp-desc').addEventListener('click', clicDesc);
    $('pp-coms').addEventListener('click', clicComs);
    if (window.visualViewport) { visualViewport.addEventListener('resize', teclado); visualViewport.addEventListener('scroll', teclado); teclado(); }
    P.reloj = setInterval(() => P.fid && pintarComs(S.fig(P.fid)), 60e3); // para que "hace X min" no quede viejo
    history.pushState({ post: true }, '');
    pintar(); traer();
    $('pp-volver').focus();
  }

  // El teclado del celu achica la parte visible: el post se ajusta a ella para que el campo no quede tapado.
  function teclado() {
    const pp = $('pp'); if (!pp) return;
    pp.style.height = visualViewport.height + 'px'; pp.style.top = visualViewport.offsetTop + 'px';
  }

  // Sacar el post de la pantalla. Vuelve a la página de la última figurita vista.
  function quitar() {
    if (!P.fid) return;
    const si = P.si, lid = P.lid;
    P.fid = null; clearInterval(P.reloj);
    if (window.visualViewport) { visualViewport.removeEventListener('resize', teclado); visualViewport.removeEventListener('scroll', teclado); }
    $('post').innerHTML = '';
    if (!$('app').hidden && UI.actual !== si + 1) { UI.actual = si + 1; Vistas.pintar(); }
    const b = Vistas.libro().querySelector(`[data-id="${lid}"]`); if (b) b.focus();
  }
  function cerrar() {
    if (!P.fid) return;
    quitar();
    if (history.state && history.state.post) history.back();
  }

  function ir(d) {
    const lista = orden(), i = lista.findIndex(x => x.f.id === P.fid), x = lista[i + d];
    if (i < 0 || !x) return;
    Object.assign(P, { fid: x.f.id, editando: false, borrando: null, vistos: null });
    cerrarMenu(); pintar(); traer();
    $('pp-scroll').scrollTop = 0;
  }

  // Comentarios completos de la figurita abierta (al abrirla, al pasar a otra y si una recarga los dejó sin texto)
  function traer() {
    const fid = P.fid; if (!fid || P.pidiendo === fid) return;
    P.pidiendo = fid;
    S.traerComentarios(fid).catch(e => Vistas.toast(e.message)).then(() => { if (P.pidiendo === fid) P.pidiendo = null; });
  }

  function pintar() {
    if (!P.fid) return;
    const f = S.fig(P.fid), r = f && f.lugar_id && R.buscar(E.a, f.lugar_id);
    if (!r) return cerrar(); // la despegaron o la tiraron
    P.si = r.si; P.lid = r.l.id;
    pintarCab(f, r);
    if (!P.editando) pintarDesc(f);
    pintarComs(f);
  }

  function pintarCab(f, r) {
    const lista = orden(), i = lista.findIndex(x => x.f.id === f.id), pag = lista.filter(x => x.si === r.si);
    const s = r.s.p, l = r.l, lugar = l.nombre || 'Sin nombre', url = Api.verUrl(f.foto_path);
    const clave = [f.id, url, r.n, lugar, l.detalle, s.titulo, s.color, f.subida_por, i, lista.length, pag.length, color(f.subida_por)].join('|');
    if (clave === P.clave) return;
    P.clave = clave;
    $('pp-tit').textContent = `Figurita N.º ${r.n}`;
    $('pp').setAttribute('aria-label', `Figurita ${r.n}: ${lugar}`);
    $('pp-cab').innerHTML = `<div class="pp-autor">${av(f.subida_por)}<div class="pp-q"><b class="pp-lugar">${esc(lugar)}</b>
        <small>${[l.detalle, 'Pág. ' + (r.si + 1), s.titulo].filter(Boolean).map(esc).join(' · ')}</small></div></div>
      <div class="pp-foto"><span class="pp-marco" id="pp-marco"><img id="pp-img" alt="Selfie en ${esc(lugar)}"${url ? ` src="${esc(url)}"` : ''}>
        <span class="pp-plate" style="--c:${esc(s.color)}"><span class="n">${r.n}</span><span>${esc(lugar)}</span></span></span>
        ${i > 0 ? `<button class="pp-flecha izq" data-ir="-1" aria-label="Figurita anterior">${I.atras}</button>` : ''}
        ${i < lista.length - 1 ? `<button class="pp-flecha der" data-ir="1" aria-label="Figurita siguiente">${I.der}</button>` : ''}</div>
      <div class="pp-puntos" aria-hidden="true">${pag.map(x => `<i class="${x.f.id === f.id ? 'on' : ''}"></i>`).join('')}</div>`;
    const img = $('pp-img'), lista2 = () => $('pp-marco') && $('pp-marco').classList.add('lista');
    img.onload = lista2; if (img.complete && img.naturalWidth) lista2();
    // Foto grande firmada; de paso se firman y bajan la anterior y la siguiente para pasar sin espera.
    const vecinas = [lista[i - 1], lista[i + 1]].filter(Boolean).map(x => x.f.foto_path);
    Api.firmar([f.foto_path, ...vecinas]).then(() => {
      if (P.fid === f.id && !url) { P.clave = ''; pintar(); }
      vecinas.forEach(p => { new Image().src = Api.verUrl(p); });
    }).catch(e => Vistas.toast(e.message));
  }

  function pintarDesc(f) {
    let h;
    if (P.editando) {
      h = `<div class="pp-editor"><textarea id="pp-desc-in" maxlength="${MAX_DESC}" aria-label="Descripción de la foto" placeholder="Contá algo de esta salida…">${esc(f.descripcion)}</textarea>
        <div class="pp-fila"><span class="pp-cuenta" id="pp-cuenta" aria-live="polite">${f.descripcion.length}/${MAX_DESC}</span>
        <button type="button" class="btn" data-d="cancelar">Cancelar</button><button type="button" class="btn pri" data-d="guardar">Guardar</button></div></div>`;
    } else if (f.descripcion) {
      h = `<p class="pp-caption"><b>${esc(S.apodo(f.subida_por))}</b>${esc(f.descripcion)}${S.puedeDescribir(f) ? ' <button class="pp-link" data-d="editar">Editar</button>' : ''}</p>`;
    } else h = f.subida_por === E.uid ? '<button class="pp-agregar" data-d="editar">+ Agregar una descripción</button>' : '';
    $('pp-desc').innerHTML = h + `<p class="pp-meta">Subida por ${esc(S.apodo(f.subida_por))}${f.pegada_por ? ` · Pegada por ${esc(S.apodo(f.pegada_por))}` : ''}${fecha(f) ? ' · ' + esc(fecha(f)) : ''}</p>`;
    const t = $('pp-desc-in');
    if (t) {
      t.oninput = () => { $('pp-cuenta').textContent = `${t.value.length}/${MAX_DESC}`; };
      t.focus(); t.setSelectionRange(t.value.length, t.value.length);
    }
  }
  function editar(si) {
    P.editando = si; pintarDesc(S.fig(P.fid));
    if (!si) { const b = $('pp-desc').querySelector('[data-d="editar"]'); if (b) b.focus(); }
  }
  function clicDesc(e) {
    const b = e.target.closest('[data-d]'); if (!b) return;
    const a = b.dataset.d;
    if (a === 'editar') return editar(true);
    if (a === 'cancelar') return editar(false);
    const fid = P.fid, texto = $('pp-desc-in').value;
    editar(false);
    S.describir(fid, texto).then(() => Vistas.toast('Descripción guardada')).catch(err => Vistas.toast(err.message));
  }

  function pintarComs(f) {
    if (!f) return;
    const cs = S.comentarios(f.id), box = $('pp-coms');
    if (cs.some(c => c.texto == null)) { traer(); box.innerHTML = '<h3>Comentarios</h3><p class="pp-vacio">Cargando comentarios…</p>'; return; }
    const primera = !P.vistos, nuevos = primera ? [] : cs.filter(c => !P.vistos.has(c.id));
    P.vistos = new Set(cs.map(c => c.id));
    const sc = $('pp-scroll'), y = sc.scrollTop, foco = document.activeElement && box.contains(document.activeElement) ? document.activeElement.dataset : null;
    box.innerHTML = `<h3>${cs.length ? `${cs.length} ${cs.length === 1 ? 'comentario' : 'comentarios'}` : 'Comentarios'}</h3>` + (cs.length ? cs.map(c =>
      `<div class="pp-com${nuevos.includes(c) ? ' nuevo' : ''}">${av(c.user_id, true)}<div class="pp-cuerpo"><b>${esc(S.apodo(c.user_id))}</b>${esc(c.texto)}
        <div class="pp-sub"><span>${hace(c.created_at)}</span>${S.puedeBorrarCom(c) ? `<button data-borrar="${c.id}">Borrar</button>` : ''}</div>
        ${P.borrando === c.id ? `<div class="pp-conf"><span>¿Borrar este comentario?</span><button class="btn peligro" data-si="${c.id}">Borrar</button><button class="btn" data-no="1">No</button></div>` : ''}</div></div>`).join('')
      : '<p class="pp-vacio">Todavía nadie comentó. Arrancá vos.</p>');
    if (nuevos.some(c => c.user_id === E.uid)) sc.scrollTop = sc.scrollHeight; else sc.scrollTop = y;
    if (foco) { const k = Object.keys(foco)[0], b = k && box.querySelector(`[data-${k}="${foco[k]}"]`); if (b) b.focus(); }
  }
  function clicComs(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.borrar) { P.borrando = b.dataset.borrar; pintarComs(S.fig(P.fid)); const si = $('pp-coms').querySelector('[data-si]'); if (si) { si.focus({ preventScroll: true }); si.scrollIntoView({ block: 'nearest' }); } return; }
    if (b.dataset.no) { P.borrando = null; pintarComs(S.fig(P.fid)); return; }
    if (b.dataset.si) { P.borrando = null; S.borrarComentario(b.dataset.si).catch(err => Vistas.toast(err.message)); }
  }

  // Menú ⋯: hoja desde abajo dentro del post
  function menu(paso) {
    const f = S.fig(P.fid); if (!f) return;
    const cs = Cuentas.deLugar(f.lugar_id); // vienen de la más reciente a la más vieja
    P.menu = paso;
    $('pp-menu').innerHTML = `<div class="pp-velo" id="pp-velo"><div class="pp-hoja" role="dialog" aria-modal="true" aria-label="Opciones">${paso === 'despegar'
      ? `<p>La figurita vuelve abajo, a "Sin pegar". La descripción y los comentarios se mantienen.</p>
         <button class="peligro" data-m="si">Despegar</button><button data-m="no">Cancelar</button>`
      : `${cs.length ? '<button data-m="gastos">Ver gastos de esta salida</button>' : ''}<button class="peligro" data-m="despegar">Despegar figurita</button><button data-m="no">Cancelar</button>`}</div></div>`;
    $('pp-velo').onclick = e => {
      if (e.target.id === 'pp-velo') return cerrarMenu();
      const b = e.target.closest('[data-m]'); if (!b) return;
      const a = b.dataset.m;
      if (a === 'no') return cerrarMenu();
      if (a === 'despegar') return menu('despegar');
      if (a === 'gastos') { cerrar(); return VistaCuentas.abrirCuenta(cs[0].id); }
      const fid = P.fid; cerrar(); S.despegar(fid).catch(err => Vistas.toast(err.message));
    };
    $('pp-menu').querySelector('button').focus();
  }
  function cerrarMenu() {
    if (!P.menu) return;
    P.menu = null; $('pp-menu').innerHTML = '';
    const b = $('pp-mas'); if (b) b.focus();
  }

  // Escape y "atrás" de Android: primero cierran el menú o la edición; después, el post.
  function atras() {
    if (P.menu) { cerrarMenu(); return true; }
    if (P.editando) { editar(false); return true; }
    return false;
  }
  window.addEventListener('popstate', () => {
    if (!P.fid) return;
    if (atras()) history.pushState({ post: true }, ''); else quitar();
  });
  document.addEventListener('keydown', e => {
    if (!P.fid) return;
    if (e.key === 'Escape') { e.preventDefault(); if (!atras()) cerrar(); return; }
    if (P.menu || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (e.key === 'ArrowRight') ir(1); else if (e.key === 'ArrowLeft') ir(-1);
  });

  window.VistaPost = { abrir, pintar, quitar };
})();
