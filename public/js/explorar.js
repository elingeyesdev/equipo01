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

  // ─── DOM References ───
  const catalogGrid = document.getElementById('catalogGrid');
  const loadingCatalog = document.getElementById('loadingCatalog');
  const emptyCatalog = document.getElementById('emptyCatalog');
  const resultsCount = document.getElementById('resultsCount');
  const totalResults = document.getElementById('totalResults');
  const paginationContainer = document.getElementById('paginationContainer');
  const paginationList = document.getElementById('paginationList');

  const filtroBusqueda = document.getElementById('filtroBusqueda');
  const filtroEntrada = document.getElementById('filtroEntrada');
  const filtroSalida = document.getElementById('filtroSalida');
  const filtroPrecioMin = document.getElementById('filtroPrecioMin');
  const filtroPrecioMax = document.getElementById('filtroPrecioMax');
  const filtroTipo = document.getElementById('filtroTipoVehiculo');
  const btnBuscar = document.getElementById('btnBuscar');
  const btnLimpiar = document.getElementById('btnLimpiar');

  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const themeIcon = document.getElementById('themeIcon');

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
    const fSalida = filtroSalida.value;
    const precioMin = filtroPrecioMin.value.trim();
    const precioMax = filtroPrecioMax.value.trim();
    const tipoVehiculo = filtroTipo.value;

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
    if (precioMin) params.set('precio_min', precioMin);
    if (precioMax) params.set('precio_max', precioMax);
    if (tipoVehiculo) params.set('tipo_vehiculo', tipoVehiculo);

    // Parametros de Paginación
    params.set('page', paginaActual);
    params.set('limit', LIMIT_POR_PAGINA);
    params.set('usuario_id', currentUser.id);

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
    console.log("renderizando tarjeta", garaje.id);

    const card = document.createElement('a');
    card.href = `detalle-garaje.html?id=${garaje.id}`;
    card.className = 'explore-card';
    card.style.animationDelay = `${0.05 * (index % 9)}s`;

    let imagenHTML;
    if (garaje.foto_portada) {
      imagenHTML = `<img src="${garaje.foto_portada}" 
      style="width:100%; height:200px; object-fit:cover; display:block;" 
      alt="Foto de ${garaje.direccion}">`;
    } else {
      imagenHTML = `
      <div style="height:200px; display:flex; align-items:center; justify-content:center; background:#eee;">
        <span>Sin foto</span>
      </div>`;
    }

    const tipoLabel = TIPO_LABELS[garaje.tipo_vehiculo] || garaje.tipo_vehiculo;
    const precio = parseFloat(garaje.precio_hora).toFixed(2);
    const descripcion = garaje.descripcion || 'Espacio de parqueo disponible.';

    card.innerHTML = `
  <div style="
    position:relative;
    width:100%;
    height:200px;
    overflow:hidden;
    border-radius:10px;
  ">

    ${garaje.foto_portada
        ? `<img src="${garaje.foto_portada}" 
              style="width:100%; height:100%; object-fit:cover;">`
        : `<div style="
              width:100%;
              height:100%;
              display:flex;
              align-items:center;
              justify-content:center;
              background:#ddd;">
              Sin foto
           </div>`
      }

<!-- ❤️ FAVORITO -->
<button 
  class="btn-favorito"
  data-id="${garaje.id}"
  style="
    position:absolute;
    top:10px;
    right:10px;
    width:40px;
    height:40px;
    border:none;
    border-radius:50%;
    background:white;
    color:#ff4757;
    font-size:18px;
    cursor:pointer;
    z-index:9999;
  ">
  <i class="${garaje.es_favorito ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
</button>

  </div>

  <div class="explore-card-body">
    <div class="explore-card-direccion">${garaje.direccion}</div>
    <div class="explore-card-descripcion">${descripcion}</div>
    <div class="explore-card-footer">
      <span class="explore-card-precio">
        Bs. ${precio} <small>/ hora</small>
      </span>
      <span class="explore-card-action">
        Ver detalles →
      </span>
    </div>
  </div>
`;

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
  window.cambiarPagina = function (nuevaPagina) {
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

  // ─── Init ───
  // Prevenir seleccionar fechas pasadas en frontend
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const nowStr = now.toISOString().slice(0, 16);
  if (filtroEntrada) filtroEntrada.min = nowStr;
  if (filtroSalida) filtroSalida.min = nowStr;

  initTheme();
  cargarGarajes();

})();
