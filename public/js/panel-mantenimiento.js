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
  const emptyEspacios    = document.getElementById('emptyEspacios');
  const panelStats       = document.getElementById('panelStats');
  const panelOcc         = document.getElementById('panelOcc');

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
    if (btnThemeToggle && !btnThemeToggle.dataset.bound) {
      btnThemeToggle.dataset.bound = '1';
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
  if (btnLogout && !btnLogout.dataset.bound) {
    btnLogout.dataset.bound = '1';
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

  // ─── Formatear hora a HH:MM (oculta valores corruptos como fechas) ───
  function fmtHora(v) {
    const s = String(v ?? '').trim();
    if (!/^\d{1,2}:\d{2}$/.test(s)) return null;
    return s.length === 4 ? '0' + s : s;
  }

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

      // Show schedule info (solo si las horas tienen formato HH:MM válido)
      const apertura = fmtHora(garaje.hora_apertura);
      const cierre = fmtHora(garaje.hora_cierre);
      if (apertura && cierre) {
        scheduleLabel.textContent = `${apertura} — ${cierre}`;
        daysLabel.textContent = DIAS_LABELS[garaje.dias_operativos] || garaje.dias_operativos || '';
        panelScheduleInfo.style.display = 'flex';
      } else {
        panelScheduleInfo.style.display = 'none';
      }

      // Garaje sin espacios configurados
      if (!espacios || espacios.length === 0) {
        if (panelStats) panelStats.style.display = 'none';
        if (panelOcc) panelOcc.style.display = 'none';
        mapaLegend.style.display = 'none';
        mapaContainer.style.display = 'none';
        if (emptyEspacios) emptyEspacios.style.display = 'block';
        return;
      }
      if (emptyEspacios) emptyEspacios.style.display = 'none';

      // Stats + ocupación
      renderStats(espacios);

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

  // ─── Render Stats / Ocupación ───
  function renderStats(espacios) {
    const total = espacios.length;
    const libres = espacios.filter(e => e.estado === 'libre').length;
    const ocupados = espacios.filter(e => e.estado === 'ocupado').length;
    const mant = espacios.filter(e => e.estado === 'mantenimiento').length;

    const setNum = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n; };
    setNum('pmTotal', total);
    setNum('pmLibres', libres);
    setNum('pmOcupados', ocupados);
    setNum('pmMant', mant);

    const pct = (n) => total ? (n / total * 100) : 0;
    const setW = (id, n) => { const el = document.getElementById(id); if (el) el.style.width = pct(n) + '%'; };
    setW('pmSegLibre', libres);
    setW('pmSegOcupado', ocupados);
    setW('pmSegMant', mant);

    const occEl = document.getElementById('pmOccPct');
    if (occEl) occEl.textContent = `${total ? Math.round(ocupados / total * 100) : 0}% ocupado`;

    if (panelStats) panelStats.style.display = 'block';
    if (panelOcc) panelOcc.style.display = 'block';
  }

  // ─── Helpers de presentación ───
  const ESTADO_LABEL = { libre: 'Libre', ocupado: 'Ocupado', mantenimiento: 'Mantenimiento' };
  const TIPO_LABEL = { auto: 'Auto', moto: 'Moto', camioneta: 'Camioneta', techado: 'Techado' };
  function esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // ─── Vista cenital del cajón de estacionamiento (SVG) ───
  function svgBahia(estado) {
    const linea = estado === 'libre' ? '#0E7C66' : estado === 'ocupado' ? '#B23A33' : '#C77B0A';
    const lineas = `
      <path d="M14 8 V84" stroke="${linea}" stroke-width="4" stroke-linecap="round" opacity=".5"/>
      <path d="M106 8 V84" stroke="${linea}" stroke-width="4" stroke-linecap="round" opacity=".5"/>`;
    let centro;
    if (estado === 'ocupado') {
      centro = `
        <g>
          <rect x="42" y="13" width="36" height="66" rx="12" fill="#3a4656"/>
          <rect x="47" y="19" width="26" height="13" rx="4" fill="#aeb8c6"/>
          <rect x="47" y="60" width="26" height="11" rx="4" fill="#99a5b5"/>
          <rect x="36" y="24" width="6" height="14" rx="2" fill="#222b38"/>
          <rect x="78" y="24" width="6" height="14" rx="2" fill="#222b38"/>
          <rect x="36" y="54" width="6" height="14" rx="2" fill="#222b38"/>
          <rect x="78" y="54" width="6" height="14" rx="2" fill="#222b38"/>
        </g>`;
    } else if (estado === 'mantenimiento') {
      centro = `
        <g opacity=".4" stroke="#C77B0A" stroke-width="7" stroke-linecap="round">
          <line x1="24" y1="80" x2="62" y2="20"/>
          <line x1="46" y1="84" x2="86" y2="24"/>
          <line x1="68" y1="84" x2="102" y2="32"/>
        </g>
        <g>
          <polygon points="60,36 73,72 47,72" fill="#E08A12"/>
          <rect x="44" y="71" width="32" height="6" rx="3" fill="#B45309"/>
          <rect x="53" y="50" width="14" height="5" rx="1" fill="#fff" opacity=".92"/>
        </g>`;
    } else {
      centro = `
        <path d="M51 32 L60 22 L69 32" fill="none" stroke="${linea}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
        <text x="60" y="72" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="30" fill="${linea}" opacity=".15">P</text>`;
    }
    return `<svg viewBox="0 0 120 92" class="ps-bay-svg" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${lineas}${centro}</svg>`;
  }

  const CTA = {
    libre:         { cls: 'maint',  icon: 'build',       txt: 'Poner en mantenimiento' },
    mantenimiento: { cls: 'free',   icon: 'restart_alt', txt: 'Habilitar espacio' },
    ocupado:       { cls: 'locked', icon: 'lock',        txt: 'Espacio en uso' },
  };

  // ─── Render Map ───
  function renderMapa(espacios, garajeId) {
    mapaPanel.innerHTML = '';

    const maxCol = Math.max(...espacios.map(e => e.columna || 1), 1);
    // Tarjetas de tamaño contenido (no estiradas) respetando el orden del plano
    mapaPanel.style.gridTemplateColumns = `repeat(${maxCol}, minmax(0, 200px))`;

    espacios.forEach(esp => {
      const slot = document.createElement('div');

      let stateClass = 'panel-slot';
      if (esp.estado === 'ocupado') stateClass += ' ocupado';
      else if (esp.estado === 'mantenimiento') stateClass += ' mantenimiento';
      else stateClass += ' libre';

      slot.className = stateClass;
      slot.dataset.id = esp.id;
      slot.dataset.estado = esp.estado;

      const tipoLabel = TIPO_LABEL[esp.tipo_vehiculo] || 'Auto';
      const estadoLabel = ESTADO_LABEL[esp.estado] || esp.estado;
      const cta = CTA[esp.estado] || CTA.libre;
      const ctaTag = esp.estado === 'ocupado' ? 'span' : 'button';
      const ctaAttr = esp.estado === 'ocupado' ? '' : ' type="button"';

      slot.innerHTML = `
        <div class="ps-top">
          <span class="ps-code">${esc(esp.numero_espacio)}</span>
          <span class="ps-state"><span class="ps-dot"></span>${esc(estadoLabel)}</span>
        </div>
        <div class="ps-bay">${svgBahia(esp.estado)}</div>
        <div class="ps-bottom">
          <span class="ps-type"><span class="material-symbols-outlined">directions_car</span>${esc(tipoLabel)}</span>
          <${ctaTag} class="ps-cta ps-cta--${cta.cls}"${ctaAttr}><span class="material-symbols-outlined">${cta.icon}</span>${esc(cta.txt)}</${ctaTag}>
        </div>
      `;

      // Click handler (only for libre <-> mantenimiento)
      if (esp.estado !== 'ocupado') {
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
