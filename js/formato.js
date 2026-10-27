/* Formato de montos y fechas. Sin DOM: se usa en el navegador y en los tests de Node. */
var Formato = (function () {
  // gs(1234567) → "Gs. 1.234.567"
  function gs(n) {
    n = Math.round(n || 0);
    return (n < 0 ? '-' : '') + 'Gs. ' + puntos(Math.abs(n));
  }
  // 1234567 → "1.234.567" (para los campos mientras escribís)
  function puntos(n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  // "Gs. 1.234.567" → 1234567; cualquier cosa sin dígitos → 0
  function parseGs(v) {
    return parseInt(String(v == null ? '' : v).replace(/\D/g, ''), 10) || 0;
  }
  // Fecha local (no UTC, si no a la noche te pone el día siguiente)
  function hoy(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  // "2026-10-23" → "23/10"
  function fechaCorta(f) {
    if (!f) return '';
    var p = f.split('-');
    return p[2] + '/' + p[1];
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  return { gs: gs, puntos: puntos, parseGs: parseGs, hoy: hoy, fechaCorta: fechaCorta, esc: esc };
})();
if (typeof module !== 'undefined') module.exports = Formato;
