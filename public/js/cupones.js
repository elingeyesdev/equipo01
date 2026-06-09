(function () {
  'use strict';

  const USUARIO_KEY = 'estairbnb_user';
  const currentUser = JSON.parse(localStorage.getItem(USUARIO_KEY) || 'null');
  if (!currentUser) { window.location.href = '/login.html'; return; }

  // Role-based nav visibility
  if (currentUser.rol_id === 1) { // anfitrión
    ['linkExplorar', 'linkFavoritos', 'linkMisReservas'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const mg = document.getElementById('linkMisGarajes');
    if (mg) mg.style.display = '';
  }

  // Mostrar panel de creación solo para anfitriones
  if (currentUser.rol_id === 1) {
    const panel = document.getElementById('panelCrearCupon');
    if (panel) panel.style.display = 'block';
    // Pre-fill fecha mínima
    const hoy = new Date();
    const min = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()+1).padStart(2,'0')}`;
    const inputFin = document.getElementById('adminFechaFin');
    if (inputFin) { inputFin.min = min; inputFin.value = ''; }
  }

  window.crearCupon = async function() {
    const codigo        = document.getElementById('adminCodigo').value.trim().toUpperCase();
    const descuento     = parseInt(document.getElementById('adminDescuento').value, 10);
    const fecha_fin     = document.getElementById('adminFechaFin').value;
    const usos_maximos  = document.getElementById('adminMaxUsos').value;
    const descripcion   = document.getElementById('adminDescripcion').value.trim();
    const feedback      = document.getElementById('createFeedback');
    const btn           = document.getElementById('btnCrearCupon');

    if (!codigo || codigo.length < 3) return setFeedback(feedback, 'El código debe tener al menos 3 caracteres.', false);
    if (!descuento || descuento < 1 || descuento > 100) return setFeedback(feedback, 'El descuento debe ser entre 1% y 100%.', false);
    if (!fecha_fin) return setFeedback(feedback, 'La fecha de vencimiento es obligatoria.', false);

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando...';

    try {
      const res  = await fetch('/api/cupones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          descuento_porcentaje: descuento,
          fecha_fin,
          usos_maximos: usos_maximos ? parseInt(usos_maximos, 10) : null,
          descripcion: descripcion || null
        })
      });
      const json = await res.json();

      if (res.ok && json.status === 'ok') {
        setFeedback(feedback, json.message, true);
        document.getElementById('adminCodigo').value       = '';
        document.getElementById('adminDescuento').value    = '';
        document.getElementById('adminFechaFin').value     = '';
        document.getElementById('adminMaxUsos').value      = '';
        document.getElementById('adminDescripcion').value  = '';
        showToast(json.message);
        await cargarCupones();
      } else {
        setFeedback(feedback, json.message || 'Error al crear el cupón.', false);
      }
    } catch (err) {
      setFeedback(feedback, 'No se pudo conectar con el servidor.', false);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-ticket"></i> Crear Cupón';
    }
  };

  function setFeedback(el, msg, ok) {
    el.style.display = 'block';
    el.style.background = ok ? '#f0fdf4' : '#fef2f2';
    el.style.color      = ok ? '#166534' : '#dc2626';
    el.style.border     = `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`;
    el.textContent      = msg;
  }

  // Theme
  const saved = localStorage.getItem('estairbnb_theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
    const ti = document.getElementById('themeIcon');
    if (ti) ti.textContent = 'light_mode';
  }
  const btnTheme = document.getElementById('btnThemeToggle');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      document.documentElement.classList.toggle('dark', !isDark);
      const ti = document.getElementById('themeIcon');
      if (ti) ti.textContent = isDark ? 'dark_mode' : 'light_mode';
      localStorage.setItem('estairbnb_theme', isDark ? 'light' : 'dark');
    });
  }

  // Logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', () => {
    localStorage.removeItem(USUARIO_KEY);
    window.location.href = '/login.html';
  });

  // Avatar
  const navInitials = document.getElementById('navInitials');
  if (navInitials && currentUser.nombre) {
    navInitials.textContent = (currentUser.nombre[0] + (currentUser.apellidos?.[0] || '')).toUpperCase();
  }

  function showToast(msg, type = 'success') {
    const el = document.getElementById('_appToast');
    if (!el) return;
    el.style.background = type === 'error' ? '#dc2626' : '#006a62';
    el.innerHTML = `<span>${msg}</span>`;
    clearTimeout(el._t);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = 'translateX(0)'; }));
    el._t = setTimeout(() => { el.style.transform = 'translateX(calc(100% + 32px))'; }, 2800);
  }

  window.copiarCodigo = function(btn, codigo) {
    navigator.clipboard.writeText(codigo).then(() => {
      btn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!';
      btn.classList.add('copied');
      showToast(`Código ${codigo} copiado al portapapeles`);
      setTimeout(() => {
        btn.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar código';
        btn.classList.remove('copied');
      }, 2500);
    }).catch(() => {
      showToast('No se pudo copiar. Hazlo manualmente.', 'error');
    });
  };

  async function cargarCupones() {
    try {
      const res  = await fetch('/api/cupones/disponibles');
      const json = await res.json();
      document.getElementById('loadingCupones').style.display = 'none';

      if (!res.ok || json.status !== 'ok' || json.data.length === 0) {
        document.getElementById('cuponesGrid').innerHTML =
          '<div class="col-12 text-center py-5 text-secondary">No hay cupones disponibles en este momento.</div>';
        document.getElementById('cuponesGrid').style.display = 'flex';
        return;
      }

      const isDemo = (c) => c.codigo === 'DEMO50';
      const fmt = (d) => new Date(d).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });

      const grid = document.getElementById('cuponesGrid');
      grid.style.display = '';
      grid.innerHTML = json.data.map(c => `
        <div class="col-12 col-md-6">
          <div class="cupon-card ${isDemo(c) ? 'demo' : ''}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
              <div>
                <div class="cupon-pct">${c.descuento_porcentaje}%</div>
                <div style="font-size:.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">de descuento</div>
                ${isDemo(c) ? '<span class="badge-demo">Solo demo</span>' : ''}
              </div>
              <div style="text-align:right;">
                <div class="cupon-codigo" onclick="navigator.clipboard?.writeText('${c.codigo}')">${c.codigo}</div>
                <div class="cupon-vence">
                  <i class="fa-regular fa-calendar"></i>
                  Válido hasta ${fmt(c.fecha_fin)}
                </div>
                ${c.usos_maximos !== null ? `<div class="cupon-vence"><i class="fa-solid fa-users"></i> ${c.usos_maximos - c.usos_actuales} usos restantes</div>` : '<div class="cupon-vence"><i class="fa-solid fa-infinity"></i> Usos ilimitados</div>'}
              </div>
            </div>
            <div style="margin-top:16px;">
              <button class="btn-copy" onclick="copiarCodigo(this, '${c.codigo}')">
                <i class="fa-solid fa-copy"></i> Copiar código
              </button>
            </div>
          </div>
        </div>
      `).join('');

      document.getElementById('instrucciones').style.display = 'block';
    } catch (err) {
      console.error(err);
      document.getElementById('loadingCupones').style.display = 'none';
      document.getElementById('cuponesGrid').innerHTML =
        '<div class="col-12 text-center py-5 text-danger">Error al cargar los cupones. Intenta más tarde.</div>';
      document.getElementById('cuponesGrid').style.display = 'flex';
    }
  }

  cargarCupones();
})();
