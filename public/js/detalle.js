// ============================================================
// EstAirbnb — detalle.js
// Lógica para la Vista de Detalle de un Garaje
// Adaptado a la nueva UI Tailwind + Material Symbols
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
  const detalleContent   = document.getElementById('detalleContent');
  const carouselSection  = document.getElementById('carouselSection');

  const garajeTitulo     = document.getElementById('garajeTitulo');
  const garajeDireccion  = document.getElementById('garajeDireccion');
  const garajePrecio     = document.getElementById('garajePrecio');
  const garajeTipo       = document.getElementById('garajeTipo');
  const garajeDescripcion = document.getElementById('garajeDescripcion');

  // Datos del Anfitrión
  const anfitrionNombre = document.getElementById('anfitrionNombre');
  const anfitrionFoto   = document.getElementById('anfitrionFoto');
  const badgeVerificado = document.getElementById('badgeVerificado');

  // Datos de Confianza
  const garajeDimensiones = document.getElementById('garajeDimensiones');
  const garajeReglas      = document.getElementById('garajeReglas');
  const garajePolitica    = document.getElementById('garajePolitica');

  // Reseñas
  const contenedorResenas = document.getElementById('contenedor-resenas');
  const promedioResenas   = document.getElementById('promedioResenas');
  
  // Reserva elements
  const fechaEntrada     = document.getElementById('fechaEntrada');
  const fechaSalida      = document.getElementById('fechaSalida');
  const resumenPrecio    = document.getElementById('resumenPrecio');
  const textoHoras       = document.getElementById('textoHoras');
  const textoTotal       = document.getElementById('textoTotal');
  const btnReserva       = document.getElementById('btnReserva');
  const reservaAlert     = document.getElementById('reservaAlert');

  // Modal elements
  const modalCheckout       = document.getElementById('modalCheckout');
  const modalEntrada        = document.getElementById('modalEntrada');
  const modalSalida         = document.getElementById('modalSalida');
  const modalHoras          = document.getElementById('modalHoras');
  const modalSubtotal       = document.getElementById('modalSubtotal');
  const modalTarifa         = document.getElementById('modalTarifa');
  const modalTotal          = document.getElementById('modalTotal');
  const checkAcepto         = document.getElementById('checkAcepto');
  const btnConfirmarReserva = document.getElementById('btnConfirmarReserva');

  // Mapa 2D elements
  const mapaParqueo              = document.getElementById('mapa-parqueo');
  const espacioSeleccionadoInfo  = document.getElementById('espacioSeleccionadoInfo');
  const espacioSeleccionadoLabel = document.getElementById('espacioSeleccionadoLabel');

  let garajeCargado = null;
  let espacioSeleccionadoId = null; // ← Variable global del espacio elegido

  const btnThemeToggle   = document.getElementById('btnThemeToggle');
  const themeIcon        = document.getElementById('themeIcon');

  // ─── Vehicle type config ───
  const TIPO_CONFIG = {
    auto:      { label: '🚗 Auto',          icon: 'fa-car' },
    moto:      { label: '🏍️ Moto',          icon: 'fa-motorcycle' },
    camioneta: { label: '🚙 Camioneta / SUV', icon: 'fa-truck-pickup' },
    techado:   { label: '🛖 Techado',       icon: 'fa-warehouse' }
  };

  // ─── Theme Toggle (Material Symbols + Tailwind dark class) ───
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

  // ─── Get ID from URL ───
  function getGarajeId() {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get('id'), 10);
  }

  // ─── Build Image Gallery (Bento Grid) ───
  function renderCarousel(fotos) {
    if (!carouselSection) return;

    if (!fotos || fotos.length === 0) {
      carouselSection.innerHTML = `
        <div class="col-span-full flex items-center justify-center bg-surface-container-low rounded-xl text-on-surface-variant">
          <div class="text-center py-16">
            <span class="material-symbols-outlined text-5xl mb-2 block opacity-30">image</span>
            <span class="text-sm font-medium">Este espacio no tiene fotos</span>
          </div>
        </div>`;
      return;
    }

    // Bento grid: first image large, rest fill
    const items = fotos.map((foto, i) => {
      const gridClass = i === 0 ? 'md:col-span-2 md:row-span-2' : '';
      return `
        <div class="${gridClass} rounded-xl overflow-hidden bg-surface-container-low">
          <img src="${foto.foto_url}" alt="Foto ${i + 1} del parqueo" 
               class="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy">
        </div>
      `;
    }).join('');

    carouselSection.innerHTML = items;
  }

  // ─── Render Garaje Info ───
  function renderInfo(garaje) {
    if (garajeTitulo) garajeTitulo.textContent = garaje.direccion;
    if (garajeDireccion) garajeDireccion.textContent = garaje.direccion;

    // Datos del Anfitrión
    if (anfitrionNombre) anfitrionNombre.textContent = `${garaje.anfitrion_nombre} ${garaje.anfitrion_apellidos || ''}`;
    if (anfitrionFoto && garaje.anfitrion_foto) {
      anfitrionFoto.innerHTML = `<img src="${garaje.anfitrion_foto}" class="w-full h-full object-cover">`;
    }
    if (badgeVerificado) {
      if (garaje.anfitrion_es_verificado) badgeVerificado.classList.remove('hidden');
      else badgeVerificado.classList.add('hidden');
    }

    // Datos de Confianza
    if (garajeDimensiones) garajeDimensiones.textContent = garaje.dimensiones || 'No especificadas';
    if (garajeReglas) garajeReglas.textContent = garaje.reglas_casa || 'Sin reglas especiales.';
    if (garajePolitica) garajePolitica.textContent = garaje.politica_cancelacion || 'Sujeto a las políticas estándar de la plataforma.';

    // Update page title
    document.title = `${garaje.direccion} · EstAirbnb`;

    // Price
    if (garajePrecio) {
      const precio = parseFloat(garaje.precio_hora).toFixed(2);
      garajePrecio.textContent = `Bs. ${precio}`;
    }

    // Vehicle type
    if (garajeTipo) {
      const config = TIPO_CONFIG[garaje.tipo_vehiculo] || { label: garaje.tipo_vehiculo };
      garajeTipo.textContent = config.label;
    }

    // Description
    if (garajeDescripcion) {
      if (garaje.descripcion && garaje.descripcion.trim()) {
        garajeDescripcion.innerHTML = `<p>${garaje.descripcion}</p>`;
      } else {
        garajeDescripcion.innerHTML = '<p class="opacity-50">Sin descripción disponible.</p>';
      }

      // Horario Operativo / Flexibles
      if (garaje.horarios_flexibles) {
        try {
          const mapDias = {1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 0: 'Dom'};
          const horariosArr = JSON.parse(garaje.horarios_flexibles);
          let horariosHtml = horariosArr.map(h => {
            const diasStr = h.dias.map(d => mapDias[d]).join(', ');
            return `<div style="display:flex;align-items:center;gap:6px;font-size:0.88rem;font-weight:600;color:#006a62;">
                      <i class="fa-solid fa-calendar-days"></i> ${diasStr}: ${h.inicio} — ${h.fin}
                    </div>`;
          }).join('');

          garajeDescripcion.innerHTML += `
            <div style="margin-top:16px;padding:12px 16px;background:rgba(0,106,98,0.06);border-radius:10px;border:1px solid rgba(0,106,98,0.15);display:flex;flex-direction:column;gap:8px;">
              <div style="font-size:0.75rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Horarios Disponibles</div>
              ${horariosHtml}
            </div>
          `;
        } catch(e) {}
      } else if (garaje.hora_apertura && garaje.hora_cierre) {
        const apertura = String(garaje.hora_apertura).substring(0, 5);
        const cierre = String(garaje.hora_cierre).substring(0, 5);
        const diasLabels = { 'L-D': 'Lunes a Domingo', 'L-V': 'Lunes a Viernes', 'L-S': 'Lunes a Sábado', 'S-D': 'Sábado y Domingo' };
        const diasLabel = diasLabels[garaje.dias_operativos] || garaje.dias_operativos || 'Todos los días';
        garajeDescripcion.innerHTML += `
          <div style="margin-top:16px;padding:12px 16px;background:rgba(0,106,98,0.06);border-radius:10px;border:1px solid rgba(0,106,98,0.15);display:flex;flex-wrap:wrap;gap:16px;align-items:center;">
            <div style="display:flex;align-items:center;gap:6px;font-size:0.88rem;font-weight:600;color:#006a62;">
              <i class="fa-solid fa-clock"></i> ${apertura} — ${cierre}
            </div>
            <div style="display:flex;align-items:center;gap:6px;font-size:0.88rem;font-weight:600;color:#006a62;">
              <i class="fa-solid fa-calendar-days"></i> ${diasLabel}
            </div>
          </div>
        `;
      }

      // Comodidades
      if (garaje.comodidades && garaje.comodidades.length > 0) {
        const COMODIDAD_CONFIG = {
          techado: { icon: 'fa-warehouse', label: 'Techado' },
          cctv: { icon: 'fa-video', label: 'CCTV' },
          vigilancia: { icon: 'fa-shield-halved', label: 'Vigilancia 24/7' },
          iluminado: { icon: 'fa-lightbulb', label: 'Iluminado' },
          acceso_24h: { icon: 'fa-clock', label: 'Acceso 24h' },
          cargador_ev: { icon: 'fa-charging-station', label: 'Cargador EV' },
          lavado: { icon: 'fa-droplet', label: 'Lavado' },
          acceso_discapacidad: { icon: 'fa-wheelchair', label: 'Accesible' }
        };
        const chips = garaje.comodidades.map(c => {
          const cfg = COMODIDAD_CONFIG[c] || { icon: 'fa-tag', label: c };
          return `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:rgba(0,37,66,0.05);font-size:0.8rem;font-weight:600;color:#002542;border:1px solid rgba(0,37,66,0.1);"><i class="fa-solid ${cfg.icon}" style="color:#006a62;"></i> ${cfg.label}</span>`;
        }).join('');
        garajeDescripcion.innerHTML += `
          <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:8px;">
            ${chips}
          </div>
        `;
      }

      // Mejora Real-Life: Nivel de Seguridad y Acceso
      const securityIcons = { 'Básico': 'fa-lock', 'Estándar': 'fa-shield-halved', 'Premium': 'fa-shield-heart' };
      const accessIcons = { 'Manual': 'fa-hand', 'Código': 'fa-hashtag', 'QR': 'fa-qrcode' };
      
      garajeDescripcion.innerHTML += `
        <div style="margin-top:24px; padding:20px; background: #f8fafc; border-radius:12px; border: 1px solid #e2e8f0;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: #1e293b; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Seguridad y Acceso</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: #e0f2fe; color: #0369a1; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid ${securityIcons[garaje.nivel_seguridad] || 'fa-shield'}"></i>
              </div>
              <div>
                <div style="font-size: 0.7rem; color: #64748b; font-weight: 600;">Seguridad</div>
                <div style="font-size: 0.85rem; color: #0f172a; font-weight: 700;">${garaje.nivel_seguridad || 'Estándar'}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: #f0fdf4; color: #15803d; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid ${accessIcons[garaje.metodo_acceso] || 'fa-key'}"></i>
              </div>
              <div>
                <div style="font-size: 0.7rem; color: #64748b; font-weight: 600;">Entrada</div>
                <div style="font-size: 0.85rem; color: #0f172a; font-weight: 700;">${garaje.metodo_acceso || 'Manual'}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  }

  // ─── Render Mapa 2D de Espacios ───
  async function cargarEspacios(garajeId, layoutMapa) {
    if (!mapaParqueo) return;
    try {
      const res = await fetch(`/api/garajes/${garajeId}/espacios`);
      const json = await res.json();

      if (json.status !== 'ok' || !json.data) {
        mapaParqueo.innerHTML = '<p class="text-on-surface-variant text-sm">No se pudieron cargar los espacios.</p>';
        return;
      }

      renderMapa(json.data, layoutMapa || null);
    } catch (err) {
      console.error('Error al cargar espacios:', err);
      mapaParqueo.innerHTML = '<p class="text-error text-sm">Error de conexión al cargar espacios.</p>';
    }
  }

  function renderMapa(espacios, layoutMapa) {
    if (!mapaParqueo) return;
    mapaParqueo.innerHTML = '';

    // Try to render rich tilemap layout if available
    if (layoutMapa) {
      try {
        const matriz = JSON.parse(layoutMapa);
        if (!Array.isArray(matriz) || matriz.length === 0) throw new Error('invalid');
        renderTilemap(matriz, espacios);
        return;
      } catch(e) {
        // Fall through to legacy render
      }
    }

    // Legacy: simple grid render
    const maxCol = Math.max(...espacios.map(e => e.columna || 1), 1);
    const cols = Math.min(maxCol, 5);
    mapaParqueo.className = 'mapa-grid';
    mapaParqueo.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    espacios.forEach(esp => {
      const slot = document.createElement('div');
      let stateClass = 'espacio-btn';
      if (esp.estado === 'ocupado') stateClass += ' ocupado';
      slot.className = stateClass;
      slot.dataset.id = esp.id;
      slot.dataset.numero = esp.numero_espacio;
      slot.dataset.estado = esp.estado;

      const iconMap = { auto: 'fa-car', moto: 'fa-motorcycle', camioneta: 'fa-truck-pickup', techado: 'fa-warehouse' };
      slot.innerHTML = `
        <i class="fa-solid ${iconMap[esp.tipo_vehiculo] || 'fa-car'}" style="font-size:1.1rem;margin-bottom:2px;"></i>
        <div>${esp.numero_espacio}</div>
      `;
      if (esp.estado === 'libre') slot.addEventListener('click', () => seleccionarEspacio(slot, esp));
      mapaParqueo.appendChild(slot);
    });
  }

  function renderTilemap(matriz, espacios) {
    if (!mapaParqueo) return;

    // Build a lookup from (fila,col) → espacio data
    const espacioMap = {};
    espacios.forEach(e => {
      espacioMap[`${e.fila}-${e.columna}`] = e;
    });

    const filas = matriz.length;
    const cols  = filas > 0 ? matriz[0].length : 0;

    // Container styles — Blueprint dark theme
    mapaParqueo.style.cssText = `
      display: inline-grid;
      grid-template-columns: repeat(${cols}, 1fr);
      gap: 2px;
      background: #0f172a;
      padding: 14px;
      border-radius: 12px;
      width: 100%;
      border: 1px solid #1e293b;
    `;

    const TILE_STYLES = {
      empty:    { bg: '#111827', border: '#1f2937', html: '' },
      wall:     { bg: '#334155', border: '#475569', html: '<span style="font-size:1rem">🧱</span>' },
      entrance: { bg: '#78350f', border: '#92400e', html: '<span style="font-size:0.9rem">🚪</span><span style="font-size:0.5rem;color:#fde68a;font-weight:700;">ENT</span>' },
      aisle:    { bg: '#0c4a6e', border: '#075985', html: '<span style="font-size:0.7rem;color:#7dd3fc;">↔</span>' },
    };

    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        const cellData = matriz[f][c] || { tile: 'empty', tipo_vehiculo: 'auto' };
        const tile = cellData.tile || 'empty';
        const key = `${f+1}-${c+1}`;
        const espacio = espacioMap[key];

        const cell = document.createElement('div');
        cell.style.cssText = `
          aspect-ratio: 1;
          min-width: 32px; min-height: 32px;
          border-radius: 4px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          font-size: 0.55rem; font-weight: 700;
          transition: transform 0.1s, box-shadow 0.1s;
          position: relative;
        `;

        if (tile === 'parking' && espacio) {
          const isLibre = espacio.estado === 'libre';
          const vehicleIcons = { auto: '🚗', moto: '🏍️', camioneta: '🚙', techado: '🛖' };
          const icon = vehicleIcons[espacio.tipo_vehiculo] || '🚗';
          cell.style.background = isLibre ? '#14532d' : '#7f1d1d';
          cell.style.border = `1px solid ${isLibre ? '#166534' : '#991b1b'}`;
          cell.style.cursor = isLibre ? 'pointer' : 'not-allowed';
          cell.innerHTML = `
            <span style="font-size:1rem;line-height:1;">${icon}</span>
            <span style="font-size:0.6rem;font-weight:800;color:${isLibre ? '#86efac' : '#fca5a5'};">${espacio.numero_espacio}</span>
          `;
          cell.title = isLibre ? `Espacio ${espacio.numero_espacio} — Libre` : `Espacio ${espacio.numero_espacio} — Ocupado`;

          if (isLibre) {
            cell.addEventListener('mouseenter', () => { cell.style.transform = 'scale(1.1)'; cell.style.boxShadow = '0 0 0 2px #22c55e'; });
            cell.addEventListener('mouseleave', () => { cell.style.transform = 'scale(1)'; cell.style.boxShadow = 'none'; });
            cell.addEventListener('click', () => {
              // Deselect all
              mapaParqueo.querySelectorAll('[data-selected="true"]').forEach(el => {
                el.dataset.selected = 'false';
                el.style.boxShadow = 'none';
                el.style.transform = 'scale(1)';
              });
              cell.dataset.selected = 'true';
              cell.style.boxShadow = '0 0 0 3px #22c55e, 0 0 12px rgba(34,197,94,0.4)';
              seleccionarEspacio(cell, espacio);
            });
          }
        } else if (tile === 'parking' && !espacio) {
          // Parking tile but no DB espacio (shouldn't happen often)
          cell.style.background = '#1c1c2e';
          cell.style.border = '1px dashed #334155';
          cell.innerHTML = `<span style="font-size:0.7rem;color:#4b5563;">?</span>`;
        } else {
          const tileStyle = TILE_STYLES[tile] || TILE_STYLES.empty;
          cell.style.background = tileStyle.bg;
          cell.style.border = `1px solid ${tileStyle.border}`;
          cell.innerHTML = tileStyle.html;
        }

        mapaParqueo.appendChild(cell);
      }
    }

    // Legend for the conductor
    const legend = document.createElement('div');
    legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;';
    legend.innerHTML = `
      <span style="display:flex;align-items:center;gap:5px;font-size:0.72rem;color:#64748b;font-weight:600;">
        <span style="width:10px;height:10px;border-radius:2px;background:#14532d;display:inline-block;"></span>Libre
      </span>
      <span style="display:flex;align-items:center;gap:5px;font-size:0.72rem;color:#64748b;font-weight:600;">
        <span style="width:10px;height:10px;border-radius:2px;background:#7f1d1d;display:inline-block;"></span>Ocupado
      </span>
      <span style="display:flex;align-items:center;gap:5px;font-size:0.72rem;color:#64748b;font-weight:600;">
        <span style="width:10px;height:10px;border-radius:2px;background:#334155;display:inline-block;"></span>Pared
      </span>
      <span style="display:flex;align-items:center;gap:5px;font-size:0.72rem;color:#64748b;font-weight:600;">
        <span style="width:10px;height:10px;border-radius:2px;background:#0c4a6e;display:inline-block;"></span>Pasillo
      </span>
      <span style="display:flex;align-items:center;gap:5px;font-size:0.72rem;color:#64748b;font-weight:600;">
        <span style="width:10px;height:10px;border-radius:2px;background:#78350f;display:inline-block;"></span>Entrada
      </span>
    `;
    mapaParqueo.insertAdjacentElement('afterend', legend);
  }


  function seleccionarEspacio(slotEl, espacio) {
    // Deseleccionar anterior
    const prev = mapaParqueo.querySelector('.espacio-btn.seleccionado');
    if (prev) {
      prev.classList.remove('seleccionado');
    }

    // Marcar nuevo
    slotEl.classList.add('seleccionado');

    // Guardar selección
    espacioSeleccionadoId = espacio.id;

    // Actualizar UI info
    if (espacioSeleccionadoLabel) {
      espacioSeleccionadoLabel.textContent = espacio.numero_espacio;
    }
    if (espacioSeleccionadoInfo) {
      // Use Tailwind hidden class
      espacioSeleccionadoInfo.classList.remove('hidden');
    }

    // Re-evaluar si el botón de reserva puede habilitarse
    evaluarBotonReserva();
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

      if (loadingDetalle) loadingDetalle.style.display = 'none';

      if (json.status !== 'ok' || !json.data) {
        showError();
        return;
      }

      const garaje = json.data;
      garajeCargado = garaje;

      // Render sections
      renderCarousel(garaje.fotos);
      renderInfo(garaje);

      // Show content
      if (detalleContent) detalleContent.style.display = '';

      // Cargar Mapa 2D de Espacios
      await cargarEspacios(garaje.id, garaje.layout_mapa || null);

      // Cargar Reseñas
      await cargarResenas(garaje.id);

      // Verificar si ya tiene una reserva aquí
      await verificarReservaExistente();

    } catch (err) {
      console.error('Error al cargar detalle:', err);
      showError();
    }
  }

  function showError() {
    if (loadingDetalle) loadingDetalle.style.display = 'none';
    if (detalleContent) {
      detalleContent.style.display = '';
      detalleContent.innerHTML = `
        <div class="text-center py-20">
          <span class="material-symbols-outlined text-5xl text-error mb-4 block">error</span>
          <h2 class="text-2xl font-bold text-primary mb-2">Garaje no encontrado</h2>
          <p class="text-on-surface-variant mb-6">El espacio que buscas no existe o no está disponible.</p>
          <a href="/explorar.html" class="bg-secondary text-white px-6 py-3 rounded-md font-medium hover:bg-[#005049] transition-colors">Volver a explorar</a>
        </div>
      `;
    }
  }

  // ─── Lógica de Precios en Vivo ───
  function calcularPrecio() {
    if (reservaAlert) reservaAlert.classList.add('hidden');
    
    if (!fechaEntrada || !fechaSalida || !fechaEntrada.value || !fechaSalida.value || !garajeCargado) {
      if (resumenPrecio) resumenPrecio.classList.add('hidden');
      evaluarBotonReserva();
      return;
    }

    const start = new Date(fechaEntrada.value).getTime();
    const end = new Date(fechaSalida.value).getTime();

    if (end <= start) {
      if (resumenPrecio) resumenPrecio.classList.add('hidden');
      evaluarBotonReserva();
      return;
    }

    const difMs = end - start;
    const difHoras = Math.ceil(difMs / (1000 * 60 * 60));
    const total = difHoras * parseFloat(garajeCargado.precio_hora);

    if (textoHoras) textoHoras.textContent = `${difHoras} hora${difHoras > 1 ? 's' : ''} x Bs. ${parseFloat(garajeCargado.precio_hora).toFixed(2)}`;
    if (textoTotal) textoTotal.textContent = `Bs. ${total.toFixed(2)}`;
    
    if (resumenPrecio) resumenPrecio.classList.remove('hidden');
    evaluarBotonReserva();
  }

  // ─── Evaluar condiciones del botón de reserva ───
  function evaluarBotonReserva() {
    if (!btnReserva) return;
    const tieneFechas = fechaEntrada && fechaSalida && fechaEntrada.value && fechaSalida.value;
    const fechasValidas = tieneFechas && new Date(fechaSalida.value) > new Date(fechaEntrada.value);
    const tieneEspacio = espacioSeleccionadoId !== null;
    btnReserva.disabled = !(fechasValidas && tieneEspacio);
  }

  if (fechaEntrada) fechaEntrada.addEventListener('change', calcularPrecio);
  if (fechaSalida) fechaSalida.addEventListener('change', calcularPrecio);

  // ─── Verificar si ya tiene reserva ───
  async function verificarReservaExistente() {
    if (!garajeCargado) return;
    try {
      const res = await fetch(`/api/reservas/verificar-existente?usuario_id=${currentUser.id}&garaje_id=${garajeCargado.id}`);
      const json = await res.json();
      if (res.ok && json.status === 'ok' && json.existe) {
        mostrarUIReservaExistente();
      }
    } catch (err) {
      console.error('Error al verificar reservas previas', err);
    }
  }

  function mostrarUIReservaExistente() {
    // Find the booking card (right column)
    const bookingCard = btnReserva ? btnReserva.closest('.sticky') : null;
    if (bookingCard) {
      bookingCard.innerHTML = `
        <div class="text-center p-6">
          <span class="material-symbols-outlined text-4xl text-secondary mb-3 block">check_circle</span>
          <h5 class="text-lg font-bold text-primary mb-2">¡Ya tienes una reserva aquí!</h5>
          <p class="text-sm text-on-surface-variant mb-4">Revisa tu panel de reservas para más detalles.</p>
          <a href="/mis-reservas.html" class="block bg-secondary text-white py-3 rounded-md font-medium hover:bg-[#005049] transition-colors text-center">
            <i class="fa-solid fa-calendar-days"></i> Ir a mis reservas
          </a>
        </div>
      `;
    }
  }

  // ─── Interceptar Botón para abrir el Checkout ───
  if (btnReserva) {
    btnReserva.addEventListener('click', () => {
      if (!garajeCargado || !fechaEntrada.value || !fechaSalida.value || !espacioSeleccionadoId) return;

      const start = new Date(fechaEntrada.value);
      const end = new Date(fechaSalida.value);

      if (end <= start) {
        alert('Las fechas seleccionadas son inválidas.');
        return;
      }

      const difMs = end.getTime() - start.getTime();
      const difHoras = Math.ceil(difMs / (1000 * 60 * 60));
      
      // Cálculo de Costos Oficiales
      const subtotal = difHoras * parseFloat(garajeCargado.precio_hora);
      const tarifa_servicio = subtotal * 0.10; // 10%
      const total = subtotal + tarifa_servicio;

      // Pintar Modal
      if (modalEntrada) modalEntrada.textContent = start.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
      if (modalSalida) modalSalida.textContent = end.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
      
      if (modalHoras) modalHoras.textContent = difHoras;
      if (modalSubtotal) modalSubtotal.textContent = `Bs. ${subtotal.toFixed(2)}`;
      if (modalTarifa) modalTarifa.textContent = `Bs. ${tarifa_servicio.toFixed(2)}`;
      if (modalTotal) modalTotal.textContent = `Bs. ${total.toFixed(2)}`;

      // Resetear Controles del Modal
      if (checkAcepto) checkAcepto.checked = false;
      if (btnConfirmarReserva) btnConfirmarReserva.disabled = true;

      // Abrir Modal
      if (modalCheckout) {
        const modalIns = new bootstrap.Modal(modalCheckout);
        modalIns.show();
      }
    });
  }

  // ─── Checkbox Aceptación ───
  if (checkAcepto) {
    checkAcepto.addEventListener('change', (e) => {
      if (btnConfirmarReserva) btnConfirmarReserva.disabled = !e.target.checked;
    });
  }

  // ─── Confirmar y Llamar a la API ───
  if (btnConfirmarReserva) {
    btnConfirmarReserva.addEventListener('click', async () => {
      if (!garajeCargado || !fechaEntrada.value || !fechaSalida.value || !espacioSeleccionadoId) return;

      const originalText = btnConfirmarReserva.innerHTML;
      btnConfirmarReserva.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Confirmando...';
      btnConfirmarReserva.disabled = true;

      try {
        const response = await fetch('/api/reservas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            espacio_id: espacioSeleccionadoId,
            conductor_id: currentUser.id,
            fecha_inicio: fechaEntrada.value,
            fecha_fin: fechaSalida.value
          })
        });

        const json = await response.json();

        if (response.ok && json.status === 'ok') {
          const modalIns = bootstrap.Modal.getInstance(modalCheckout);
          if (modalIns) modalIns.hide();
          
          mostrarUIReservaExistente();
          alert('Reserva solicitada exitosamente. El anfitrión será notificado.');
        } else {
          alert(json.message || 'Error al procesar la reserva.');
          btnConfirmarReserva.innerHTML = originalText;
          btnConfirmarReserva.disabled = false;
        }

      } catch (err) {
        console.error(err);
        alert('Error de red al procesar tu solicitud.');
        btnConfirmarReserva.innerHTML = originalText;
        btnConfirmarReserva.disabled = false;
      }
    });
  }

  // ─── Lógica de Reseñas ───
  async function cargarResenas(garajeId) {
    if (!contenedorResenas) return;
    try {
      const res = await fetch(`/api/garajes/${garajeId}/resenas`);
      const json = await res.json();
      if (json.status === 'ok') {
        renderResenas(json.data);
      }
    } catch (err) {
      console.error('Error al cargar reseñas:', err);
    }
  }

  function renderResenas(resenas) {
    if (!contenedorResenas) return;
    if (!resenas || resenas.length === 0) {
      contenedorResenas.innerHTML = '<p class="text-on-surface-variant italic">Aún no hay reseñas para este espacio.</p>';
      return;
    }

    let suma = 0;
    const items = resenas.map(r => {
      suma += r.calificacion;
      const estrellas = Array(5).fill('').map((_, i) => 
        `<span class="material-symbols-outlined text-sm ${i < r.calificacion ? 'text-amber-400' : 'text-outline-variant/30'}" style="font-variation-settings: 'FILL' 1;">star</span>`
      ).join('');

      const fecha = new Date(r.fecha_creacion).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      const foto = r.conductor_foto ? `<img src="${r.conductor_foto}" class="w-full h-full object-cover">` : `<span class="material-symbols-outlined text-sm">person</span>`;

      return `
        <div class="bg-surface-container-low p-6 rounded-xl space-y-4 border border-outline-variant/5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container overflow-hidden">
                ${foto}
              </div>
              <div>
                <div class="font-headline font-bold text-primary text-sm">${r.conductor_nombre}</div>
                <div class="text-[10px] text-on-surface-variant uppercase tracking-widest">${fecha}</div>
              </div>
            </div>
            <div class="flex">${estrellas}</div>
          </div>
          <p class="text-on-surface-variant text-sm font-body leading-relaxed">${r.comentario || 'Sin comentario.'}</p>
        </div>
      `;
    }).join('');

    contenedorResenas.innerHTML = items;
    if (promedioResenas) promedioResenas.textContent = (suma / resenas.length).toFixed(1);
  }

  // ─── Init ───
  initTheme();
  cargarDetalle();

})();
