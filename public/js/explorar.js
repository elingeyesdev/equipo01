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

  // ─── Mapa Explorar State ───
  let garajesCache  = [];
  let explorarMapa  = null;
  let mapaLayers    = [];
  let vistaActual   = 'lista';

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

      garajesCache = garajes;
      document.getElementById('viewToggleBar').style.display = 'block';

      // Show total results count from pagination metadata
      totalResults.textContent = paginacion.totalRegistros;
      resultsCount.style.display = 'flex';

      // Render cards
      garajes.forEach((g, index) => {
        const card = crearTarjeta(g, index);
        catalogGrid.appendChild(card);
      });

      if (vistaActual === 'mapa') actualizarPinsMapaExplorar();

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
      ${imagenHTML}
      <div class="explore-card-overlay"></div>
      <div class="explore-card-content">
        <div class="explore-card-top">
          <span class="explore-card-tag">
            <i class="fa-solid ${tipoIcon}"></i> ${tipoLabel}
          </span>
          <button class="btn-fav-heart ${isFav ? 'is-fav' : ''}" data-garaje-id="${garaje.id}" title="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
            <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
          </button>
        </div>
        <div class="explore-card-bottom">
          <div class="explore-card-price-float">
            <span class="price-amount">Bs. ${precio}</span>
            <span class="price-unit">/ hora</span>
          </div>
          <div class="explore-card-direccion">${garaje.direccion}</div>
          <div class="explore-card-hover-reveal">
            <div class="explore-card-descripcion">${descripcion}</div>
            <div class="explore-card-chips">
              <span class="chip-seg"><i class="fa-solid ${segIcon}"></i> ${garaje.nivel_seguridad || 'Estándar'}</span>
              <span class="chip-access"><i class="fa-solid fa-right-to-bracket"></i> ${garaje.metodo_acceso || 'Manual'}</span>
            </div>
            <span class="explore-card-cta">Ver detalles <i class="fa-solid fa-arrow-right"></i></span>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', (e) => {
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

  // ─── Mapa Explorar ───
  window.toggleVistaExplorar = function(modo) {
    vistaActual = modo;
    const btnLista = document.getElementById('btnVistaLista');
    const btnMapa  = document.getElementById('btnVistaMapa');
    const mapCtn   = document.getElementById('explorarMapCtn');

    const actStyle   = 'background:#006a62;color:#fff;';
    const inactStyle = 'background:transparent;color:#64748b;';

    if (modo === 'mapa') {
      btnLista.style.cssText += inactStyle;
      btnMapa.style.cssText  += actStyle;
      btnLista.style.background = 'transparent'; btnLista.style.color = '#64748b';
      btnMapa.style.background  = '#006a62';     btnMapa.style.color  = '#fff';
      catalogGrid.style.display        = 'none';
      paginationContainer.style.display = 'none';
      mapCtn.style.display              = 'block';
      inicializarMapaExplorar();
      actualizarPinsMapaExplorar();
    } else {
      btnLista.style.background = '#006a62'; btnLista.style.color = '#fff';
      btnMapa.style.background  = 'transparent'; btnMapa.style.color = '#64748b';
      catalogGrid.style.display         = '';
      paginationContainer.style.display = garajesCache.length > 0 ? '' : 'none';
      mapCtn.style.display              = 'none';
    }
  };

  function inicializarMapaExplorar() {
    if (explorarMapa) return;
    explorarMapa = L.map('explorarMap', { zoomControl: true }).setView([-16.5, -68.15], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(explorarMapa);

    // Intentar centrar en la ubicación del usuario
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        if (!explorarMapa) return;
        explorarMapa.setView([pos.coords.latitude, pos.coords.longitude], 14);
        L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
          radius: 8, fillColor: '#3b82f6', color: '#fff', weight: 2, fillOpacity: 0.9
        }).addTo(explorarMapa).bindPopup('<strong>Tu ubicación</strong>');
      }, () => {});
    }
  }

  function actualizarPinsMapaExplorar() {
    if (!explorarMapa) return;
    mapaLayers.forEach(l => explorarMapa.removeLayer(l));
    mapaLayers = [];

    const bounds = [];
    garajesCache.forEach(g => {
      if (!g.latitud || !g.longitud) return;
      const lat = parseFloat(g.latitud);
      const lng = parseFloat(g.longitud);
      const precio = parseFloat(g.precio_hora).toFixed(2);

      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#006a62;color:#fff;border-radius:20px;padding:5px 11px;font-size:0.75rem;font-weight:800;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.28);border:2px solid #fff;cursor:pointer;font-family:Inter,sans-serif;">Bs. ${precio}</div>`,
        iconAnchor: [36, 18]
      });

      const segIcons = { 'Básico': '🔒', 'Estándar': '🛡️', 'Premium': '⭐' };
      const seg = segIcons[g.nivel_seguridad] || '🛡️';

      const marker = L.marker([lat, lng], { icon }).addTo(explorarMapa);
      marker.bindPopup(`
        <div style="min-width:180px;font-family:Inter,sans-serif;">
          <div style="font-weight:800;font-size:0.9rem;color:#0f172a;margin-bottom:4px;">${g.direccion}</div>
          <div style="font-size:0.8rem;color:#475569;margin-bottom:6px;">${seg} ${g.nivel_seguridad || 'Estándar'} · ${g.metodo_acceso || 'Manual'}</div>
          <div style="font-size:1rem;font-weight:900;color:#006a62;margin-bottom:10px;">Bs. ${precio}<span style="font-size:0.72rem;font-weight:500;color:#64748b;">/hora</span></div>
          <a href="/detalle-garaje.html?id=${g.id}" style="display:block;text-align:center;background:#006a62;color:#fff;padding:7px 14px;border-radius:8px;font-size:0.8rem;font-weight:700;text-decoration:none;">Ver detalles →</a>
        </div>
      `);
      mapaLayers.push(marker);
      bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
      explorarMapa.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
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
