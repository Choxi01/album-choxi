/* Tests del importador de Cuentas Choxi. Correr con: node tests/importar.test.js */
var assert = require('assert');
var I = require('../js/importar.js');
var C = require('../js/calculo.js');

var fallas = 0;
function test(nombre, fn) {
  try { fn(); console.log('  ok  ' + nombre); }
  catch (e) { fallas++; console.log('  MAL ' + nombre + '\n      ' + e.message); }
}

var respaldo = {
  app: 'cuentas-choxi', version: 1, datos: {
    contactos: [
      { id: 'yo', nombre: 'Yo', yo: true, alias: '0981', tipoAlias: 'Celular' },
      { id: 'b', nombre: 'Beto', alias: '1.234.567', tipoAlias: 'Cédula' },
      { id: 'b2', nombre: 'Beto (repetido)', alias: '' },
      { id: 'c', nombre: 'Caro', alias: '', titular: 'Carolina', banco: 'Banco X', tipoAlias: 'Cédula' },
      { id: 'z', nombre: 'Nadie' }
    ],
    cuentas: [
      { id: 's1', tipo: 'salida', nombre: 'Asado', fecha: '2026-10-23', miembros: ['yo', 'b', 'b2', 'c'],
        pagos: [{ de: 'b', a: 'c', monto: 1000 }, { de: 'b2', a: 'b', monto: 500 }],
        gastos: [
          { id: 'g1', desc: 'Carne', monto: 90000, pagadores: { b: 60000, b2: 30000 }, modo: 'igual', entre: { yo: 1, b: 1, b2: 1, c: 1 } },
          { id: 'g2', desc: 'Vino', monto: 30000, pagadores: { c: 30000 }, modo: 'exacto', entre: { b: 10000, b2: 5000, c: 15000 } },
          { id: 'g3', desc: '', monto: 3000, pagadores: { yo: 3000 }, modo: 'partes', entre: { b: 1, b2: 2 } }
        ] },
      { id: 'r1', tipo: 'rapido', nombre: 'Pizza', miembros: ['yo', 'c'], gastos: [{ id: 'g4', desc: 'Pizza', monto: 50000, pagadores: { yo: 50000 }, modo: 'igual', entre: { yo: 1, c: 1 } }] }
    ]
  }
};
var texto = JSON.stringify(respaldo);
var mapa = { yo: 'P-yo', b: 'P-beto', b2: 'P-beto', c: 'P-caro' }; // los dos Beto van a la misma persona

test('lee el respaldo y rechaza archivos ajenos', function () {
  assert.strictEqual(I.leer(texto).cuentas.length, 2);
  assert.throws(function () { I.leer('no es json'); }, /JSON/);
  assert.throws(function () { I.leer('{"app":"otra"}'); }, /Cuentas Choxi/);
  assert.throws(function () { I.leer('{"app":"cuentas-choxi","datos":{"contactos":[],"cuentas":[{"id":"x"}]}}'); }, /dañado/);
});
test('solo pide emparejar los contactos usados', function () {
  var ids = I.usados(I.leer(texto)).map(function (c) { return c.id; }).sort();
  assert.deepStrictEqual(ids, ['b', 'b2', 'c', 'yo']);
});
test('mapea ids y junta dos contactos que son la misma persona', function () {
  var a = I.armar(I.leer(texto), mapa, '2026-10-26');
  var s = a[0];
  assert.deepStrictEqual(s.cuenta, { tipo: 'salida', nombre: 'Asado', fecha: '2026-10-23', miembros: ['P-yo', 'P-beto', 'P-caro'] });
  assert.deepStrictEqual(s.gastos[0].pagadores, { 'P-beto': 90000 });
  assert.deepStrictEqual(s.gastos[0].entre, { 'P-yo': 1, 'P-beto': 1, 'P-caro': 1 }); // iguales: no se suma
  assert.deepStrictEqual(s.gastos[1].entre, { 'P-beto': 15000, 'P-caro': 15000 }); // exactos: se suman
  assert.deepStrictEqual(s.gastos[2].entre, { 'P-beto': 3 }); // partes: se suman
  assert.strictEqual(s.gastos[2].descripcion, 'Gasto');
  assert.deepStrictEqual(s.pagos, [{ de: 'P-beto', a: 'P-caro', monto: 1000 }]); // el pago de Beto a Beto se descarta
  assert.strictEqual(a[1].cuenta.fecha, '2026-10-26'); // sin fecha: hoy
});
test('los gastos importados siguen siendo válidos y el saldo cierra en 0', function () {
  I.armar(I.leer(texto), mapa, '2026-10-26').forEach(function (x) {
    x.gastos.forEach(function (g) { assert.strictEqual(C.validarGasto(g), ''); });
    var b = C.balances({ miembros: x.cuenta.miembros, gastos: x.gastos, pagos: x.pagos });
    assert.strictEqual(Object.keys(b).reduce(function (t, k) { return t + b[k]; }, 0), 0);
  });
});
test('resumen y datos del invitado; el original no se toca', function () {
  var d = I.leer(texto), antes = JSON.stringify(d);
  assert.deepStrictEqual(I.resumen(I.armar(d, mapa, '2026-10-26')), { cuentas: 2, gastos: 4, pagos: 1 });
  assert.strictEqual(JSON.stringify(d), antes);
  var inv = I.invitado(d.contactos[3]);
  assert.deepStrictEqual(inv, { nombre: 'Caro', tipo_alias: '', alias: '', titular: 'Carolina', cedula: '', banco: 'Banco X', cuenta: '' });
});

if (fallas) { console.log('\n' + fallas + ' test(s) fallaron'); process.exit(1); }
console.log('\nTodo en verde');
