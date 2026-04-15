// ============================================================
// EstAirbnb — explorar.js
// Lógica para el Catálogo de Exploración de Garajes
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

  // Si es Anfitrión (rol_id = 1), no puede ver Explorar
  if (currentUser.rol_id === 1) {
    window.location.href = '/mis-garajes.html';
    return;
  }

  // ─── DOM References ───
  const catalogGrid      = document.getElementById('catalogGrid');
  const loadingCatalog   = document.getElementById('loadingCatalog');
  const emptyCatalog     = document.getElementById('emptyCatalog');
  const resultsCount     = document.getElementById('resultsCount');
  const totalResults     = document.getElementById('totalResults');

  const filtroPrecioMin  = document.getElementById('filtroPrecioMin');
  const filtroPrecioMax  = document.getElementById('filtroPrecioMax');
  const filtroTipo       = document.getElementById('filtroTipoVehiculo');
  const btnBuscar        = document.getElementById('btnBuscar');
  const btnLimpiar       = document.getElementById('btnLimpiar');

  const btnThemeToggle   = document.getElementById('btnThemeToggle');
  const themeIcon        = document.getElementById('themeIcon');

  // ─── Vehicle type labels ───
  const TIPO_LABELS = {
    auto: '🚗 Auto',
    moto: '🏍️ Moto',
    camioneta: '🚙 Camioneta'
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

  // ─── Fetch & Render ───
  async function cargarGarajes() {
    // Show loading
    loadingCatalog.style.display = 'block';
    catalogGrid.innerHTML = '';
    emptyCatalog.style.display = 'none';
    resultsCount.style.display = 'none';

    // Build query string
    const params = new URLSearchParams();
    const precioMin = filtroPrecioMin.value.trim();
    const precioMax = filtroPrecioMax.value.trim();
    const tipoVehiculo = filtroTipo.value;

    if (precioMin) params.set('precio_min', precioMin);
    if (precioMax) params.set('precio_max', precioMax);
    if (tipoVehiculo) params.set('tipo_vehiculo', tipoVehiculo);

    const queryString = params.toString();
    const url = '/api/explorar' + (queryString ? `?${queryString}` : '');

    try {
      const response = await fetch(url);
      const json = await response.json();

      loadingCatalog.style.display = 'none';

      if (json.status !== 'ok' || !json.data || json.data.length === 0) {
        emptyCatalog.style.display = 'block';
        resultsCount.style.display = 'none';
        return;
      }

      const garajes = json.data;

      // Show results count
      totalResults.textContent = garajes.length;
      resultsCount.style.display = 'flex';

      // Render cards
      garajes.forEach((g, index) => {
        const card = crearTarjeta(g, index);
        catalogGrid.appendChild(card);
      });

    } catch (err) {
      console.error('Error al cargar garajes:', err);
      loadingCatalog.style.display = 'none';
      emptyCatalog.style.display = 'block';
    }
  }

  // ─── Create Garage Card ───
  function crearTarjeta(garaje, index) {
    const card = document.createElement('a');
    card.href = `detalle-garaje.html?id=${garaje.id}`;
    card.className = 'explore-card';
    card.style.animationDelay = `${0.05 * (index % 9)}s`;

    // Image section
    let imagenHTML;
    if (garaje.foto_portada) {
      imagenHTML = `<img src="${garaje.foto_portada}" alt="Foto de ${garaje.direccion}" class="explore-card-img" loading="lazy">`;
    } else {
      imagenHTML = `
        <div class="explore-card-img-placeholder">
          <i class="fa-solid fa-image"></i>
          <span>Sin foto</span>
        </div>`;
    }

    // Vehicle type label
    const tipoLabel = TIPO_LABELS[garaje.tipo_vehiculo] || garaje.tipo_vehiculo;

    // Price formatting
    const precio = parseFloat(garaje.precio_hora).toFixed(2);

    // Description preview
    const descripcion = garaje.descripcion
      ? garaje.descripcion
      : 'Espacio de parqueo disponible.';

    card.innerHTML = `
      <div class="explore-card-img-wrapper">
        ${imagenHTML}
        <span class="explore-card-tag">
          <i class="fa-solid fa-car"></i> ${tipoLabel}
        </span>
      </div>
      <div class="explore-card-body">
        <div class="explore-card-direccion">${garaje.direccion}</div>
        <div class="explore-card-descripcion">${descripcion}</div>
        <div class="explore-card-footer">
          <span class="explore-card-precio">
            Bs. ${precio} <small>/ hora</small>
          </span>
          <span class="explore-card-action">
            Ver detalles <i class="fa-solid fa-arrow-right"></i>
          </span>
        </div>
      </div>
    `;

    return card;
  }

  // ─── Event Listeners ───
  btnBuscar.addEventListener('click', () => {
    cargarGarajes();
  });

  btnLimpiar.addEventListener('click', () => {
    filtroPrecioMin.value = '';
    filtroPrecioMax.value = '';
    filtroTipo.value = '';
    cargarGarajes();
  });

  // Allow pressing Enter in filter inputs to trigger search
  [filtroPrecioMin, filtroPrecioMax].forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        cargarGarajes();
      }
    });
  });

  // ─── Init ───
  initTheme();
  cargarGarajes();

})();
