// ============================================================
// navbar-badge.js
// Lógica compartida para revisar e inyectar Reservas de Anfitrión/Conductor en Navbar
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = JSON.parse(localStorage.getItem('estairbnb_user') || 'null');
  
  if (!currentUser) return; // No login, no reservas
  
  // Buscar o crear el contenedor the nav-links
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;
  
  // No duplicar si ya existe
  if (document.getElementById('linkGlobalReservas')) return;
  
  // Crear el A link de Reservas
  const a = document.createElement('a');
  a.href = '/mis-reservas.html';
  a.className = 'nav-link-custom';
  a.id = 'linkGlobalReservas';
  a.innerHTML = '<i class="fa-solid fa-calendar-days"></i> Reservas' + 
    '<span id="reservasBadge" class="badge bg-danger rounded-circle" style="display:none; font-size: 0.65rem; position: absolute; margin-top: -5px; margin-left: 2px;">0</span>';
  
  // Insertar The Reservas nav link después del Explorar o al inicio si no existe explorar
  const linkExplorar = document.querySelector('a[href="/explorar.html"]');
  if (linkExplorar) {
    linkExplorar.insertAdjacentElement('afterend', a);
  } else {
    navLinks.prepend(a);
  }

  // Lógica del Badge solo para Anfitriones
  if (currentUser.rol_id === 1) {
    try {
      const res = await fetch('/api/reservas/pendientes-count?usuario_id=' + currentUser.id);
      const data = await res.json();
      if (res.ok && data.status === 'ok' && data.count > 0) {
        const badge = document.getElementById('reservasBadge');
        if (badge) {
          badge.textContent = data.count > 9 ? '+9' : data.count;
          badge.style.display = 'inline-block';
        }
      }
    } catch (e) {
      console.error('Error fetching pendientes-count:', e);
    }
  }
});
