/* Service worker: guarda la aplicación en el móvil para que abra y funcione sin internet.
   Al cambiar cualquier archivo, sube VERSION para que los móviles descarguen la versión nueva. */
const VERSION = "v1";
const CACHE = `mis-gastos-${VERSION}`;
const ARCHIVOS = [
  "./", "index.html", "manifest.webmanifest", "css/style.css",
  "js/app.js", "js/util.js", "js/catalogo.js", "js/almacen.js", "js/calculos.js", "js/importador.js",
  "js/estado.js", "js/componentes.js", "js/graficos.js",
  "js/vistas/inicio.js", "js/vistas/mensualidad.js", "js/vistas/estadisticas.js", "js/vistas/modificar.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png",
];

self.addEventListener("install", evento => {
  // cache: "reload" evita copiar versiones antiguas que el navegador o el servidor tengan en su propia caché.
  evento.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(ARCHIVOS.map(a => new Request(a, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", evento => {
  evento.waitUntil(
    caches.keys().then(claves => Promise.all(claves.filter(c => c !== CACHE).map(c => caches.delete(c))))
      .then(() => self.clients.claim()));
});

// Se responde al instante desde la copia guardada y, si hay internet, se actualiza para la próxima vez.
self.addEventListener("fetch", evento => {
  const peticion = evento.request;
  if (peticion.method !== "GET" || new URL(peticion.url).origin !== self.location.origin) return;
  evento.respondWith(caches.open(CACHE).then(async cache => {
    const guardada = await cache.match(peticion, { ignoreSearch: true });
    const red = fetch(peticion).then(respuesta => {
      if (respuesta.ok) cache.put(peticion, respuesta.clone());
      return respuesta;
    }).catch(() => guardada);
    return guardada || red;
  }));
});
