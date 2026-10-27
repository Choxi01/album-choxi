/* Tests del cálculo de cuentas (traídos de Cuentas Choxi). Correr con: node tests/calculo.test.js */
var assert = require('assert');
var F = require('../js/formato.js');
var C = require('../js/calculo.js');

var fallas = 0;
function test(nombre, fn) {
  try { fn(); console.log('  ok  ' + nombre); }
  catch (e) { fallas++; console.log('  MAL ' + nombre + '\n      ' + e.message); }
}
function igual(pagador, monto, entre) {
  var e = {}; entre.forEach(function (k) { e[k] = 1; });
  var p = {}; p[pagador] = monto;
  return { descripcion: 'x', monto: monto, pagadores: p, modo: 'igual', entre: e };
}

var contactos = [
  { id: 'yo', nombre: 'Yo', yo: true, alias: '0981 000 001', tipo_alias: 'Celular' },
  { id: 'beto', nombre: 'Beto', alias: '1.234.567', tipo_alias: 'Cédula' },
  { id: 'caro', nombre: 'Caro', alias: '', titular: 'Carolina Ejemplo', cedula: '7.654.321', banco: 'Banco ejemplo', cuenta: '000-123456-0' },
  { id: 'dani', nombre: 'Dani', alias: 'dani@ejemplo.com', tipo_alias: 'Email' }
];
var asado = {
  id: 's1', tipo: 'salida', nombre: 'Asado', fecha: '2026-10-23', miembros: ['yo', 'beto', 'caro', 'dani'], pagos: [],
  gastos: [
    igual('yo', 120000, ['yo', 'beto']),
    igual('beto', 90000, ['beto', 'dani']),
    igual('caro', 280000, ['yo', 'beto', 'caro', 'dani']),
    igual('dani', 66000, ['yo', 'caro', 'dani'])
  ]
};

console.log('Formato');
test('gs y parseGs', function () {
  assert.strictEqual(F.gs(1234567), 'Gs. 1.234.567');
  assert.strictEqual(F.gs(-32000), '-Gs. 32.000');
  assert.strictEqual(F.gs(0), 'Gs. 0');
  assert.strictEqual(F.parseGs('Gs. 1.234.567'), 1234567);
  assert.strictEqual(F.parseGs(''), 0);
});

