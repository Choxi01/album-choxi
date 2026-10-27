/* Lógica pura: repartir, balances, transferencias y texto final. Traída de Cuentas Choxi.
   Todo en enteros de guaraníes, montos exactos, sin redondeo. No toca el DOM.
   Los ids son de `personas`; gastos y contactos usan los nombres de columna de la base (descripcion, tipo_alias). */
var Calculo = (function (F) {
  // Reparte `monto` proporcional a `pesos` ({id: peso}). Floor + los guaraníes sueltos de a 1 entre los primeros.
  function repartir(monto, pesos) {
    var ids = Object.keys(pesos).filter(function (k) { return pesos[k] > 0; });
    var tot = ids.reduce(function (a, k) { return a + pesos[k]; }, 0);
    var out = {};
    if (!tot) return out;
    var asignado = 0;
    ids.forEach(function (k) { out[k] = Math.floor(monto * pesos[k] / tot); asignado += out[k]; });
    for (var resto = monto - asignado, i = 0; resto > 0; resto--, i++) out[ids[i % ids.length]]++;
    return out;
  }

  // Cuánto le toca a cada uno de un gasto
  function partesDe(g) {
    if (g.modo === 'exacto') {
      var o = {};
      Object.keys(g.entre).forEach(function (k) { if (g.entre[k] > 0) o[k] = g.entre[k]; });
      return o;
    }
    return repartir(g.monto, g.entre);
  }

  function suma(obj) {
    return Object.keys(obj).reduce(function (a, k) { return a + (obj[k] || 0); }, 0);
  }

  // Devuelve '' si el gasto está bien, o el mensaje de error para mostrar
  function validarGasto(g) {
    var entre = Object.keys(g.entre || {}).filter(function (k) { return g.entre[k] > 0; });
    if (!String(g.descripcion || '').trim()) return 'Poné qué fue el gasto.';
    if (!(g.monto > 0)) return 'Cargá el monto total.';
    var pagado = suma(g.pagadores || {});
    if (!Object.keys(g.pagadores || {}).length) return 'Elegí quién pagó.';
    if (pagado !== g.monto) return 'Lo que pagó cada uno suma ' + F.gs(pagado) + ' y el total es ' + F.gs(g.monto) + '.';
    if (!entre.length) return 'Elegí al menos una persona para dividir.';
    if (g.modo === 'exacto') {
      var se = suma(g.entre);
      if (se !== g.monto) {
        var dif = g.monto - se;
        return 'Los montos suman ' + F.gs(se) + ' y el total es ' + F.gs(g.monto) + '. ' + (dif > 0 ? 'Faltan ' + F.gs(dif) : 'Sobran ' + F.gs(-dif)) + '.';
      }
    }
    return '';
  }

  // Balance = lo que pagó − lo que le toca + pagos marcados. Positivo: le tienen que pasar.
  function balances(cuenta) {
    var b = {};
    cuenta.miembros.forEach(function (m) { b[m] = 0; });
    cuenta.gastos.forEach(function (g) {
      Object.keys(g.pagadores).forEach(function (k) { b[k] = (b[k] || 0) + g.pagadores[k]; });
      var p = partesDe(g);
      Object.keys(p).forEach(function (k) { b[k] = (b[k] || 0) - p[k]; });
    });
    (cuenta.pagos || []).forEach(function (p) {
      b[p.de] = (b[p.de] || 0) + p.monto;
      b[p.a] = (b[p.a] || 0) - p.monto;
    });
    return b;
  }

  // Transferencias mínimas (greedy deudor mayor ↔ acreedor mayor), con "yo" primero
  function transferencias(b, yoId) {
    var deud = [], acre = [];
    Object.keys(b).forEach(function (k) {
      if (b[k] < 0) deud.push({ id: k, v: -b[k] });
      else if (b[k] > 0) acre.push({ id: k, v: b[k] });
    });
    // yo primero entre los deudores: así mi deuda sale en la menor cantidad de transferencias
    deud.sort(function (x, y) { return (y.id === yoId) - (x.id === yoId) || y.v - x.v; });
    acre.sort(function (x, y) { return y.v - x.v; });
    var out = [], i = 0, j = 0;
    while (i < deud.length && j < acre.length) {
      var m = Math.min(deud[i].v, acre[j].v);
      if (m > 0) out.push({ de: deud[i].id, a: acre[j].id, monto: m });
      deud[i].v -= m; acre[j].v -= m;
      if (deud[i].v <= 0) i++;
      if (acre[j].v <= 0) j++;
    }
    function rango(t) { return t.de === yoId ? 0 : t.a === yoId ? 1 : 2; }
    // sort estable: dentro de cada grupo queda el orden del greedy
    return out.sort(function (x, y) { return rango(x) - rango(y); });
  }

  // Con alias: solo el alias. Sin alias: los datos de cuenta que estén.
  function datosCuenta(c) {
    if (c.alias) return [(c.tipo_alias ? 'Alias (' + c.tipo_alias + ')' : 'Alias') + ': ' + c.alias];
    var l = [];
    if (c.titular) l.push('Titular: ' + c.titular);
    if (c.cedula) l.push('C.I.: ' + c.cedula);
    if (c.banco) l.push('Banco: ' + c.banco);
    if (c.cuenta) l.push('Nro. de cuenta: ' + c.cuenta);
    return l.length ? l : ['Sin datos de cuenta cargados'];
  }

  // Lo que se copia con "Copiar alias/datos"
  function textoCopiarCuenta(c) {
    return c.alias ? c.alias : datosCuenta(c).join('\n');
  }

  function buscar(contactos, id) {
    for (var i = 0; i < contactos.length; i++) if (contactos[i].id === id) return contactos[i];
    return { id: id, nombre: '?' };
  }

  // Texto final para pegar en el grupo: transferencias y datos, sin detalle de gastos ni total
  function textoFinal(cuenta, contactos, yoId) {
    var tr = transferencias(balances(cuenta), yoId);
    var nom = function (id) { return buscar(contactos, id).nombre; };
    var t = '💸 ' + cuenta.nombre + (cuenta.fecha ? ' (' + F.fechaCorta(cuenta.fecha) + ')' : '') + '\n';
    if (!tr.length) return t + '\n✅ Todos a mano, nadie debe nada.\n';
    t += '\n*Transferencias*\n' + tr.map(function (x) {
      return '• ' + nom(x.de) + ' → ' + nom(x.a) + ': ' + F.gs(x.monto);
    }).join('\n') + '\n';
    var reciben = [];
    tr.forEach(function (x) { if (reciben.indexOf(x.a) < 0) reciben.push(x.a); });
    t += '\n*Datos para transferir*\n' + reciben.map(function (id) {
      var c = buscar(contactos, id);
      return '▸ ' + c.nombre + '\n' + datosCuenta(c).map(function (l) { return '  ' + l; }).join('\n');
    }).join('\n') + '\n';
    return t;
  }

  // Yo primero, después los que más aparecen en cuentas, después por nombre
  function ordenarContactos(contactos, cuentas) {
    var veces = {};
    cuentas.forEach(function (c) { c.miembros.forEach(function (m) { veces[m] = (veces[m] || 0) + 1; }); });
    return contactos.slice().sort(function (a, b) {
      return (b.yo ? 1 : 0) - (a.yo ? 1 : 0) || (veces[b.id] || 0) - (veces[a.id] || 0) || a.nombre.localeCompare(b.nombre);
    });
  }

  function totalCuenta(cuenta) {
    return cuenta.gastos.reduce(function (a, g) { return a + g.monto; }, 0);
  }

  return {
    repartir: repartir, partesDe: partesDe, validarGasto: validarGasto, balances: balances,
    transferencias: transferencias, datosCuenta: datosCuenta, textoCopiarCuenta: textoCopiarCuenta,
    textoFinal: textoFinal, ordenarContactos: ordenarContactos, totalCuenta: totalCuenta
  };
})(typeof Formato !== 'undefined' ? Formato : require('./formato.js'));
if (typeof module !== 'undefined') module.exports = Calculo;
