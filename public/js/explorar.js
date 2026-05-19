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

  // ─── Paginación State ───
  let paginaActual = 1;
  const LIMIT_POR_PAGINA = 6;

  // ─── Favoritos State ───
  let favoritosIds = new Set();

  // ─── DOM References ───
  const catalogGrid      = document.getElementById('catalogGrid');
  const loadingCatalog   = document.getElementById('loadingCatalog');
  const emptyCatalog     = document.getElementById('emptyCatalog');
  const resultsCount     = document.getElementById('resultsCount');
  const totalResults     = document.getElementById('totalResults');
  const paginationContainer = document.getElementById('paginationContainer');
  const paginationList      = document.getElementById('paginationList');

  const filtroBusqueda   = document.getElementById('filtroBusqueda');
  const filtroEntrada    = document.getElementById('filtroEntrada');
  const filtroSalida     = document.getElementById('filtroSalida');
  const filtroPrecioMin  = document.getElementById('filtroPrecioMin');
  const filtroPrecioMax  = document.getElementById('filtroPrecioMax');
  const filtroTipo       = document.getElementById('filtroTipoVehiculo');
  const filtroSeguridad  = document.getElementById('filtroSeguridad');
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
      document.documentElement.classList.add('dark');
      if (themeIcon) themeIcon.textContent = 'light_mode';
    }
  }

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

  // ─── Fetch & Render ───
  async function cargarGarajes() {
    // Show loading
    loadingCatalog.style.display = 'block';
    catalogGrid.innerHTML = '';
    emptyCatalog.style.display = 'none';
    resultsCount.style.display = 'none';

    // Build query string
    const params = new URLSearchParams();
    const busqueda = filtroBusqueda.value.trim();
    const fEntrada = filtroEntrada.value;
    const fSalida  = filtroSalida.value;
    const precioMin = filtroPrecioMin.value.trim();
    const precioMax = filtroPrecioMax.value.trim();
    const tipoVehiculo = filtroTipo.value;
    const nivelSeguridad = filtroSeguridad.value;
    const metodoAcceso = document.querySelector('input[name="filtroAcceso"]:checked')?.value;

    // Validación Fechas
    if (fEntrada || fSalida) {
      if (!fEntrada || !fSalida) {
        alert('Debe establecer tanto la fecha de entrada como la de salida.');
        loadingCatalog.style.display = 'none';
        return;
      }
      
      const inDate = new Date(fEntrada);
      const outDate = new Date(fSalida);
      
      if (outDate <= inDate) {
        alert('La fecha de salida debe ser posterior a la fecha de llegada.');
        loadingCatalog.style.display = 'none';
        return;
      }

      params.set('fecha_entrada', fEntrada);
      params.set('fecha_salida', fSalida);
    }

    if (busqueda) params.set('busqueda', busqueda);
    if (precioMin && Number(precioMin) >= 0) params.set('precio_min', Math.max(0, Number(precioMin)));
    if (precioMax && Number(precioMax) >= 0) params.set('precio_max', Math.max(0, Number(precioMax)));
    if (tipoVehiculo) params.set('tipo_vehiculo', tipoVehiculo);
    if (nivelSeguridad) params.set('nivel_seguridad', nivelSeguridad);
    if (metodoAcceso) params.set('metodo_acceso', metodoAcceso);

    // Parametros de Paginación
    params.set('page', paginaActual);
    params.set('limit', LIMIT_POR_PAGINA);

    const queryString = params.toString();
    const url = '/api/explorar' + (queryString ? `?${queryString}` : '');

    try {
      const response = await fetch(url);
      const json = await response.json();

      loadingCatalog.style.display = 'none';

      if (json.status !== 'ok' || !json.datos || json.datos.length === 0) {
        emptyCatalog.style.display = 'block';
        resultsCount.style.display = 'none';
        paginationContainer.style.display = 'none';
        return;
      }

      const garajes = json.datos;
      const paginacion = json.paginacion || { totalRegistros: garajes.length };

      // Show total results count from pagination metadata
      totalResults.textContent = paginacion.totalRegistros;
      resultsCount.style.display = 'flex';

      // Render cards
      garajes.forEach((g, index) => {
        const card = crearTarjeta(g, index);
        catalogGrid.appendChild(card);
      });

      // Attach favorite handlers and sync visual state after cards are in DOM
      catalogGrid.querySelectorAll('.btn-fav-heart').forEach(btn => {
        btn.addEventListener('click', handleFavToggle);
      });
      sincronizarFavoritos();

      // Render Pagination
      renderPaginacion(paginacion);

    } catch (err) {
      console.error('Error al cargar garajes:', err);
      loadingCatalog.style.display = 'none';
      emptyCatalog.style.display = 'block';
      paginationContainer.style.display = 'none';
    }
  }

  // ─── Create Garage Card ───
  function crearTarjeta(garaje, index) {
    // IMPORTANT: Use a <div> instead of <a> so nested <button> receives click events
    const card = document.createElement('div');
    card.className = 'explore-card';
    card.dataset.garajeId = garaje.id;
    card.style.animationDelay = `${0.05 * (index % 9)}s`;

    // Image section
    let imagenHTML;
    if (garaje.foto_portada) {
      imagenHTML = `<img src="${garaje.foto_portada}" alt="Foto de ${garaje.direccion}" class="explore-card-img" loading="lazy">`;
    } else {
      imagenHTML = `
        <div class="explore-card-img-placeholder">
          <i class="fa-solid fa-warehouse"></i>
          <span>Sin foto</span>
        </div>`;
    }

    // Vehicle type icon
    const tipoIcons = { auto: 'fa-car-side', moto: 'fa-motorcycle', camioneta: 'fa-truck-pickup' };
    const tipoLabel = TIPO_LABELS[garaje.tipo_vehiculo] || garaje.tipo_vehiculo;
    const tipoIcon = tipoIcons[garaje.tipo_vehiculo] || 'fa-car';

    // Security icon
    const segIcons = { 'Básico': 'fa-shield', 'Estándar': 'fa-shield-halved', 'Premium': 'fa-shield-heart' };
    const segIcon = segIcons[garaje.nivel_seguridad] || 'fa-shield-halved';

    // Price formatting
    const precio = parseFloat(garaje.precio_hora).toFixed(2);

    // Description preview
    const descripcion = garaje.descripcion
      ? garaje.descripcion
      : 'Espacio de parqueo disponible.';

    const isFav = favoritosIds.has(garaje.id);

    card.innerHTML = `
      <div class="explore-card-img-wrapper">
        ${imagenHTML}
        <div class="explore-card-overlay"></div>
        <span class="explore-card-tag">
          <i class="fa-solid ${tipoIcon}"></i> ${tipoLabel}
        </span>
        <button class="btn-fav-heart ${isFav ? 'is-fav' : ''}" data-garaje-id="${garaje.id}" title="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
          <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
        </button>
        <div class="explore-card-price-float">
          <span class="price-amount">Bs. ${precio}</span>
          <span class="price-unit">/ hora</span>
        </div>
      </div>
      <div class="explore-card-body">
        <div class="explore-card-direccion">${garaje.direccion}</div>
        <div class="explore-card-descripcion">${descripcion}</div>
        
        <div class="explore-card-chips">
          <span class="chip-seg"><i class="fa-solid ${segIcon}"></i> ${garaje.nivel_seguridad || 'Estándar'}</span>
          <span class="chip-access"><i class="fa-solid fa-right-to-bracket"></i> ${garaje.metodo_acceso || 'Manual'}</span>
        </div>

        <div class="explore-card-footer">
          <span class="explore-card-cta">
            Ver detalles <i class="fa-solid fa-arrow-right"></i>
          </span>
        </div>
      </div>
    `;

    // Navigate to detail on card body click (not on heart button)
    card.querySelector('.explore-card-body').addEventListener('click', () => {
      window.location.href = `detalle-garaje.html?id=${garaje.id}`;
    });
    card.querySelector('.explore-card-img-wrapper').addEventListener('click', (e) => {
      // Only navigate if not clicking the heart button
      if (!e.target.closest('.btn-fav-heart')) {
        window.location.href = `detalle-garaje.html?id=${garaje.id}`;
      }
    });

    return card;
  }

  // ─── Render Pagination ───
  function renderPaginacion(paginacion) {
    if (paginacion.totalPaginas <= 1) {
      paginationContainer.style.display = 'none';
      return;
    }

    paginationContainer.style.display = 'block';
    let html = '';

    // Botón Anterior
    const prevDisabled = paginacion.paginaActual === 1 ? 'disabled' : '';
    html += `
      <li class="page-item ${prevDisabled}">
        <a class="page-link" href="#" onclick="event.preventDefault(); cambiarPagina(${paginacion.paginaActual - 1})">
          <i class="fa-solid fa-chevron-left"></i> Anterior
        </a>
      </li>
    `;

    // Botones de Páginas
    for (let i = 1; i <= paginacion.totalPaginas; i++) {
      const active = i === paginacion.paginaActual ? 'active' : '';
      html += `
        <li class="page-item ${active}">
          <a class="page-link" href="#" onclick="event.preventDefault(); cambiarPagina(${i})">${i}</a>
        </li>
      `;
    }

    // Botón Siguiente
    const nextDisabled = paginacion.paginaActual === paginacion.totalPaginas ? 'disabled' : '';
    html += `
      <li class="page-item ${nextDisabled}">
        <a class="page-link" href="#" onclick="event.preventDefault(); cambiarPagina(${paginacion.paginaActual + 1})">
          Siguiente <i class="fa-solid fa-chevron-right"></i>
        </a>
      </li>
    `;

    paginationList.innerHTML = html;
  }

  // Hacer que cambiarPagina sea global para que el onClick la encuentre
  window.cambiarPagina = function(nuevaPagina) {
    paginaActual = nuevaPagina;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    cargarGarajes();
  };

  // ─── Event Listeners ───
  btnBuscar.addEventListener('click', () => {
    paginaActual = 1; // Reset a primera página al buscar
    cargarGarajes();
  });

  btnLimpiar.addEventListener('click', () => {
    filtroBusqueda.value = '';
    filtroEntrada.value = '';
    filtroSalida.value = '';
    filtroPrecioMin.value = '';
    filtroPrecioMax.value = '';
    filtroTipo.value = '';
    filtroSeguridad.value = '';
    const defaultAcceso = document.querySelector('input[name="filtroAcceso"][value=""]');
    if (defaultAcceso) defaultAcceso.checked = true;
    
    paginaActual = 1; // Reset a primera página
    cargarGarajes();
  });

  // Allow pressing Enter in filter inputs to trigger search
  [filtroBusqueda, filtroPrecioMin, filtroPrecioMax].forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        paginaActual = 1; // Reset a primera página al buscar
        cargarGarajes();
      }
    });
  });

  // ─── Favoritos: toggle handler ───
  async function handleFavToggle(e) {
    e.preventDefault();
    e.stopPropagation(); // Evitar que el click navegue al detalle

    const btn = e.currentTarget;
    const garajeId = parseInt(btn.dataset.garajeId, 10);
    const icon = btn.querySelector('i');

    // Animación de pulso
    btn.classList.add('fav-pulse');
    setTimeout(() => btn.classList.remove('fav-pulse'), 400);

    try {
      const resp = await fetch('/api/favoritos/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conductor_id: currentUser.id, garaje_id: garajeId })
      });
      const json = await resp.json();

      if (json.status === 'ok') {
        if (json.favorito) {
          favoritosIds.add(garajeId);
          btn.classList.add('is-fav');
          icon.className = 'fa-solid fa-heart';
          btn.title = 'Quitar de favoritos';
        } else {
          favoritosIds.delete(garajeId);
          btn.classList.remove('is-fav');
          icon.className = 'fa-regular fa-heart';
          btn.title = 'Agregar a favoritos';
        }
      }
    } catch (err) {
      console.error('Error al toggle favorito:', err);
    }
  }

  // ─── Cargar IDs de favoritos ───
  async function cargarFavoritosIds() {
    try {
      const resp = await fetch(`/api/favoritos/ids?conductor_id=${currentUser.id}`);
      const json = await resp.json();
      if (json.status === 'ok' && Array.isArray(json.ids)) {
        favoritosIds = new Set(json.ids.map(Number));
      }
    } catch (err) {
      console.error('Error al cargar favoritos:', err);
    }
  }

  function sincronizarFavoritos() {
    document.querySelectorAll('.btn-fav-heart').forEach(btn => {
      const id = Number(btn.dataset.garajeId);
      const icon = btn.querySelector('i');
      if (favoritosIds.has(id)) {
        btn.classList.add('is-fav');
        if (icon) icon.className = 'fa-solid fa-heart';
        btn.title = 'Quitar de favoritos';
      } else {
        btn.classList.remove('is-fav');
        if (icon) icon.className = 'fa-regular fa-heart';
        btn.title = 'Agregar a favoritos';
      }
    });
  }

  // ─── Init ───
  // Prevenir seleccionar fechas pasadas en frontend
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const nowStr = now.toISOString().slice(0, 16);
  if (filtroEntrada) filtroEntrada.min = nowStr;
  if (filtroSalida) filtroSalida.min = nowStr;

  initTheme();
  // Cargar favoritos primero, luego garajes
  cargarFavoritosIds().then(() => cargarGarajes());

})();
