/* Achicar, rotar y hacer la miniatura en el navegador. Al redibujar en un canvas se pierden los datos EXIF (y el GPS). */
(function () {
  async function abrir(file) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (_) { return await createImageBitmap(file); } // navegadores que no aceptan la opción ya rotan solos
  }
  function aJpeg(bmp, lado, calidad) {
    const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('No se pudo convertir')), 'image/jpeg', calidad));
  }
  function fechaDe(file) {
    const d = new Date(file.lastModified || Date.now());
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // → { foto, mini, fecha, vista } (vista = URL local de la miniatura para mostrarla ya)
  async function procesar(file) {
    const bmp = await abrir(file);
    const foto = await aJpeg(bmp, 1280, 0.8), mini = await aJpeg(bmp, 400, 0.75);
    bmp.close && bmp.close();
    if (foto.size > 3 * 1024 * 1024) throw new Error('Foto muy pesada');
    return { foto, mini, fecha: fechaDe(file), vista: URL.createObjectURL(mini) };
  }
  window.Fotos = { procesar };
})();
