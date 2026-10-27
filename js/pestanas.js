/* Barra de abajo (Álbum · Cuentas · Grupo · Panel) y dibujo de las secciones que no son el álbum.
   Cada sección se registra con { html(), acciones, alEntrar?, ocupado?, alCambiarCampo? } y usa data-a en sus botones. */
(function () {
  const $ = id => document.getElementById(id);
  const P = { tab: 'album', vistas: {}, pendiente: false };
  const ICON = {
    album: '<path d="M4 4h7a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-5a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h5z"/>',
    cuentas: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    grupo: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5 6.5-5s5.7 1.5 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.3 0 4 1.2 4.5 3.5"/>',
    panel: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
  };
  const NOMBRES = { album: 'Álbum', cuentas: 'Cuentas', grupo: 'Grupo', panel: 'Panel' };

  function barra() {
    const ts = ['album', 'cuentas', 'grupo'].concat(Estado.E.duenoApp ? ['panel'] : []);
    $('tabs').style.setProperty('--n', ts.length);
    $('tabs').innerHTML = ts.map(t => `<button data-tab="${t}"${P.tab === t ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[t]}</svg>${NOMBRES[t]}</button>`).join('');
  }

  function ir(tab) {
    if (tab === 'panel' && !Estado.E.duenoApp) tab = 'album';
    P.tab = tab;
    $('p-album').hidden = tab !== 'album';
    $('seccion').hidden = tab === 'album';
    barra();
    if (tab === 'album') { Vistas.pintar(); return; }
    const v = P.vistas[tab];
    if (v.alEntrar) v.alEntrar();
    dibujar();
    $('seccion').scrollTop = 0;
  }

  function dibujar() {
    if (P.tab === 'album') return;
    const s = $('seccion'), y = s.scrollTop;
    s.innerHTML = `<div class="sec">${P.vistas[P.tab].html()}</div>`;
    s.scrollTop = y;
    P.pendiente = false;
  }

  // Cambios en vivo: si estás escribiendo o con un formulario abierto, se redibuja cuando lo cerrás.
  function escribiendo() {
    const a = document.activeElement;
    return a && $('seccion').contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName);
  }
  function alCambiarDatos() {
    if ($('app').hidden) return;
    barra();
    if (P.tab === 'album') return;
    const v = P.vistas[P.tab];
    if ((v.ocupado && v.ocupado()) || escribiendo()) { P.pendiente = true; return; }
    dibujar();
  }

  const error = e => Vistas.toast(e && e.message ? e.message : String(e));
  // Corre una acción; si devuelve una promesa que falla, muestra el error del servidor tal cual.
  function correr(fn, b, ev) {
    try { const r = fn(b, ev); if (r && r.catch) r.catch(e => { error(e); dibujar(); }); }
    catch (e) { error(e); }
  }

  function copiar(txt, ok, el) {
    const respaldo = () => {
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); Vistas.toast('Seleccioné el texto: copialo con el menú'); }
      else Vistas.toast('No se pudo copiar. Copialo a mano: ' + txt);
    };
    try { navigator.clipboard.writeText(txt).then(() => Vistas.toast(ok), respaldo); } catch (_) { respaldo(); }
  }

  function iniciar() {
    $('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) ir(b.dataset.tab); });
    const s = $('seccion');
    s.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'), v = P.vistas[P.tab];
      if (b && v.acciones[b.dataset.a]) correr(v.acciones[b.dataset.a], b, e);
    });
    s.addEventListener('input', e => { const v = P.vistas[P.tab]; if (v.alEscribir) v.alEscribir(e); });
    s.addEventListener('change', e => { const v = P.vistas[P.tab]; if (v.alCambiarCampo) correr(v.alCambiarCampo, e.target, e); });
    // al salir del campo, si quedó un cambio en vivo pendiente, se dibuja
    s.addEventListener('focusout', () => setTimeout(() => { if (P.pendiente && !escribiendo()) alCambiarDatos(); }, 0));
  }

  window.Pestanas = { P, registrar: (n, v) => P.vistas[n] = v, ir, dibujar, alCambiarDatos, iniciar, copiar, error, actual: () => P.tab };
})();
