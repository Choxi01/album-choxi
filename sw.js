// Service worker: guarda solo los archivos de la app para que abra sin conexión.
// Las llamadas a Supabase (datos y fotos) nunca se guardan. Al cambiar cualquier archivo, subí VERSION.
const VERSION = 'album-choxi-v2';
const ARCHIVOS = [
  './',
  'index.html',
  'css/estilos.css',
  'js/config.js',
  'js/reglas.js',
  'js/api.js',
  'js/fotos.js',
  'js/estado.js',
  'js/vistas.js',
  'js/arrastre.js',
  'js/app.js',
  'vendor/supabase.js',
  'manifest.webmanifest',
  'fonts/bodoni-moda.woff2',
  'fonts/bodoni-moda-italic.woff2',
  'fonts/barlow-condensed-500.woff2',
  'fonts/barlow-condensed-600.woff2',
  'fonts/barlow-condensed-700.woff2',
  'fonts/barlow-400.woff2',
  'fonts/barlow-500.woff2',
  'fonts/barlow-600.woff2',
  'icons/icono-192.png',
  'icons/icono-512.png',
  'icons/icono-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // Supabase y todo lo de afuera va directo a la red
  // Primero lo guardado; ?codigo=... y otros parámetros abren la misma página.
  e.respondWith(caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }).then(r => r || fetch(e.request)));
});