console.log('Cálculo');
test('ejemplo de la demo: balances', function () {
  assert.deepStrictEqual(C.balances(asado), { yo: -32000, beto: -85000, caro: 188000, dani: -71000 });
});
test('ejemplo de la demo: 3 transferencias, la mía primera', function () {
  var tr = C.transferencias(C.balances(asado), 'yo');
  assert.strictEqual(tr.length, 3);
  assert.deepStrictEqual(tr[0], { de: 'yo', a: 'caro', monto: 32000 });
  assert.deepStrictEqual(tr.slice(1), [{ de: 'beto', a: 'caro', monto: 85000 }, { de: 'dani', a: 'caro', monto: 71000 }]);
});
test('reparto con resto: 100.000 entre 3 suma exacto', function () {
  var r = C.repartir(100000, { a: 1, b: 1, c: 1 });
  assert.deepStrictEqual(r, { a: 33334, b: 33333, c: 33333 });
});
test('reparto por partes con resto', function () {
  var r = C.repartir(100001, { a: 2, b: 1 });
  assert.strictEqual(r.a + r.b, 100001);
  assert.deepStrictEqual(r, { a: 66668, b: 33333 });
});
test('montos exactos que no suman → error claro', function () {
  var g = { descripcion: 'Cena', monto: 100000, pagadores: { yo: 100000 }, modo: 'exacto', entre: { yo: 60000, beto: 30000 } };
  assert.strictEqual(C.validarGasto(g), 'Los montos suman Gs. 90.000 y el total es Gs. 100.000. Faltan Gs. 10.000.');
  g.entre.beto = 40000;
  assert.strictEqual(C.validarGasto(g), '');
});
test('pagaron varios: tiene que sumar el total', function () {
  var g = { descripcion: 'Súper', monto: 150000, pagadores: { yo: 100000, beto: 30000 }, modo: 'igual', entre: { yo: 1, beto: 1, caro: 1 } };
  assert.ok(/suma Gs\. 130\.000 y el total es Gs\. 150\.000/.test(C.validarGasto(g)));
  g.pagadores.beto = 50000;
  assert.strictEqual(C.validarGasto(g), '');
  var c = { miembros: ['yo', 'beto', 'caro'], gastos: [g], pagos: [] };
  assert.deepStrictEqual(C.balances(c), { yo: 50000, beto: 0, caro: -50000 });
});
test('pagos marcados se descuentan', function () {
  var c = JSON.parse(JSON.stringify(asado));
  c.pagos.push({ de: 'yo', a: 'caro', monto: 32000 });
  var tr = C.transferencias(C.balances(c), 'yo');
  assert.strictEqual(tr.length, 2);
  assert.ok(tr.every(function (t) { return t.de !== 'yo'; }));
});
test('yo primero también en cobros', function () {
  var c = { miembros: ['yo', 'a', 'b', 'c'], pagos: [], gastos: [igual('c', 30000, ['a', 'c']), igual('yo', 90000, ['yo', 'b', 'c'])] };
  var tr = C.transferencias(C.balances(c), 'yo');
  assert.strictEqual(tr[0].a, 'yo');
});
test('la suma de balances siempre da 0 (gastos al azar)', function () {
  var ids = ['yo', 'a', 'b', 'c', 'd', 'e'];
  function azar(n) { return Math.floor(Math.random() * n); }
  for (var vuelta = 0; vuelta < 500; vuelta++) {
    var gastos = [];
    for (var k = 0; k < 1 + azar(6); k++) {
      var monto = 1 + azar(1000000);
      var entre = {};
      var quienes = ids.filter(function () { return Math.random() < 0.6; });
      if (!quienes.length) quienes = ['yo'];
      var modo = ['igual', 'partes', 'exacto'][azar(3)];
      if (modo === 'exacto') {
        var w = {}; quienes.forEach(function (q) { w[q] = 1 + azar(5); });
        entre = C.repartir(monto, w);
      } else quienes.forEach(function (q) { entre[q] = modo === 'partes' ? 1 + azar(4) : 1; });
      var p1 = ids[azar(ids.length)], p2 = ids[azar(ids.length)], pag = {};
      var parte = azar(monto + 1);
      pag[p1] = (pag[p1] || 0) + parte; pag[p2] = (pag[p2] || 0) + monto - parte;
      var g = { descripcion: 'g', monto: monto, pagadores: pag, modo: modo, entre: entre };
      assert.strictEqual(C.validarGasto(g), '', 'gasto inválido generado');
      gastos.push(g);
    }
    var b = C.balances({ miembros: ids, gastos: gastos, pagos: [] });
    var s = Object.keys(b).reduce(function (x, kk) { return x + b[kk]; }, 0);
    assert.strictEqual(s, 0);
    // y las transferencias dejan a todos en 0
    var tr = C.transferencias(b, 'yo');
    tr.forEach(function (t) { b[t.de] += t.monto; b[t.a] -= t.monto; });
    assert.ok(Object.keys(b).every(function (kk) { return b[kk] === 0; }), 'quedó alguien sin saldar');
    assert.ok(tr.length <= ids.length - 1, 'demasiadas transferencias');
  }
});

console.log('Texto final');
test('con alias muestra solo el alias; sin alias, los datos completos', function () {
  var t = C.textoFinal(asado, contactos, 'yo');
  assert.strictEqual(t,
    '💸 Asado (23/10)\n\n' +
    '*Transferencias*\n' +
    '• Yo → Caro: Gs. 32.000\n' +
    '• Beto → Caro: Gs. 85.000\n' +
    '• Dani → Caro: Gs. 71.000\n\n' +
    '*Datos para transferir*\n' +
    '▸ Caro\n  Titular: Carolina Ejemplo\n  C.I.: 7.654.321\n  Banco: Banco ejemplo\n  Nro. de cuenta: 000-123456-0\n');
  assert.deepStrictEqual(C.datosCuenta(contactos[1]), ['Alias (Cédula): 1.234.567']);
});
test('si nadie debe: todos a mano', function () {
  var c = { nombre: 'Nada', fecha: '2026-01-05', miembros: ['yo'], gastos: [igual('yo', 1000, ['yo'])], pagos: [] };
  assert.strictEqual(C.textoFinal(c, contactos, 'yo'), '💸 Nada (05/01)\n\n✅ Todos a mano, nadie debe nada.\n');
});
test('ordenar contactos: yo primero y después frecuentes', function () {
  var o = C.ordenarContactos([{ id: 'z', nombre: 'Ana' }, { id: 'f', nombre: 'Zoe' }, { id: 'y', nombre: 'Yo', yo: true }],
    [{ miembros: ['f'] }, { miembros: ['f', 'z'] }]);
  assert.deepStrictEqual(o.map(function (x) { return x.id; }), ['y', 'f', 'z']);
});

if (fallas) { console.log('\n' + fallas + ' test(s) fallaron'); process.exit(1); }
console.log('\nTodo en verde');
