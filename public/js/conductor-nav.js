// EstAirbnb — Barra de navegación inferior para el conductor (solo móvil).
// Reemplaza al menú superior que se oculta en pantallas pequeñas.
(function () {
  const user = JSON.parse(localStorage.getItem('estairbnb_user') || 'null');
  // El anfitrión usa su propio sidebar; esta barra es para el conductor.
  if (user && user.rol_id === 1) return;

  const items = [
    { href: '/explorar.html',      match: 'explorar',      icon: 'search',   label: 'Explorar' },
    { href: '/mis-favoritos.html', match: 'mis-favoritos', icon: 'favorite', label: 'Favoritos' },
    { href: '/mis-reservas.html',  match: 'mis-reservas',  icon: 'event',    label: 'Reservas' },
    { href: '/configuracion.html', match: 'configuracion', icon: 'person',   label: 'Perfil' },
  ];
  const path = location.pathname;

  function mount() {
    if (document.getElementById('cbottomNav')) return;
    const nav = document.createElement('nav');
    nav.id = 'cbottomNav';
    nav.className = 'cbottom-nav';
    nav.setAttribute('aria-label', 'Navegación principal');
    nav.innerHTML = items.map(it => {
      const active = path.indexOf(it.match) !== -1 ? ' active' : '';
      return `<a href="${it.href}" class="cbn-item${active}">
        <span class="material-symbols-outlined">${it.icon}</span>
        <span class="cbn-label">${it.label}</span>
      </a>`;
    }).join('');
    document.body.appendChild(nav);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
