/* Arrastrar figuritas desde el cajón hasta su lugar, con pointer events.
   Tocar = elegir; mantener apretado o clic derecho = editar; arrastrar = pegar al soltar sobre un lugar válido. */
(function () {
  function iniciar() {
    const V = Vistas, tira = document.getElementById('tira'), libro = V.libro();
    let drag = null, bloqueo = 0;
    // el toque que abre el editor no debe "tocar" también un botón del panel que aparece debajo del dedo
    window.addEventListener('click', e => { if (Date.now() < bloqueo) { e.stopPropagation(); e.preventDefault(); } }, true);

    tira.addEventListener('pointerdown', e => {
      const b = e.target.closest('[data-carta]'); if (!b || e.button > 0) return;
      try { b.hasPointerCapture && b.hasPointerCapture(e.pointerId) && b.releasePointerCapture(e.pointerId); } catch (_) {}
      drag = { id: b.dataset.carta, el: b, x: e.clientX, y: e.clientY, activo: false, ghost: null, sobre: null, pid: e.pointerId };
      drag.lp = setTimeout(() => { if (drag && !drag.activo) { const id = drag.id; drag = null; bloqueo = Date.now() + 700; V.editarCarta(id); } }, 450);
    });
    tira.addEventListener('contextmenu', e => {
      const b = e.target.closest('[data-carta]'); if (!b) return; e.preventDefault();
      if (drag && drag.activo) return; if (drag) { clearTimeout(drag.lp); drag = null; }
      bloqueo = Date.now() + 700; if (!document.getElementById('e-dest')) V.editarCarta(b.dataset.carta);
    });

    window.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.pid) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.activo) {
        if (Math.hypot(dx, dy) < 8) return; clearTimeout(drag.lp);
        if (Math.abs(dx) > Math.abs(dy) * 1.4 && dy > -12) { drag = null; return; } // gesto horizontal: deja scrollear la tira
        const c = Estado.fig(drag.id); if (!c) { drag = null; return; }
        drag.activo = true; UI.arrastrando = true; UI.sel = drag.id;
        const g = drag.el.cloneNode(true); g.classList.add('fantasma'); g.removeAttribute('data-carta'); document.body.appendChild(g); drag.ghost = g;
        drag.el.classList.add('levantada'); libro.classList.add('arrastrando');
        const et = V.et(c);
        if (et.si >= 0 && UI.actual !== et.si + 1) V.irA(et.si + 1); else if (et.si < 0 && UI.actual === 0) V.irA(1); else V.pintar();
      }
      e.preventDefault();
      drag.ghost.style.transform = `translate(${e.clientX - 36}px,${e.clientY - 60}px) rotate(-4deg) scale(1.25)`;
      const bajo = document.elementFromPoint(e.clientX, e.clientY), h = bajo && bajo.closest('.libro > .hoja .hueco');
      const c = Estado.fig(drag.id);
      const nuevo = h && c && V.puede(c, h.dataset.id) ? h : null;
      if (drag.sobre !== nuevo) {
        drag.sobre && drag.sobre.classList.remove('encima'); nuevo && nuevo.classList.add('encima'); drag.sobre = nuevo;
        libro.classList.toggle('apunta', !!nuevo); if (nuevo && navigator.vibrate) try { navigator.vibrate(8); } catch (_) {}
      }
    }, { passive: false });

    const soltar = e => {
      if (!drag || e.pointerId !== drag.pid) return; const d = drag; drag = null; clearTimeout(d.lp);
      if (!d.activo) { if (e.type === 'pointerup') V.elegir(d.id); return; }
      UI.arrastrando = false;
      libro.classList.remove('apunta', 'arrastrando');
      if (d.sobre) { d.ghost.remove(); V.pegar(d.id, d.sobre.dataset.id); return; }
      if (e.type === 'pointercancel') { d.ghost.remove(); UI.sel = null; V.pintar(); return; }
      // no cayó en un lugar válido: vuelve a su lugar en la tira
      const r = tira.querySelector(`[data-carta="${d.id}"]`), rr = r ? r.getBoundingClientRect() : { left: 0, top: innerHeight };
      d.ghost.style.transition = 'transform .3s ease-out'; d.ghost.style.transform = `translate(${rr.left}px,${rr.top}px)`;
      setTimeout(() => { d.ghost.remove(); V.pintar(); }, 300);
    };
    window.addEventListener('pointerup', soltar); window.addEventListener('pointercancel', soltar);
  }
  window.Arrastre = { iniciar };
})();
