/* Dibujo: entrada, álbum (tapa y páginas), cajón, paneles y apertura de sobre. */
(function () {
  const S = Estado, R = Reglas, E = S.E;
  const $ = id => document.getElementById(id);
  const val = id => $(id).value.trim();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hex = v => /^#[0-9a-f]{6}$/i.test(v);
  const rot = n => ((n * 37) % 7 - 3) * .5;
  const bg = u => u ? `background-image:url('${u}')` : '';
  const PRESETS = [
    { n: 'Noche dorada', acento: '#c9a96e', tapa: '#111217' },
    { n: 'Plata', acento: '#c3c8d2', tapa: '#0f1115' },
    { n: 'Bordó', acento: '#d9b48a', tapa: '#2a1015' },
    { n: 'Esmeralda', acento: '#d6c08a', tapa: '#0d1f1a' }];

  // Estado de la interfaz (compartido con arrastre.js)
  const UI = { actual: 0, animando: false, pendiente: false, modoDis: false, sel: null, arrastrando: false,
    alSalir: () => {}, alCambiarAlbum: null };

  const A = () => E.a, secs = () => A().secciones, nSec = () => secs().length, nPag = () => nSec() + 1;
  const et = f => R.etiqueta(A(), f, S.D().acento);
  const puede = (f, lid) => R.puede(A(), f, lid);
  const mini = f => Api.verUrl(S.miniPath(f));
  const pegadas = () => [...A().pos.keys()].filter(lid => A().ocupados.has(lid)).length;
  const fechaLinda = s => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
  const fechaLocal = iso => iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const mono = () => { const d = S.D(); return d.mono || R.iniciales(d.nombre); };
  const intentar = p => Promise.resolve(p).catch(e => toast(e.message));

  /* ───────── Pantallas fuera del álbum ───────── */
  function pantalla(html) {
    $('app').hidden = true; cerrar(); $('capa').innerHTML = '';
    $('pantalla').hidden = false;
    $('pantalla').innerHTML = `<div class="panel caja"><div class="mono chico" aria-hidden="true">AC</div>${html}</div>`;
  }
  function cargando(texto) { pantalla(`<p class="meta centro">${esc(texto || 'Abriendo el álbum…')}</p>`); }
  function errorCarga(texto, reintentar) {
    pantalla(`<h4>No se pudo abrir</h4><p class="aviso">${esc(texto)}</p><button class="btn pri" id="b-re">Reintentar</button>`);
    $('b-re').onclick = reintentar;
  }

  function login() {
    let email = '', espera = 0, reloj = null;
    const paso1 = (error) => {
      pantalla(`<h4 id="ph">Álbum Choxi</h4><div class="meta">Entrá con tu mail. Te mandamos un link y un código, sin contraseña.</div>
        <form id="f" class="lista"><label for="l-mail">Tu mail<input type="email" id="l-mail" autocomplete="email" inputmode="email" required value="${esc(email)}"></label>
        <button class="btn pri" id="l-env">Mandame el código</button></form><p class="aviso" id="l-av"${error ? '' : ' hidden'}>${esc(error || '')}</p>`);
      $('f').onsubmit = async e => {
        e.preventDefault(); email = val('l-mail').toLowerCase(); if (!email) return;
        $('l-env').disabled = true;
        try { await Api.enviarCodigo(email); espera = 60; paso2(); }
        catch (err) { $('l-env').disabled = false; $('l-av').hidden = false; $('l-av').textContent = err.message; }
      };
    };
    const paso2 = () => {
      pantalla(`<h4 id="ph">Revisá tu mail</h4>
        <div class="meta">Te mandamos un mail a <b>${esc(email)}</b>. Tocá el link desde este celu o escribí acá el código de 6 dígitos.</div>
        <form id="f" class="lista"><label for="l-cod">Código<input type="text" id="l-cod" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required></label>
        <button class="btn pri" id="l-ok">Entrar</button></form><p class="aviso" id="l-av" hidden></p>
        <div class="acciones"><button class="btn" id="l-otro"></button><button class="btn" id="l-mail2">Cambiar mail</button></div>`);
      const reenv = $('l-otro');
      const tic = () => { reenv.disabled = espera > 0; reenv.textContent = espera > 0 ? `Pedir otro (${espera})` : 'Pedir otro'; if (espera > 0) espera--; };
      clearInterval(reloj); tic(); reloj = setInterval(() => { if (!$('l-otro')) return clearInterval(reloj); tic(); }, 1000);
      const av = t => { $('l-av').hidden = false; $('l-av').textContent = t; };
      $('f').onsubmit = async e => {
        e.preventDefault(); const cod = val('l-cod').replace(/\s/g, ''); if (!cod) return;
        $('l-ok').disabled = true;
        try { await Api.verificar(email, cod); } catch (err) { $('l-ok').disabled = false; av(err.message); }
      };
      reenv.onclick = async () => { try { await Api.enviarCodigo(email); espera = 60; tic(); av('Listo, te mandamos otro.'); } catch (err) { av(err.message); } };
      $('l-mail2').onclick = () => { clearInterval(reloj); paso1(); };
      $('l-cod').focus();
    };
    paso1();
  }

  function bienvenida(codigo, alListo) {
    pantalla(`<h4 id="ph">¡Hola!</h4><div class="meta">${codigo ? 'Te invitaron a un álbum. Poné tu apodo y entrá.' : 'Todavía no estás en ningún álbum.'}</div>
      <label for="b-apodo">Tu apodo<input type="text" id="b-apodo" maxlength="30" placeholder="Ej: Beto"></label>
      <div class="sub">Unirme con un código</div>
      <label for="b-cod">Código de invitación<input type="text" id="b-cod" maxlength="20" value="${esc(codigo || '')}" autocapitalize="off"></label>
      <button class="btn${codigo ? ' pri' : ''}" id="b-unir">Unirme</button>
      <div class="sub">O empezar uno nuevo</div>
      <button class="btn${codigo ? '' : ' pri'}" id="b-crear">Crear un álbum</button>
      <p class="aviso" id="b-av" hidden></p>`);
    const av = t => { $('b-av').hidden = false; $('b-av').textContent = t; };
    const hacer = async (fn) => {
      const ap = val('b-apodo'); if (!ap) { av('Poné tu apodo.'); $('b-apodo').focus(); return; }
      $('b-unir').disabled = $('b-crear').disabled = true;
      try { alListo(await fn(ap)); } catch (e) { $('b-unir').disabled = $('b-crear').disabled = false; av(e.message); }
    };
    $('b-unir').onclick = () => { const c = val('b-cod'); if (!c) { av('Escribí el código.'); return; } hacer(ap => Api.rpc('unirse', { p_codigo: c, p_apodo: ap })); };
    $('b-crear').onclick = () => hacer(ap => Api.rpc('crear_album', { p_apodo: ap }));
  }

  function elegirAlbum(lista, alElegir) {
    pantalla(`<h4 id="ph">Tus álbumes</h4><div class="lista">${lista.map(m => {
      const d = Object.assign({}, S.DIS, m.albumes && m.albumes.diseno);
      return `<button class="item" data-a="${m.album_id}"><i class="sw" style="background:${esc(d.acento)}"></i><span class="nom"><b>${esc(d.titulo)}</b><small>${esc(d.nombre)} · ${esc(m.apodo)}</small></span></button>`;
    }).join('')}</div>`);
    $('pantalla').querySelectorAll('[data-a]').forEach(b => b.onclick = () => alElegir(b.dataset.a));
  }

  /* ───────── Álbum ───────── */
  function mostrarAlbum() {
    $('pantalla').hidden = true; $('pantalla').innerHTML = ''; $('app').hidden = false;
    UI.actual = 0; UI.sel = null; UI.modoDis = false;
    $('b-modo').setAttribute('aria-pressed', 'false'); $('modo').hidden = true;
    pintar();
  }

  function aplicar() {
    const r = document.documentElement.style, d = S.D();
    if (hex(d.acento)) r.setProperty('--acento', d.acento);
    if (hex(d.tapa)) r.setProperty('--tapa', d.tapa);
    $('tit').textContent = d.titulo; document.title = d.titulo;
    $('b-modo').hidden = !S.esAdmin();
    if (!S.esAdmin() && UI.modoDis) { UI.modoDis = false; $('modo').hidden = true; }
  }

  function paginaHTML(i, recien) {
    const d = S.D();
    if (i === 0) {
      return `<section class="hoja tapa" aria-label="Tapa">
        ${UI.modoDis ? '<button class="editar" data-tapa="1">Editar portada</button>' : ''}
        <div class="marco"><i class="esq a"></i><i class="esq b"></i><i class="esq c"></i><i class="esq d"></i>
          <div class="edicion">${esc(d.edicion)}</div>
          <div class="mono" aria-hidden="true">${esc(mono())}</div>
          <h2>${esc(d.titulo)}</h2>
          <div class="regla" aria-hidden="true"><i></i>◆<i></i></div>
          <div class="grupo">${esc(d.nombre)}</div>
          <div class="lema">${esc(d.lema)}</div>
          <div class="pie"><span>${nSec()} ${nSec() === 1 ? 'sección' : 'secciones'} · ${A().total} figuritas</span><span><b>${pegadas()}</b> pegadas</span></div>
        </div></section>`;
    }
    const si = i - 1, sec = secs()[si]; if (!sec) return '';
    const s = sec.p; let hechas = 0;
    const cs = UI.sel && S.fig(UI.sel);
    const cel = sec.lugares.map(l => {
      const n = R.numero(A(), l.id), f = S.pegadaEn(l.id);
      if (f) {
        hechas++;
        return `<button class="figu${s.brillante ? ' brillante' : ''}${recien === l.id ? ' recien' : ''}" style="--c:${s.color};--r:${rot(n)}deg" data-id="${l.id}" aria-label="Figurita ${n}: ${esc(l.nombre || 'sin nombre')}">
          <span class="foto" style="${bg(mini(f))}"></span>
          <span class="pl"><span class="n">${n}</span><span class="t">${esc(l.nombre || 'Sin nombre')}</span></span></button>`;
      }
      const sin = !l.nombre, marca = cs ? (puede(cs, l.id) ? ' destino' : ' apagar') : '';
      return `<button class="hueco${sin ? ' sin' : ''}${marca}" data-id="${l.id}" style="--c:${s.color}" aria-label="Lugar vacío ${n}: ${esc(l.nombre || 'sin nombre')}">
        <span class="n">${n}</span><span class="logo">${sin ? '+' : esc(R.iniciales(l.nombre))}</span>
        <span class="lug">${sin ? (UI.modoDis ? 'Ponerle nombre' : 'Por definir') : esc(l.nombre)}</span>${l.detalle ? `<span class="zona">${esc(l.detalle)}</span>` : ''}</button>`;
    }).join('');
    return `<section class="hoja${UI.modoDis ? ' modo-on' : ''}" aria-label="${esc(s.titulo)}">
      <div class="cab" style="--c:${s.color}"><span class="num">${String(i).padStart(2, '0')}</span>
        <div class="txt"><h3>${esc(s.titulo)}</h3>${s.bajada ? `<p>${esc(s.bajada)}</p>` : ''}</div>
        ${UI.modoDis ? `<button class="editar" data-sec="${si}">Editar</button>` : `<span class="tot">${hechas}/${sec.lugares.length}</span>`}</div>
      <div class="grilla">${cel}</div></section>`;
  }

  const libro = () => $('libro');
  function pintar(recien) {
    if ($('app').hidden || !A()) return;
    if (UI.animando) { UI.pendiente = true; return; } // se dibuja al terminar el pase de página
    aplicar();
    if (UI.actual >= nPag()) UI.actual = nPag() - 1;
    libro().innerHTML = paginaHTML(UI.actual, recien);
    const p = pegadas(), t = A().total;
    $('cont').innerHTML = `<b>${p}</b>/${t}`;
    $('bar').style.width = (t ? p / t * 100 : 0) + '%';
    $('ant').disabled = UI.actual === 0;
    $('sig').disabled = UI.actual === nPag() - 1;
    $('puntos').innerHTML = Array.from({ length: nPag() }, (_, i) => {
      const sec = secs()[i - 1], lleno = i > 0 && sec.lugares.length && sec.lugares.every(l => A().ocupados.has(l.id));
      return `<button data-p="${i}" class="${lleno ? 'lleno' : ''}" aria-current="${i === UI.actual}" aria-label="${esc(i === 0 ? 'Tapa' : sec.p.titulo)}"><i></i></button>`;
    }).join('');
    pintarMano();
  }

  function irA(i) {
    if (UI.animando || i === UI.actual || i < 0 || i >= nPag()) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, adelante = i > UI.actual, viejo = UI.actual, lb = libro();
    if (reduce || !lb.animate) { UI.actual = i; pintar(); return; }
    const fin = () => { UI.animando = false; if (UI.pendiente) { UI.pendiente = false; pintar(); } };
    const hoja = document.createElement('div'); hoja.className = 'vuelta'; hoja.style.cssText = 'position:absolute;inset:0';
    const dur = 800, ease = 'cubic-bezier(.45,.05,.3,1)';
    if (adelante) {
      UI.actual = i; pintar(); UI.animando = true;
      hoja.innerHTML = paginaHTML(viejo) + '<div class="sombra"></div>'; lb.appendChild(hoja);
      hoja.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], { duration: dur, easing: ease }).onfinish = () => { hoja.remove(); fin(); };
      hoja.querySelector('.sombra').animate([{ opacity: 0 }, { opacity: 1, offset: .45 }, { opacity: 0 }], { duration: dur });
    } else {
      UI.animando = true;
      hoja.innerHTML = paginaHTML(i) + '<div class="sombra"></div>'; lb.appendChild(hoja);
      hoja.animate([{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }], { duration: dur, easing: ease }).onfinish = () => { UI.actual = i; UI.animando = false; UI.pendiente = false; pintar(); };
      hoja.querySelector('.sombra').animate([{ opacity: 0 }, { opacity: 1, offset: .55 }, { opacity: 0 }], { duration: dur });
    }
  }

  /* Cajón de abajo: sobres y figuritas sin pegar */
  function cartaHTML(f, i, e) {
    e = e || et(f);
    return `<div class="carta${e.comodin ? ' comodin' : ''}${e.brillante ? ' brillante' : ''}" style="--c:${e.c};--i:${i}">
      <span class="foto" style="${bg(mini(f))}"></span><span class="tema">${esc(e.tema)}</span>
      <span class="pl"><span class="n">${esc(e.badge)}</span><span class="t">${esc(e.texto)}</span></span></div>`;
  }
  const miniHTML = (f, attr) => {
    const e = et(f);
    return `<button class="mini${e.comodin ? ' comodin' : ''}" ${attr}="${f.id}" style="--c:${e.c}" aria-pressed="${UI.sel === f.id}" aria-label="Figurita ${esc(e.texto)}, ${esc(e.tema)}">
      <span class="foto" style="${bg(mini(f))}"></span><span class="b">${esc(e.badge)}</span></button>`;
  };
  function pintarMano() {
    const t = $('tira'), mano = S.mano(), sobres = S.sobresCerrados();
    const sob = sobres.map(x => `<button class="sobre-mini" data-sobre="${x.s.id}" aria-label="Abrir sobre de ${x.figs.length} figuritas, de ${esc(S.apodo(x.s.creado_por))}"><b>${x.figs.length}</b><span>de ${esc(S.apodo(x.s.creado_por))}</span></button>`).join('');
    pintarAsa(mano.length, sobres.length);
    // No se redibuja la tira mientras se arrastra: en el celu eso corta el gesto.
    if (!UI.arrastrando) t.innerHTML = sob + mano.map(f => miniHTML(f, 'data-carta')).join('') || '<span class="vacio">Cargá fotos para armar un sobre. Las figuritas sin pegar quedan acá.</span>';
    const g = $('guia'), c = mano.find(x => x.id === UI.sel);
    if (Date.now() < aviso.hasta) return;
    if (!c) {
      UI.sel = null;
      g.innerHTML = mano.length ? '<span class="apagado">Arrastrá una figurita desde abajo hasta su lugar.</span>' : (sobres.length ? '<span class="apagado">Hay un sobre sin abrir. Tocalo para abrirlo.</span>' : '');
      return;
    }
    const e = et(c);
    g.innerHTML = `<span>${e.comodin ? '<b>Comodín:</b> pegala en cualquier lugar libre.' : e.n ? `Pegá la <b>N.º ${e.n}</b> en su lugar de la pág. ${e.si + 1}.` : `Pegala en cualquier lugar de la <b>pág. ${e.si + 1}</b>.`}</span><button id="b-editc">Editar</button><button id="b-soltar">Cancelar</button>`;
    $('b-soltar').onclick = () => { UI.sel = null; pintar(); };
    $('b-editc').onclick = () => editarCarta(c.id);
  }
  function pintarAsa(n, s) {
    $('asa-txt').innerHTML = n || s ? `Sin pegar <b>${n}</b>${s ? ` · ${s === 1 ? 'Sobre' : 'Sobres'} <b>${s}</b>` : ''}` : 'Sin pegar · cargar fotos';
  }
  let cajonAbierto = true;
  try { cajonAbierto = localStorage.getItem('album_choxi_cajon') !== '0'; } catch (_) {}
  function cajon(abrir) {
    cajonAbierto = abrir;
    try { localStorage.setItem('album_choxi_cajon', abrir ? '1' : '0'); } catch (_) {}
    $('cajon-cuerpo').classList.toggle('cerrado', !abrir);
    $('b-asa').setAttribute('aria-expanded', abrir);
    $('cajon-cuerpo').inert = !abrir;
  }
  function aviso(t) {
    const g = $('guia'); g.innerHTML = `<span>${esc(t)}</span>`;
    aviso.hasta = Date.now() + 2200; clearTimeout(aviso.t); aviso.t = setTimeout(pintarMano, 2250);
  }
  aviso.hasta = 0;
  function toast(t) {
    const el = $('toast'); el.textContent = t; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 4000);
  }

  function elegir(id) {
    UI.sel = UI.sel === id ? null : id;
    const c = UI.sel && S.fig(UI.sel);
    if (c) {
      const e = et(c);
      if (e.si >= 0 && UI.actual !== e.si + 1) { pintarMano(); irA(e.si + 1); return; }
      if (e.si < 0 && UI.actual === 0) { pintarMano(); irA(1); return; }
    }
    pintar();
  }
  function pegar(fid, lid) { UI.sel = null; intentar(S.pegar(fid, lid)); }

  /* ───────── Paneles ───────── */
  const modal = () => $('modal');
  function cerrar() { modal().innerHTML = ''; panel.alCerrar = null; }
  function panel(html, claro) {
    modal().innerHTML = `<div class="velo${claro ? ' claro' : ''}" id="velo"><div class="panel" role="dialog" aria-modal="true" aria-labelledby="ph">${html}</div></div>`;
    $('velo').onclick = e => { if (e.target.id === 'velo') (panel.alCerrar || cerrar)(); };
  }
  const campo = (id, l, v, max, ph) => `<label for="${id}">${l}<input type="text" id="${id}" value="${esc(v)}" maxlength="${max || 40}"${ph ? ` placeholder="${esc(ph)}"` : ''}></label>`;
  function confirmar(texto, si, accion) {
    $('conf').innerHTML = `<div class="confirma"><span>${esc(texto)}</span>
      <div class="acciones"><button class="btn peligro" id="si">${si}</button><button class="btn" id="nn">No</button></div></div>`;
    $('si').onclick = accion; $('nn').onclick = () => $('conf').innerHTML = '';
  }
  function avisar(t) { cerrar(); panel(`<h4 id="ph">Atención</h4><p style="margin:0">${esc(t)}</p><button class="btn" id="b-cerrar">Entendido</button>`); $('b-cerrar').onclick = cerrar; }

  // Detalle de un lugar: foto grande, quién la subió y quién la pegó. En modo diseño, el nombre del lugar.
  function abrir(lid) {
    cerrar(); const r = R.buscar(A(), lid); if (!r) return;
    const { l, n } = r, f = S.pegadaEn(lid), dis = UI.modoDis;
    const ok = f ? [] : S.mano().filter(c => puede(c, lid));
    panel(`${f ? `<div class="grande" id="grande" style="${bg(mini(f))}" role="img" aria-label="Selfie en ${esc(l.nombre || 'lugar sin nombre')}"></div>` : ''}
      <h4 id="ph">N.º ${n} · ${esc(l.nombre || 'Sin nombre')}</h4>
      ${l.detalle || (f && f.fecha_foto) ? `<div class="meta">${esc(l.detalle)}${l.detalle && f && f.fecha_foto ? ' · ' : ''}${f ? fechaLinda(f.fecha_foto) : ''}</div>` : ''}
      ${f ? `<div class="meta">Subida por ${esc(S.apodo(f.subida_por))}${f.pegada_por ? ` · Pegada por ${esc(S.apodo(f.pegada_por))}` : ''}${f.pegada_at ? ' · ' + fechaLocal(f.pegada_at) : ''}</div>` : ''}
      ${dis ? `<div class="sub">Modo diseño</div>${campo('in-lugar', 'Nombre del lugar', l.nombre, 40, 'Ej: Costanera')}${campo('in-zona', 'Detalle', l.detalle, 40, 'Ej: Asunción')}` : ''}
      ${f ? '' : ok.length ? `<div class="sub">Podés pegar acá</div><div class="tira" style="min-height:0">${ok.map(c => miniHTML(c, 'data-pegar')).join('')}</div>`
        : `<p class="meta" style="margin:0">No hay figuritas sin pegar para este lugar. Cargá fotos con el botón + para armar un sobre.</p>`}
      <div class="acciones">
        ${dis ? '<button class="btn" id="b-guardar">Guardar</button>' : ''}
        ${f ? '<button class="btn peligro" id="b-despegar">Despegar</button>' : ''}
        <button class="btn chico" id="b-cerrar" aria-label="Cerrar">✕</button></div>
      <div id="conf"></div>`);
    const guardar = () => dis && intentar(S.guardarLugar(lid, { nombre: val('in-lugar'), detalle: val('in-zona') }));
    modal().querySelectorAll('[data-pegar]').forEach(b => b.onclick = () => { guardar(); cerrar(); pegar(b.dataset.pegar, lid); });
    $('b-cerrar').onclick = cerrar;
    if ($('b-guardar')) $('b-guardar').onclick = () => { guardar(); cerrar(); };
    if (f) {
      Api.firmar([f.foto_path]).then(() => { const g = $('grande'); if (g) g.style.backgroundImage = `url('${Api.verUrl(f.foto_path)}')`; }).catch(() => {});
      $('b-despegar').onclick = () => confirmar(`¿Despegar la figurita ${n}? Vuelve abajo, a las figuritas sin pegar.`, 'Despegar',
        () => { cerrar(); intentar(S.despegar(f.id)); });
    }
  }

  function editarTapa() {
    cerrar(); const d = S.D();
    panel(`<h4 id="ph">Portada</h4>
      ${campo('t-edi', 'Línea de edición', d.edicion, 50)}${campo('t-tit', 'Título', d.titulo, 40)}${campo('t-nom', 'Nombre del grupo', d.nombre, 30)}
      ${campo('t-lema', 'Frase', d.lema, 60)}${campo('t-mono', 'Monograma (vacío = iniciales del grupo)', d.mono, 3)}
      <div class="acciones"><button class="btn pri" id="ok">Guardar</button><button class="btn" id="no">Cancelar</button></div>`);
    $('no').onclick = cerrar;
    $('ok').onclick = () => {
      intentar(S.guardarDiseno(Object.assign(d, { edicion: val('t-edi'), titulo: val('t-tit') || S.DIS.titulo, nombre: val('t-nom') || 'Mi grupo', lema: val('t-lema'), mono: val('t-mono') })));
      cerrar();
    };
  }

  function editarSeccion(si) {
    cerrar(); const s = secs()[si].p;
    panel(`<h4 id="ph">Página ${si + 1}</h4>${campo('s-tit', 'Título', s.titulo, 30)}${campo('s-sub', 'Bajada', s.bajada, 40)}
      <label class="fila-color" for="s-c"><span>Color de la página</span><input type="color" id="s-c" value="${s.color}"></label>
      <label class="check" for="s-br"><input type="checkbox" id="s-br"${s.brillante ? ' checked' : ''}>Figuritas brillantes (borde dorado)</label>
      <div class="acciones"><button class="btn pri" id="ok">Guardar</button><button class="btn" id="no">Cancelar</button></div>`);
    $('no').onclick = cerrar;
    $('ok').onclick = () => {
      const c = { titulo: val('s-tit') || 'Sección ' + (si + 1), bajada: val('s-sub'), brillante: $('s-br').checked };
      if (hex($('s-c').value)) c.color = $('s-c').value;
      intentar(S.guardarPagina(s.id, c)); cerrar();
    };
  }

  function paginas() {
    cerrar();
    const fila = (sec, i) => {
      const s = sec.p, pg = sec.lugares.filter(l => A().ocupados.has(l.id)).length;
      return `<div class="item"><i class="sw" style="background:${s.color}"></i>
        <div class="nom"><b>${i + 1}. ${esc(s.titulo)}</b><small>${pg}/${sec.lugares.length} pegadas</small></div>
        <button class="ic" data-up="${i}" aria-label="Subir ${esc(s.titulo)}"${i === 0 ? ' disabled' : ''}>↑</button>
        <button class="ic" data-down="${i}" aria-label="Bajar ${esc(s.titulo)}"${i === nSec() - 1 ? ' disabled' : ''}>↓</button>
        <button class="ic peligro" data-del="${i}" aria-label="Eliminar ${esc(s.titulo)}"${nSec() === 1 ? ' disabled' : ''}>✕</button></div>`;
    };
    panel(`<h4 id="ph">Páginas</h4><div class="meta">Los números de las figuritas se acomodan solos al reordenar.</div>
      <div class="lista">${secs().map(fila).join('')}</div><div id="conf"></div>
      <div class="acciones"><button class="btn pri" id="add">Agregar página</button><button class="btn" id="b-cerrar">Listo</button></div>`);
    $('b-cerrar').onclick = cerrar;
    $('add').onclick = () => { $('add').disabled = true; intentar(S.agregarPagina()).then(paginas); };
    modal().querySelectorAll('[data-up],[data-down]').forEach(b => b.onclick = () => {
      const i = +(b.dataset.up ?? b.dataset.down), j = b.dataset.up !== undefined ? i - 1 : i + 1;
      const ids = secs().map(s => s.p.id), cur = UI.actual > 0 ? ids[UI.actual - 1] : null;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      intentar(S.ordenar(ids));
      if (cur) UI.actual = ids.indexOf(cur) + 1;
      paginas();
    });
    modal().querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const i = +b.dataset.del, sec = secs()[i], pg = sec.lugares.filter(l => A().ocupados.has(l.id)).length;
      confirmar(`¿Eliminar "${sec.p.titulo}"? ${pg ? `${pg === 1 ? 'La figurita pegada vuelve' : `Las ${pg} figuritas pegadas vuelven`} a "Sin pegar" como comodín. ` : ''}No se borra ninguna foto.`, 'Eliminar', async () => {
        $('si').disabled = true;
        await intentar(S.borrarPagina(sec.p.id));
        if (UI.actual - 1 === i) UI.actual = Math.max(0, i); else if (UI.actual - 1 > i) UI.actual--;
        paginas();
      });
    });
  }

  function colores() {
    cerrar();
    const d = S.D(), respaldo = JSON.stringify({ d, c: E.paginas.map(p => [p.id, p.color]) });
    const pags = secs().map(s => s.p);
    const revertir = () => { const r = JSON.parse(respaldo); E.album.diseno = r.d; r.c.forEach(([id, c]) => { const p = E.paginas.find(x => x.id === id); if (p) p.color = c; }); S.cambio(); cerrar(); };
    panel(`<h4 id="ph">Colores</h4><div class="meta">Los cambios se ven en vivo detrás de este panel.</div>
      <div class="sub">Estilos rápidos</div>
      <div class="presets">${PRESETS.map((p, i) => `<button class="preset" data-pre="${i}"><i style="background:${p.acento};box-shadow:inset 0 0 0 6px ${p.tapa}"></i>${p.n}</button>`).join('')}</div>
      <div class="sub">General</div>
      <label class="fila-color" for="c-acento"><span>Detalles (dorado)</span><input type="color" id="c-acento" value="${d.acento}"></label>
      <label class="fila-color" for="c-tapa"><span>Fondo de la tapa</span><input type="color" id="c-tapa" value="${d.tapa}"></label>
      <div class="sub">Páginas</div>
      ${pags.map((s, i) => `<label class="fila-color" for="c-s${i}"><span>${esc(s.titulo)}</span><input type="color" id="c-s${i}" value="${s.color}"></label>`).join('')}
      <div class="acciones"><button class="btn pri" id="ok">Guardar</button><button class="btn" id="no">Cancelar</button></div>
      <button class="btn peligro" id="reset">Volver a los colores originales</button><div id="conf"></div>`, true);
    panel.alCerrar = revertir;
    const vivo = () => {
      const a = $('c-acento').value, t = $('c-tapa').value;
      E.album.diseno = Object.assign({}, d, hex(a) && { acento: a }, hex(t) && { tapa: t });
      pags.forEach((s, i) => { const v = $('c-s' + i).value; if (hex(v)) s.color = v; });
      S.cambio();
    };
    modal().querySelectorAll('input[type=color]').forEach(inp => inp.addEventListener('input', vivo));
    modal().querySelectorAll('[data-pre]').forEach(b => b.onclick = () => { const p = PRESETS[+b.dataset.pre]; $('c-acento').value = p.acento; $('c-tapa').value = p.tapa; vivo(); });
    $('no').onclick = revertir;
    const guardar = () => {
      const antes = new Map(JSON.parse(respaldo).c);
      intentar(Promise.all([S.guardarDiseno(E.album.diseno), ...pags.filter(s => antes.get(s.id) !== s.color).map(s => S.guardarPagina(s.id, { color: s.color }))]));
      cerrar();
    };
    $('ok').onclick = guardar;
    $('reset').onclick = () => confirmar('Vuelven el dorado, la tapa y los colores de página originales. Textos, lugares y fotos no se tocan.', 'Restablecer', () => {
      $('c-acento').value = S.DIS.acento; $('c-tapa').value = S.DIS.tapa;
      pags.forEach((s, i) => { $('c-s' + i).value = S.COLORES[i % S.COLORES.length]; });
      vivo(); guardar();
    });
  }

  function grupo() {
    cerrar();
    const link = location.origin + location.pathname + '?codigo=' + E.album.codigo;
    panel(`<h4 id="ph">Grupo</h4><div class="meta">Mandales este link para que se sumen.</div>
      <label for="g-link">Link de invitación<input type="text" id="g-link" readonly value="${esc(link)}"></label>
      <div class="acciones"><button class="btn pri" id="g-copiar">Copiar</button><button class="btn" id="g-nuevo">Nuevo código</button></div>
      <div class="meta">Código: <b class="codigo">${esc(E.album.codigo)}</b></div>
      <div id="conf"></div>
      <div class="sub">Miembros (${E.miembros.length})</div>
      <div class="lista">${E.miembros.slice().sort((a, b) => a.apodo.localeCompare(b.apodo)).map(m => `<div class="item">
        <div class="nom"><b>${esc(m.apodo)}${m.user_id === E.uid ? ' (vos)' : ''}</b><small>${m.rol === 'admin' ? 'Admin' : 'Miembro'}</small></div>
        ${m.user_id === E.uid ? '' : `<button class="ic peligro" data-sacar="${m.user_id}" aria-label="Sacar a ${esc(m.apodo)}">✕</button>`}</div>`).join('')}</div>
      <button class="btn" id="b-cerrar">Listo</button>`);
    $('b-cerrar').onclick = cerrar;
    $('g-copiar').onclick = async () => {
      try { await navigator.clipboard.writeText(link); $('g-copiar').textContent = '¡Copiado!'; }
      catch (_) { $('g-link').select(); $('g-copiar').textContent = 'Copialo a mano'; }
    };
    $('g-nuevo').onclick = () => confirmar('El link y el código de ahora dejan de andar. Los que ya están en el álbum siguen adentro.', 'Cambiar código',
      async () => { await intentar(S.nuevoCodigo()); grupo(); });
    modal().querySelectorAll('[data-sacar]').forEach(b => b.onclick = () => {
      const uid = b.dataset.sacar;
      confirmar(`¿Sacar a ${S.apodo(uid)} del álbum? Sus figuritas quedan.`, 'Sacar', async () => { await intentar(S.sacar(uid)); grupo(); });
    });
  }

  function ajustes() {
    cerrar(); const yo = S.yo() || {};
    panel(`<h4 id="ph">Ajustes</h4>
      ${campo('a-apodo', 'Tu apodo', yo.apodo || '', 30)}
      <button class="btn pri" id="a-ok">Guardar apodo</button>
      ${UI.alCambiarAlbum ? '<button class="btn" id="a-album">Cambiar de álbum</button>' : ''}
      <button class="btn peligro" id="a-salir">Cerrar sesión</button>
      <button class="btn" id="b-cerrar">Listo</button>`);
    $('b-cerrar').onclick = cerrar;
    $('a-ok').onclick = () => { const ap = val('a-apodo'); if (!ap) return; intentar(S.cambiarApodo(ap)); cerrar(); };
    if ($('a-album')) $('a-album').onclick = () => { cerrar(); UI.alCambiarAlbum(); };
    $('a-salir').onclick = () => { cerrar(); UI.alSalir(); };
  }

  /* Cargar fotos y armar el sobre */
  const aDestino = v => v === 'libre' ? { tipo: 'libre', destino: null } : { tipo: v.startsWith('p:') ? 'pagina' : 'lugar', destino: v.slice(2) };
  function opcionesDestino(excluir) {
    const ocupados = new Set();
    [...S.mano(), ...S.sobresCerrados().flatMap(x => x.figs)].forEach(c => { if (c.id !== excluir && c.destino_tipo === 'lugar') ocupados.add(c.destino_id); });
    return `<option value="libre">Comodín · cualquier lugar libre</option>` + secs().map((sec, si) => {
      const libres = sec.lugares.filter(l => !A().ocupados.has(l.id));
      if (!libres.length) return '';
      return `<optgroup label="Pág ${si + 1} · ${esc(sec.p.titulo)}"><option value="p:${sec.p.id}">Cualquier lugar de esta página</option>${
        libres.map(l => `<option value="l:${l.id}">N.º ${R.numero(A(), l.id)} · ${esc(l.nombre || 'Sin nombre')}${ocupados.has(l.id) ? ' (ya tiene una abajo)' : ''}</option>`).join('')}</optgroup>`;
    }).join('');
  }
  function armarSobre() {
    cerrar(); const fotos = []; let subiendo = false;
    const dibujar = () => {
      $('filas').innerHTML = fotos.map((f, i) => `<div class="fila-foto"><span class="th" style="${bg(f.vista)}"></span>
        <select id="d-${i}" aria-label="Destino de la foto ${i + 1}">${opcionesDestino()}</select>
        <button class="ic peligro" data-q="${i}" aria-label="Quitar foto ${i + 1}">✕</button></div>`).join('');
      fotos.forEach((f, i) => { $('d-' + i).value = f.d; $('d-' + i).onchange = e => f.d = e.target.value; });
      modal().querySelectorAll('[data-q]').forEach(b => b.onclick = () => { fotos.splice(+b.dataset.q, 1); dibujar(); });
      $('ok').disabled = !fotos.length; $('ok').textContent = fotos.length ? `Armar sobre (${fotos.length})` : 'Armar sobre';
    };
    panel(`<h4 id="ph">Cargar fotos</h4>
      <div class="meta">Cada foto sale como figurita. Elegí si va a un lugar fijo, a cualquier lugar de una página, o si es un comodín.</div>
      <span class="btn subir">Elegir fotos<input type="file" id="in-fotos" accept="image/jpeg,image/png,image/webp,image/heic,image/*" multiple aria-label="Elegir fotos"></span>
      <div id="filas" class="lista"></div><p class="meta" id="prog" role="status"></p><p class="aviso" id="aviso" hidden></p>
      <div class="acciones"><button class="btn pri" id="ok" disabled>Armar sobre</button><button class="btn" id="no">Cancelar</button></div>`);
    panel.alCerrar = () => { if (!subiendo) cerrar(); };
    $('no').onclick = panel.alCerrar;
    $('in-fotos').onchange = async e => {
      const files = [...e.target.files]; let malas = 0;
      for (let i = 0; i < files.length; i++) {
        $('prog').textContent = `Preparando ${i + 1} de ${files.length}…`;
        try { fotos.push(Object.assign(await Fotos.procesar(files[i]), { d: 'libre' })); } catch (_) { malas++; }
      }
      $('prog').textContent = '';
      $('aviso').hidden = !malas; $('aviso').textContent = malas ? `${malas} ${malas === 1 ? 'foto no se pudo leer' : 'fotos no se pudieron leer'}. Probá con JPG o PNG.` : '';
      e.target.value = ''; dibujar();
    };
    $('ok').onclick = async () => {
      subiendo = true; modal().querySelectorAll('button,select,input').forEach(x => x.disabled = true); $('aviso').hidden = true;
      try {
        const id = await S.armarSobre(fotos.map(f => Object.assign({}, f, aDestino(f.d))), (n, t) => $('prog').textContent = `Subiendo ${n} de ${t}…`);
        subiendo = false; cerrar(); abrirSobre(id);
      } catch (err) {
        subiendo = false; $('prog').textContent = ''; $('aviso').hidden = false; $('aviso').textContent = err.message;
        modal().querySelectorAll('button,select,input').forEach(x => x.disabled = false);
      }
    };
  }

  /* Apertura del sobre: la ve el primero que lo abre */
  function abrirSobre(id) {
    const x = S.sobresCerrados().find(y => y.s.id === id); if (!x) return;
    const d = S.D(), n = x.figs.length, capa = $('capa');
    capa.innerHTML = `<div class="capa" role="dialog" aria-modal="true" aria-label="Sobre nuevo">
      <div class="titulo">Sobre de ${esc(S.apodo(x.s.creado_por))} · ${n} ${n === 1 ? 'figurita' : 'figuritas'}</div>
      <div class="sobre" id="sobre" role="button" tabindex="0" aria-label="Abrir sobre">
        <div class="corte">Abrir aquí</div><div class="ms">${esc(mono())}</div>
        <div class="st">${esc(d.titulo)}</div><div class="sn">${n} figuritas</div></div>
      <div class="reparto" id="reparto" hidden></div>
      <div class="acciones" id="acc"><button class="btn pri" id="b-abrir">Abrir sobre</button><button class="btn" id="b-despues">Después</button></div></div>`;
    let abierto = false;
    const abrirlo = () => {
      if (abierto) return; abierto = true; const sb = $('sobre'); $('acc').hidden = true;
      const llamada = S.abrirSobre(id).catch(e => e);
      sb.classList.add('tiembla');
      setTimeout(() => sb.classList.add('corta'), 450);
      setTimeout(() => sb.classList.add('vacia'), 1050);
      setTimeout(async () => {
        sb.remove(); const r = $('reparto'); r.hidden = false; r.innerHTML = x.figs.map((f, i) => cartaHTML(f, i)).join('');
        const err = await llamada;
        $('acc').hidden = false;
        $('acc').innerHTML = (err instanceof Error ? `<p class="aviso">${esc(err.message)}</p>` : '') + '<button class="btn pri" id="b-listo">A pegar</button>';
        $('b-listo').onclick = () => { capa.innerHTML = ''; cajon(true); }; $('b-listo').focus();
      }, 1500);
    };
    $('b-abrir').onclick = abrirlo; $('sobre').onclick = abrirlo;
    $('sobre').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirlo(); } };
    $('b-despues').onclick = () => { capa.innerHTML = ''; };
  }

  /* Editar una figurita que todavía no se pegó */
  function editarCarta(fid) {
    cerrar(); const c = S.fig(fid); if (!c || c.lugar_id) return;
    const d = R.destinoReal(A(), c), cur = d.t === 'libre' ? 'libre' : d.t === 'pagina' ? 'p:' + secs()[d.si].p.id : 'l:' + d.r.l.id;
    const vista = v => { const x = aDestino(v); return cartaHTML(c, 0, et(Object.assign({}, c, { destino_tipo: x.tipo, destino_id: x.destino }))); };
    panel(`<h4 id="ph">Editar figurita</h4>
      <div class="meta">Cambiá adónde va. ${c.fecha_foto ? 'Foto del ' + fechaLinda(c.fecha_foto) + '. ' : ''}Subida por ${esc(S.apodo(c.subida_por))}.</div>
      <div class="vista" id="vista">${vista(cur)}</div>
      <label for="e-dest">Dónde va<select id="e-dest">${opcionesDestino(fid)}</select></label>
      <div class="acciones"><button class="btn pri" id="ok">Guardar</button><button class="btn" id="no">Cancelar</button></div>
      ${S.puedeTirar(c) ? '<button class="btn peligro" id="del">Tirar figurita</button>' : ''}<div id="conf"></div>`);
    $('e-dest').value = cur;
    $('e-dest').onchange = () => { $('vista').innerHTML = vista($('e-dest').value); };
    $('no').onclick = cerrar;
    $('ok').onclick = () => { const x = aDestino($('e-dest').value); UI.sel = null; cerrar(); intentar(S.cambiarDestino(fid, x.tipo, x.destino)); };
    if ($('del')) $('del').onclick = () => confirmar('Se borra esta foto para todos. No vuelve al sobre.', 'Tirar',
      () => { UI.sel = null; cerrar(); intentar(S.tirar(fid)); });
  }

  /* Eventos fijos del álbum */
  function iniciarEventos() {
    $('ant').onclick = () => irA(UI.actual - 1);
    $('sig').onclick = () => irA(UI.actual + 1);
    $('puntos').onclick = e => { const b = e.target.closest('[data-p]'); if (b) irA(+b.dataset.p); };
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { if (modal().innerHTML) (panel.alCerrar || cerrar)(); return; }
      if (modal().innerHTML || $('capa').innerHTML || $('app').hidden || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (e.key === 'ArrowRight') irA(UI.actual + 1); if (e.key === 'ArrowLeft') irA(UI.actual - 1);
    });
    let x0 = null, y0 = null; const escena = $('escena');
    escena.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    escena.addEventListener('touchend', e => {
      if (x0 === null || UI.arrastrando) { x0 = null; return; }
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) irA(UI.actual + (dx < 0 ? 1 : -1)); x0 = null;
    }, { passive: true });
    libro().addEventListener('click', e => {
      if (e.target.closest('.vuelta')) return;
      const s = e.target.closest('[data-sec]'); if (s) { editarSeccion(+s.dataset.sec); return; }
      if (e.target.closest('[data-tapa]')) { editarTapa(); return; }
      const b = e.target.closest('[data-id]');
      if (b && UI.sel && b.classList.contains('hueco')) {
        const c = S.fig(UI.sel);
        if (c && puede(c, b.dataset.id)) pegar(UI.sel, b.dataset.id);
        else if (c) { const e2 = et(c); aviso(e2.n ? `Esa no: la N.º ${e2.n} va en su lugar marcado.` : `Esa no: esta figurita va en la pág. ${e2.si + 1}.`); }
        return;
      }
      if (b) { abrir(b.dataset.id); return; }
      if (UI.actual === 0 && UI.modoDis && e.target.closest('.tapa')) editarTapa();
    });
    $('b-modo').onclick = () => {
      UI.modoDis = !UI.modoDis && S.esAdmin();
      $('b-modo').setAttribute('aria-pressed', UI.modoDis); $('modo').hidden = !UI.modoDis; pintar();
    };
    $('b-ajustes').onclick = ajustes;
    $('b-colores').onclick = colores;
    $('b-paginas').onclick = paginas;
    $('b-grupo').onclick = grupo;
    $('b-cargar').onclick = armarSobre;
    $('tira').onclick = e => { const s = e.target.closest('[data-sobre]'); if (s) abrirSobre(s.dataset.sobre); };
    $('b-asa').onclick = () => cajon(!cajonAbierto);
    cajon(cajonAbierto);
  }

  window.UI = UI;
  window.Vistas = { login, bienvenida, elegirAlbum, cargando, errorCarga, mostrarAlbum, pintar, pintarMano, irA, elegir, pegar,
    editarCarta, et, puede, toast, iniciarEventos, libro };
})();
