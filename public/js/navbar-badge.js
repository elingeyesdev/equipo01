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

  // ── Badge de pendientes (solo anfitriones) ────────────────
  if (currentUser.rol_id === 1) {
    // Buscar el enlace de Mis Garajes para ponerle el badge ahí
    const linkGarajes = document.getElementById('navLinkGarajes');
    if (linkGarajes) {
      linkGarajes.style.position = 'relative';
      const badge = document.createElement('span');
      badge.id = 'reservasBadge';
      badge.className = 'badge bg-danger rounded-circle';
      badge.style.display = 'none';
      badge.style.fontSize = '0.6rem';
      badge.style.position = 'absolute';
      badge.style.top = '2px';
      badge.style.right = '-8px';
      badge.style.minWidth = '16px';
      badge.style.height = '16px';
      badge.style.padding = '0 4px';
      badge.style.lineHeight = '16px';
      badge.style.textAlign = 'center';
      badge.textContent = '0';
      linkGarajes.appendChild(badge);
    }

    fetch(`/api/reservas/pendientes-count?usuario_id=${currentUser.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 'ok' && data.count > 0) {
          const badge = document.getElementById('reservasBadge');
          if (badge) {
            badge.textContent  = data.count > 9 ? '+9' : data.count;
            badge.style.display = 'inline-block';
          }
        }
      })
      .catch(() => {});
  }
});
