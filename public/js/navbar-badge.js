// ============================================================
// navbar-badge.js
// Gestión centralizada de la navbar para todas las páginas.
// Maneja: avatar, logout, tema, y badge de reservas pendientes.
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const USUARIO_KEY  = 'estairbnb_user';
  const THEME_KEY    = 'estairbnb_theme';
  const currentUser  = JSON.parse(localStorage.getItem(USUARIO_KEY) || 'null');

  // ── Tema ──────────────────────────────────────────────────
  const btnTheme  = document.getElementById('btnThemeToggle');
  const themeIcon = document.getElementById('themeIcon');

  function applyTheme(dark) {
    if (dark) {
      document.documentElement.classList.add('dark');
      if (themeIcon) themeIcon.textContent = 'light_mode';
    } else {
      document.documentElement.classList.remove('dark');
      if (themeIcon) themeIcon.textContent = 'dark_mode';
    }
  }

  // Aplicar tema guardado (solo si la página no lo hizo ya)
  if (!document.documentElement.classList.contains('dark')) {
    applyTheme(localStorage.getItem(THEME_KEY) === 'dark');
  }

  if (btnTheme && !btnTheme.dataset.bound) {
    btnTheme.dataset.bound = '1';
    btnTheme.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      applyTheme(!isDark);
      localStorage.setItem(THEME_KEY, isDark ? 'light' : 'dark');
    });
  }

  // ── Sin sesión: no seguir ─────────────────────────────────
  if (!currentUser) return;

  // ── Avatar / iniciales ────────────────────────────────────
  const avatarEl   = document.getElementById('userAvatar');
  const initialsEl = document.getElementById('navInitials');

  if (initialsEl && initialsEl.textContent === '?') {
    const first  = (currentUser.nombre   || '?')[0].toUpperCase();
    const second = (currentUser.apellidos || '?')[0].toUpperCase();
    initialsEl.textContent = first + second;
  }

  if (avatarEl && currentUser.foto_url) {
    const img = avatarEl.querySelector('img');
    if (!img) {
      if (initialsEl) initialsEl.style.display = 'none';
      avatarEl.style.backgroundImage   = `url('${currentUser.foto_url}')`;
      avatarEl.style.backgroundSize    = 'cover';
      avatarEl.style.backgroundPosition = 'center';
    }
  }

  // ── Logout ────────────────────────────────────────────────
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout && !btnLogout.dataset.bound) {
    btnLogout.dataset.bound = '1';
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem(USUARIO_KEY);
      window.location.href = '/login.html';
    });
  }

  // ── Badge de reservas en navbar ──────────────────────────
  function crearBadge(linkEl, id) {
    if (!linkEl) return null;
    linkEl.style.position = 'relative';
    const b = document.createElement('span');
    b.id = id;
    Object.assign(b.style, {
      display: 'none', position: 'absolute', top: '-4px', right: '-10px',
      minWidth: '17px', height: '17px', padding: '0 4px',
      background: '#ff4757', color: '#fff', borderRadius: '999px',
      fontSize: '0.58rem', fontWeight: '700', lineHeight: '17px',
      textAlign: 'center', fontFamily: 'Inter,sans-serif', pointerEvents: 'none'
    });
    linkEl.appendChild(b);
    return b;
  }

  const linkReservas = document.getElementById('linkMisGarajes');

  if (currentUser.rol_id === 1) {
    // Anfitrión: badge con reservas pendientes por aprobar
    const badge = crearBadge(linkReservas, 'reservasBadge');
    if (badge) {
      fetch(`/api/reservas/pendientes-count?usuario_id=${currentUser.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.status === 'ok' && data.count > 0) {
            badge.textContent  = data.count > 9 ? '+9' : data.count;
            badge.style.display = 'inline-block';
          }
        })
        .catch(() => {});
    }
  } else if (currentUser.rol_id === 2) {
    // Conductor: badge con reservas confirmadas (activas)
    const badge = crearBadge(linkReservas, 'reservasBadge');
    if (badge) {
      fetch(`/api/reservas/activas-count?usuario_id=${currentUser.id}`)
        .then(r => r.json())
        .then(data => {
          if (data.status === 'ok' && data.count > 0) {
            badge.textContent  = data.count > 9 ? '+9' : data.count;
            badge.style.display = 'inline-block';
          }
        })
        .catch(() => {});
    }
  }
});
