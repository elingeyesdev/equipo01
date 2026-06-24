// EstAirbnb — registro del Service Worker (PWA)
// Permite "Agregar a pantalla de inicio" e instalar el sitio como app.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sin conexión o no soportado */ });
  });
}
