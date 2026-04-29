// ============================================================
// EstAirbnb — panel-mantenimiento.js
// Lógica del Panel de Mantenimiento de Espacios (Anfitrión)
// ============================================================

(function () {
  'use strict';

  const USUARIO_KEY = 'estairbnb_user';
  const currentUser = JSON.parse(localStorage.getItem(USUARIO_KEY) || 'null');

  // Verificar sesión y rol
  if (!currentUser || !currentUser.id) {
    window.location.href = '/login.html';
    return;
  }
  if (currentUser.rol_id !== 1) {
    window.location.href = '/configuracion.html';
    return;
  }

  // ─── DOM Elements ───
  const panelTitle       = document.getElementById('panelTitle');
  const panelSubtitle    = document.getElementById('panelSubtitle');
  const scheduleLabel    = document.getElementById('scheduleLabel');
  const daysLabel        = document.getElementById('daysLabel');
  const panelScheduleInfo = document.getElementById('panelScheduleInfo');
  const loadingPanel     = document.getElementById('loadingPanel');
  const mapaLegend       = document.getElementById('mapaLegend');
  const mapaContainer    = document.getElementById('mapaContainer');
  const mapaPanel        = document.getElementById('mapaPanel');
  const errorState       = document.getElementById('errorState');

  // ─── Get ID from URL ───
  function getGarajeId() {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get('id'), 10);
  }

  // ─── Theme Toggle ───
  function initTheme() {
    const themeIcon = document.getElementById('themeIcon');
    const saved = localStorage.getItem('estairbnb_theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      if (themeIcon) themeIcon.textContent = 'light_mode';
    }

    const btnThemeToggle = document.getElementById('btnThemeToggle');
    if (btnThemeToggle) {
      btnThemeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        if (isDark) {
          document.documentElement.classList.remove('dark');
          if (themeIcon) themeIcon.textContent = 'dark_mode';
          localStorage.setItem('estairbnb_theme', 'light');
        } else {
          document.documentElement.classList.add('dark');
          if (themeIcon) themeIcon.textContent = 'light_mode';
          localStorage.setItem('estairbnb_theme', 'dark');
        }
      });
    }
  }

  // ─── Logout ───
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem(USUARIO_KEY);
      window.location.href = '/login.html';
    });
  }

  // ─── Toast ───
  function showToast(msg, type = 'success') {
    const toastEl = document.getElementById('toastNotification');
    const toastBody = document.getElementById('toastBody');
    const toastMsg = document.getElementById('toastMessage');

    toastEl.className = `toast toast-${type}`;
    toastBody.querySelector('i').className =
      type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation';
    toastMsg.textContent = msg;

    const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
    toast.show();
  }

  // ─── Vehicle icon map ───
  const ICON_MAP = {
    auto: 'fa-car',
    moto: 'fa-motorcycle',
    camioneta: 'fa-truck-pickup',
    techado: 'fa-warehouse'
  };

  // ─── Días operativos label ───
  const DIAS_LABELS = {
    'L-D': 'Lunes a Domingo',
    'L-V': 'Lunes a Viernes',
    'L-S': 'Lunes a Sábado',
    'S-D': 'Sábado y Domingo'
  };

  // ─── Load Panel Data ───
  async function cargarPanel() {
    const garajeId = getGarajeId();
    if (!garajeId) {
      showError();
      return;
    }

    try {
      const res = await fetch(`/api/garajes/${garajeId}/espacios-admin?usuario_id=${currentUser.id}`);
      const json = await res.json();

      loadingPanel.style.display = 'none';

      if (!res.ok || json.status !== 'ok') {
        showError();
        return;
      }

      const { garaje, espacios } = json.data;

      // Update header
      panelTitle.textContent = `Mantenimiento: ${garaje.direccion}`;
      panelSubtitle.textContent = `${espacios.length} espacio(s) — Bs. ${Number(garaje.precio_hora).toFixed(2)}/hora`;
      document.title = `Mantenimiento: ${garaje.direccion} · EstAirbnb`;

      // Show schedule info
      if (garaje.hora_apertura && garaje.hora_cierre) {
        const apertura = String(garaje.hora_apertura).substring(0, 5);
        const cierre = String(garaje.hora_cierre).substring(0, 5);
        scheduleLabel.textContent = `${apertura} — ${cierre}`;
        daysLabel.textContent = DIAS_LABELS[garaje.dias_operativos] || garaje.dias_operativos;
        panelScheduleInfo.style.display = 'flex';
      }

      // Render map
      renderMapa(espacios, garajeId);
      mapaLegend.style.display = 'flex';
      mapaContainer.style.display = 'block';

    } catch (err) {
      console.error('Error al cargar panel:', err);
      loadingPanel.style.display = 'none';
      showError();
    }
  }

  function showError() {
    loadingPanel.style.display = 'none';
    errorState.style.display = 'block';
  }

  // ─── Render Map ───
  function renderMapa(espacios, garajeId) {
    mapaPanel.innerHTML = '';

    const maxCol = Math.max(...espacios.map(e => e.columna || 1), 1);
    mapaPanel.style.gridTemplateColumns = `repeat(${maxCol}, 1fr)`;

    espacios.forEach(esp => {
      const slot = document.createElement('div');

      let stateClass = 'panel-slot';
      if (esp.estado === 'ocupado') stateClass += ' ocupado';
      else if (esp.estado === 'mantenimiento') stateClass += ' mantenimiento';
      else stateClass += ' libre';

      slot.className = stateClass;
      slot.dataset.id = esp.id;
      slot.dataset.estado = esp.estado;

      const iconClass = ICON_MAP[esp.tipo_vehiculo] || 'fa-car';

      const statusIcon = esp.estado === 'mantenimiento' ? '<i class="fa-solid fa-wrench status-icon-maint"></i>' :
                          esp.estado === 'ocupado' ? '<i class="fa-solid fa-lock status-icon-locked"></i>' : '';

      slot.innerHTML = `
        ${statusIcon}
        <i class="fa-solid ${iconClass}" style="font-size:1.3rem;margin-bottom:4px;"></i>
        <div class="panel-slot-name">${esp.numero_espacio}</div>
        <div class="panel-slot-status">${esp.estado}</div>
      `;

      // Click handler (only for libre <-> mantenimiento)
      if (esp.estado !== 'ocupado') {
        slot.style.cursor = 'pointer';
        slot.addEventListener('click', () => toggleEspacioEstado(esp, slot, garajeId));
      }

      mapaPanel.appendChild(slot);
    });
  }

  // ─── Toggle Space State ───
  async function toggleEspacioEstado(espacio, slotEl, garajeId) {
    const nuevoEstado = espacio.estado === 'libre' ? 'mantenimiento' : 'libre';

    // Optimistic UI update
    slotEl.style.opacity = '0.5';
    slotEl.style.pointerEvents = 'none';

    try {
      const res = await fetch(`/api/garajes/espacio/${espacio.id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: currentUser.id, estado: nuevoEstado })
      });

      const json = await res.json();

      if (res.ok && json.status === 'ok') {
        showToast(json.message);
        // Reload the whole map to keep in sync
        await cargarPanel();
      } else {
        showToast(json.message || 'Error al cambiar estado.', 'error');
        slotEl.style.opacity = '1';
        slotEl.style.pointerEvents = '';
      }

    } catch (err) {
      console.error('Error al cambiar estado:', err);
      showToast('No se pudo conectar con el servidor.', 'error');
      slotEl.style.opacity = '1';
      slotEl.style.pointerEvents = '';
    }
  }

  // ─── Init ───
  initTheme();
  cargarPanel();

})();
