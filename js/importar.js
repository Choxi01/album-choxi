/* Importar el respaldo .json de Cuentas Choxi: leerlo y traducir contactos a personas del grupo.
   Lógica pura (sin DOM ni Supabase), se testea en Node. Nunca modifica el archivo ni los datos leídos. */
var Importar = (function () {
  function esEntero(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0; }
  function esMapa(o, entero) {
    return o && typeof o === 'object' && !Array.isArray(o) &&
      Object.keys(o).every(function (k) { return typeof o[k] === 'number' && isFinite(o[k]) && o[k] >= 0 && (!entero || esEntero(o[k])); });
  }
  // Misma revisión que hace Cuentas Choxi al restaurar
  function valido(d) {
    if (!d || !Array.isArray(d.contactos) || !Array.isArray(d.cuentas)) return false;
    return d.contactos.every(function (c) { return c && typeof c.id === 'string' && typeof c.nombre === 'string'; }) &&
      d.cuentas.every(function (c) {
        return c && typeof c.id === 'string' && typeof c.nombre === 'string' && (c.tipo === 'rapido' || c.tipo === 'salida') &&
          Array.isArray(c.miembros) && Array.isArray(c.gastos) && (c.pagos === undefined || Array.isArray(c.pagos)) &&
          c.gastos.every(function (g) {
            return g && esEntero(g.monto) && g.monto > 0 && esMapa(g.pagadores, true) && esMapa(g.entre, g.modo === 'exacto') &&
              (g.modo === 'igual' || g.modo === 'exacto' || g.modo === 'partes');
          });
      });
  }

  // Devuelve los datos del respaldo, o tira un Error con un mensaje para mostrar
  function leer(texto) {
    var j;
    try { j = JSON.parse(texto); } catch (e) { throw new Error('Ese archivo no es un respaldo (no es un JSON válido).'); }
    if (!j || j.app !== 'cuentas-choxi' || !j.datos) throw new Error('Ese archivo no es un respaldo de Cuentas Choxi.');
    if (!valido(j.datos)) throw new Error('El respaldo está incompleto o dañado.');
    return j.datos;
  }

  // Contactos que aparecen en alguna cuenta (los demás no hace falta emparejarlos)
  function usados(datos) {
    var ids = {};
    datos.cuentas.forEach(function (c) {
      c.miembros.forEach(function (m) { ids[m] = 1; });
      c.gastos.forEach(function (g) { Object.keys(g.pagadores).concat(Object.keys(g.entre)).forEach(function (k) { ids[k] = 1; }); });
      (c.pagos || []).forEach(function (p) { ids[p.de] = 1; ids[p.a] = 1; });
    });
    return Object.keys(ids).map(function (id) {
      return datos.contactos.find(function (c) { return c.id === id; }) || { id: id, nombre: '?' };
    });
  }

  // Pasa un mapa {contacto: valor} a {persona: valor}. Si dos contactos van a la misma persona, se suman
  // (en "iguales" el valor es 1 = entra o no entra, así que no se suma).
  function mapear(obj, mapa, igual) {
    var out = {};
    Object.keys(obj).forEach(function (k) {
      var p = mapa[k], v = obj[k];
      if (!p || !(v > 0)) return;
      out[p] = igual ? 1 : (out[p] || 0) + v;
    });
    return out;
  }
  function corto(t, max, siVacio) { t = String(t || '').trim().slice(0, max); return t || siVacio; }

  // mapa: {contacto_id: persona_id}. Devuelve una lista lista para insertar, cuenta por cuenta.
  function armar(datos, mapa, hoy) {
    return datos.cuentas.map(function (c) {
      var miembros = [];
      function sumar(p) { if (p && miembros.indexOf(p) < 0) miembros.push(p); }
      c.miembros.forEach(function (m) { sumar(mapa[m]); });
      var gastos = c.gastos.map(function (g) {
        var pagadores = mapear(g.pagadores, mapa, false), entre = mapear(g.entre, mapa, g.modo === 'igual');
        Object.keys(pagadores).concat(Object.keys(entre)).forEach(sumar);
        return { descripcion: corto(g.desc, 60, 'Gasto'), monto: g.monto, pagadores: pagadores, modo: g.modo, entre: entre };
      });
      var pagos = (c.pagos || []).map(function (p) { return { de: mapa[p.de], a: mapa[p.a], monto: p.monto }; })
        .filter(function (p) { return p.de && p.a && p.de !== p.a && p.monto > 0; });
      return {
        nombre: c.nombre,
        cuenta: { tipo: c.tipo, nombre: corto(c.nombre, 60, 'Cuenta'), fecha: c.fecha || hoy, miembros: miembros },
        gastos: gastos, pagos: pagos
      };
    });
  }

  function resumen(armado) {
    return armado.reduce(function (r, x) {
      r.cuentas++; r.gastos += x.gastos.length; r.pagos += x.pagos.length; return r;
    }, { cuentas: 0, gastos: 0, pagos: 0 });
  }

  // Datos de transferencia de un contacto, con los nombres de columna de personas
  function invitado(c) {
    return {
      nombre: corto(c.nombre, 40, 'Invitado'), tipo_alias: c.alias ? (c.tipoAlias || '') : '', alias: String(c.alias || '').slice(0, 60),
      titular: String(c.titular || '').slice(0, 60), cedula: String(c.cedula || '').slice(0, 20),
      banco: String(c.banco || '').slice(0, 40), cuenta: String(c.cuenta || '').slice(0, 40)
    };
  }

  return { leer: leer, usados: usados, armar: armar, resumen: resumen, invitado: invitado };
})();
if (typeof module !== 'undefined') module.exports = Importar;
