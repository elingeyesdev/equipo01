// ============================================================
// EstAirbnb — detalle.js
// Lógica para la Vista de Detalle de un Garaje
// ============================================================

(function () {
  'use strict';

  // ─── Session Check ───
  const USUARIO_KEY = 'estairbnb_user';
  const currentUser = JSON.parse(localStorage.getItem(USUARIO_KEY) || 'null');

  // Si no está logueado, redirigir a login
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  // Si es Anfitrión (rol_id = 1), no puede ver Detalle
  if (currentUser.rol_id === 1) {
    window.location.href = '/mis-garajes.html';
    return;
  }

  // ─── DOM References ───
  const loadingDetalle   = document.getElementById('loadingDetalle');
  const errorDetalle     = document.getElementById('errorDetalle');
  const detalleContent   = document.getElementById('detalleContent');
  const carouselSection  = document.getElementById('carouselSection');
  const breadcrumbTitle  = document.getElementById('breadcrumbTitle');

  const garajeTitulo     = document.getElementById('garajeTitulo');
  const garajeDireccion  = document.getElementById('garajeDireccion');
  const garajePrecio     = document.getElementById('garajePrecio');
  const garajeTipo       = document.getElementById('garajeTipo');
  const tipoIcon         = document.getElementById('tipoIcon');
  const garajeDescripcion = document.getElementById('garajeDescripcion');
  const descripcionContainer = document.getElementById('descripcionContainer');
  const btnReserva       = document.getElementById('btnReserva');

  const btnThemeToggle   = document.getElementById('btnThemeToggle');
  const themeIcon        = document.getElementById('themeIcon');

  // ─── Vehicle type config ───
  const TIPO_CONFIG = {
    auto:      { label: '🚗 Auto',          icon: 'fa-car' },
    moto:      { label: '🏍️ Moto',          icon: 'fa-motorcycle' },
    camioneta: { label: '🚙 Camioneta / SUV', icon: 'fa-truck-pickup' }
  };

  // ─── Theme Toggle ───
  function initTheme() {
    const saved = localStorage.getItem('estairbnb_theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeIcon.classList.replace('fa-moon', 'fa-sun');
    }
  }

  btnThemeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      themeIcon.classList.replace('fa-sun', 'fa-moon');
      localStorage.setItem('estairbnb_theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeIcon.classList.replace('fa-moon', 'fa-sun');
      localStorage.setItem('estairbnb_theme', 'dark');
    }
  });

  // ─── Get ID from URL ───
  function getGarajeId() {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get('id'), 10);
  }

  // ─── Build Bootstrap 5 Carousel ───
  function renderCarousel(fotos) {
    if (!fotos || fotos.length === 0) {
      carouselSection.innerHTML = `
        <div class="carousel-placeholder">
          <i class="fa-solid fa-image"></i>
          <span>Este espacio no tiene fotos</span>
        </div>`;
      return;
    }

    const indicators = fotos.map((_, i) => `
      <button type="button" data-bs-target="#garajeCarousel" data-bs-slide-to="${i}"
              class="${i === 0 ? 'active' : ''}" aria-label="Foto ${i + 1}"
              ${i === 0 ? 'aria-current="true"' : ''}></button>
    `).join('');

    const items = fotos.map((foto, i) => `
      <div class="carousel-item ${i === 0 ? 'active' : ''}">
        <img src="${foto.foto_url}" alt="Foto ${i + 1} del parqueo" loading="lazy">
      </div>
    `).join('');

    const showControls = fotos.length > 1;

    carouselSection.innerHTML = `
      <div id="garajeCarousel" class="carousel slide" data-bs-ride="carousel" data-bs-interval="5000">
        ${showControls ? `<div class="carousel-indicators">${indicators}</div>` : ''}
        <div class="carousel-inner">
          ${items}
        </div>
        ${showControls ? `
        <button class="carousel-control-prev" type="button" data-bs-target="#garajeCarousel" data-bs-slide="prev">
          <span class="carousel-control-prev-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Anterior</span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#garajeCarousel" data-bs-slide="next">
          <span class="carousel-control-next-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Siguiente</span>
        </button>
        ` : ''}
      </div>
    `;
  }

  // ─── Render Garaje Info ───
  function renderInfo(garaje) {
    // Title and address
    garajeTitulo.textContent = garaje.direccion;
    garajeDireccion.textContent = garaje.direccion;
    breadcrumbTitle.textContent = garaje.direccion;

    // Update page title
    document.title = `${garaje.direccion} · EstAirbnb`;

    // Price
    const precio = parseFloat(garaje.precio_hora).toFixed(2);
    garajePrecio.innerHTML = `Bs. ${precio} <small>/ hora</small>`;

    // Vehicle type
    const config = TIPO_CONFIG[garaje.tipo_vehiculo] || { label: garaje.tipo_vehiculo, icon: 'fa-car' };
    garajeTipo.textContent = config.label;
    tipoIcon.className = `fa-solid ${config.icon}`;

    // Description
    if (garaje.descripcion && garaje.descripcion.trim()) {
      garajeDescripcion.textContent = garaje.descripcion;
      descripcionContainer.style.display = 'flex';
    } else {
      descripcionContainer.style.display = 'none';
    }
  }

  // ─── Fetch Garaje Detail ───
  async function cargarDetalle() {
    const id = getGarajeId();

    if (!id) {
      showError();
      return;
    }

    try {
      const response = await fetch(`/api/explorar/${id}`);
      const json = await response.json();

      loadingDetalle.style.display = 'none';

      if (json.status !== 'ok' || !json.data) {
        showError();
        return;
      }

      const garaje = json.data;

      // Render sections
      renderCarousel(garaje.fotos);
      renderInfo(garaje);

      // Show content
      detalleContent.style.display = 'grid';

    } catch (err) {
      console.error('Error al cargar detalle:', err);
      showError();
    }
  }

  function showError() {
    loadingDetalle.style.display = 'none';
    errorDetalle.style.display = 'block';
    detalleContent.style.display = 'none';
  }

  // ─── Solicitar Reserva (placeholder Sprint 1) ───
  btnReserva.addEventListener('click', () => {
    alert('Funcionalidad para el Sprint 1');
  });

  // ─── Init ───
  initTheme();
  cargarDetalle();

})();
