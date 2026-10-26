// node tests/reglas.test.js
const assert = require('assert');
const R = require('../js/reglas.js');

// 3 páginas de 6 lugares: lugares p1-1..p1-6, p2-1.., p3-1..
const paginas = [
  { id: 'p1', orden: 1, titulo: 'Asunción', color: '#7e3139', brillante: false },
  { id: 'p2', orden: 2, titulo: 'Sección 2', color: '#2f5c4d', brillante: true },
  { id: 'p3', orden: 3, titulo: 'Sección 3', color: '#33497a', brillante: false }
];
const lugares = [];
paginas.forEach(p => { for (let i = 1; i <= 6; i++) lugares.push({ id: `${p.id}-${i}`, pagina_id: p.id, orden: i, nombre: i === 1 ? 'Costanera' : '' }); });
const pegada = (lid) => ({ id: 'x' + lid, lugar_id: lid });
const fig = (tipo, id) => ({ id: 'f', destino_tipo: tipo, destino_id: id || null, lugar_id: null });

let ok = 0;
const t = (nombre, fn) => { fn(); ok++; console.log('✓', nombre); };

t('numeración con 3 páginas', () => {
  const a = R.armar(paginas, lugares, []);
  assert.strictEqual(a.total, 18);
  assert.strictEqual(R.numero(a, 'p1-1'), 1);
  assert.strictEqual(R.numero(a, 'p2-1'), 7);
  assert.strictEqual(R.numero(a, 'p3-6'), 18);
});

t('la numeración se acomoda al reordenar', () => {
  const re = [{ ...paginas[0], orden: 3 }, { ...paginas[1], orden: 1 }, { ...paginas[2], orden: 2 }];
  const a = R.armar(re, lugares, []);
  assert.strictEqual(R.numero(a, 'p2-1'), 1);
  assert.strictEqual(R.numero(a, 'p3-1'), 7);
  assert.strictEqual(R.numero(a, 'p1-1'), 13);
});

t('lugar fijo libre: solo ese lugar', () => {
  const a = R.armar(paginas, lugares, []);
  const f = fig('lugar', 'p1-2');
  assert.strictEqual(R.destinoReal(a, f).t, 'lugar');
  assert.ok(R.puede(a, f, 'p1-2'));
  assert.ok(!R.puede(a, f, 'p1-3'));
  assert.ok(!R.puede(a, f, 'p2-1'));
});

t('lugar fijo ocupado con lugar en la página: cualquier lugar de esa página', () => {
  const a = R.armar(paginas, lugares, [pegada('p1-2')]);
  const f = fig('lugar', 'p1-2');
  assert.deepStrictEqual(R.destinoReal(a, f), { t: 'pagina', si: 0 });
  assert.ok(R.puede(a, f, 'p1-3'));
  assert.ok(!R.puede(a, f, 'p1-2'), 'el ocupado no');
  assert.ok(!R.puede(a, f, 'p2-1'));
});

t('página llena: pasa a comodín', () => {
  const llenas = lugares.filter(l => l.pagina_id === 'p1').map(l => pegada(l.id));
  const a = R.armar(paginas, lugares, llenas);
  assert.strictEqual(R.destinoReal(a, fig('lugar', 'p1-2')).t, 'libre');
  assert.strictEqual(R.destinoReal(a, fig('pagina', 'p1')).t, 'libre');
  assert.ok(R.puede(a, fig('pagina', 'p1'), 'p3-4'));
  assert.ok(!R.puede(a, fig('pagina', 'p1'), 'p1-1'), 'ocupado nunca');
});

t('página borrada: pasa a comodín', () => {
  const sinP1 = paginas.slice(1), lug = lugares.filter(l => l.pagina_id !== 'p1');
  const a = R.armar(sinP1, lug, []);
  assert.strictEqual(R.destinoReal(a, fig('pagina', 'p1')).t, 'libre');
  assert.strictEqual(R.destinoReal(a, fig('lugar', 'p1-2')).t, 'libre');
  assert.ok(R.puede(a, fig('lugar', 'p1-2'), 'p2-1'));
  assert.ok(!R.puede(a, fig('lugar', 'p1-2'), 'p1-2'), 'lugar que no existe');
});

t('página con lugar: solo esa página', () => {
  const a = R.armar(paginas, lugares, []);
  const f = fig('pagina', 'p2');
  assert.ok(R.puede(a, f, 'p2-4'));
  assert.ok(!R.puede(a, f, 'p1-1'));
});

t('comodín: cualquier lugar libre', () => {
  const a = R.armar(paginas, lugares, [pegada('p3-3')]);
  const f = fig('libre');
  assert.ok(R.puede(a, f, 'p1-1'));
  assert.ok(R.puede(a, f, 'p3-4'));
  assert.ok(!R.puede(a, f, 'p3-3'));
});

t('etiquetas de cada tipo', () => {
  const a = R.armar(paginas, lugares, []);
  const l = R.etiqueta(a, fig('lugar', 'p1-1'), '#c9a96e');
  assert.strictEqual(l.badge, '1'); assert.strictEqual(l.texto, 'Costanera'); assert.strictEqual(l.tema, 'Pág 1 · Asunción'); assert.strictEqual(l.n, 1);
  const p = R.etiqueta(a, fig('pagina', 'p2'), '#c9a96e');
  assert.strictEqual(p.badge, 'P2'); assert.strictEqual(p.texto, 'Cualquier lugar'); assert.ok(p.brillante);
  const c = R.etiqueta(a, fig('libre'), '#c9a96e');
  assert.strictEqual(c.badge, '★'); assert.strictEqual(c.texto, 'Comodín'); assert.ok(c.comodin); assert.strictEqual(c.c, '#c9a96e');
  assert.strictEqual(R.etiqueta(a, fig('lugar', 'p1-2'), '').texto, 'Sin nombre');
});

console.log(`\n${ok} pruebas OK`);
