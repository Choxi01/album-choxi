/* Reglas del álbum: lógica pura, sin DOM ni Supabase.
   Tiene que responder igual que la función pegar() del SQL. */
(function (raiz) {
  // Arma la vista ordenada del álbum: páginas por orden, cada una con sus lugares por orden.
  function armar(paginas, lugares, figuritas) {
    const secciones = paginas.slice().sort((a, b) => a.orden - b.orden).map(p => ({
      p, lugares: lugares.filter(l => l.pagina_id === p.id).sort((a, b) => a.orden - b.orden)
    }));
    const pos = new Map();
    let n = 0;
    secciones.forEach((s, si) => s.lugares.forEach((l, li) => pos.set(l.id, { si, li, s, l, n: ++n })));
    const ocupados = new Map();
    figuritas.forEach(f => { if (f.lugar_id) ocupados.set(f.lugar_id, f); });
    return { secciones, pos, ocupados, total: n };
  }

  const buscar = (a, lid) => a.pos.get(lid) || null;
  const numero = (a, lid) => (a.pos.get(lid) || {}).n;

  function paginaConLugar(a, si) {
    return a.secciones[si].lugares.some(l => !a.ocupados.has(l.id));
  }

  // Adónde puede ir de verdad una figurita sin pegar: {t:'lugar', r, si} | {t:'pagina', si} | {t:'libre'}
  function destinoReal(a, f) {
    if (f.destino_tipo === 'lugar') {
      const r = buscar(a, f.destino_id);
      if (r && !a.ocupados.has(r.l.id)) return { t: 'lugar', r, si: r.si };
      if (r && paginaConLugar(a, r.si)) return { t: 'pagina', si: r.si };
      return { t: 'libre' };
    }
    if (f.destino_tipo === 'pagina') {
      const si = a.secciones.findIndex(s => s.p.id === f.destino_id);
      if (si >= 0 && paginaConLugar(a, si)) return { t: 'pagina', si };
      return { t: 'libre' };
    }
    return { t: 'libre' };
  }

  function puede(a, f, lid) {
    const r = buscar(a, lid);
    if (!r || a.ocupados.has(lid)) return false;
    const d = destinoReal(a, f);
    if (d.t === 'lugar') return d.r.l.id === lid;
    if (d.t === 'pagina') return r.si === d.si;
    return true;
  }

  // Texto de la figurita según su destino. acento = color del comodín.
  function etiqueta(a, f, acento) {
    const d = destinoReal(a, f);
    if (d.t === 'libre') return { badge: '★', texto: 'Comodín', tema: 'Libre · cualquier lugar', c: acento, comodin: true, si: -1 };
    const p = a.secciones[d.si].p, tema = `Pág ${d.si + 1} · ${p.titulo}`;
    if (d.t === 'lugar') return { badge: String(d.r.n), texto: d.r.l.nombre || 'Sin nombre', tema, c: p.color, si: d.si, brillante: p.brillante, n: d.r.n };
    return { badge: 'P' + (d.si + 1), texto: 'Cualquier lugar', tema, c: p.color, si: d.si, brillante: p.brillante };
  }

  function iniciales(t) {
    const w = String(t).trim().split(/\s+/).filter(p => p.length > 2);
    return ((w.length ? w : [t]).slice(0, 2).map(p => p[0]).join('') || '?').toUpperCase();
  }

  const R = { armar, buscar, numero, destinoReal, puede, etiqueta, iniciales, paginaConLugar };
  if (typeof module !== 'undefined' && module.exports) module.exports = R; else raiz.Reglas = R;
})(this);
