// ============================================================
// EstAirbnb — mis-reservas.js
// Panel de Reservas para Anfitrión y Conductor
// ============================================================

(function () {
  'use strict';

  // ─── Verificación de Sesión ───
  const currentUser = JSON.parse(localStorage.getItem('estairbnb_user') || 'null');
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  // ─── Referencias DOM ───
  const loadingReservas    = document.getElementById('loadingReservas');
  const emptyReservas      = document.getElementById('emptyReservas');
  const reservasGrid       = document.getElementById('reservasGrid');
  const gridPendientes     = document.getElementById('gridPendientes');
  const seccionPendientes  = document.getElementById('seccionPendientes');
  const seccionHistorial   = document.getElementById('seccionHistorial');
  const tituloHistorial    = document.getElementById('tituloHistorial');
  const tituloReservas     = document.getElementById('tituloReservas');
  const btnNuevaReserva    = document.getElementById('btnNuevaReserva');
  const linkMisGarajes     = document.getElementById('linkMisGarajes');
  const linkExplorar       = document.getElementById('linkExplorar');
  const btnThemeToggle     = document.getElementById('btnThemeToggle');
  const themeIcon          = document.getElementById('themeIcon');

  // Configuración de Rol
  const esAnfitrion = (currentUser.rol_id === 1);
  const esConductor = (currentUser.rol_id === 2);

  if (esAnfitrion) {
    linkMisGarajes.style.display = 'inline-block';
    linkExplorar.style.display = 'none';
    btnNuevaReserva.style.display = 'none'; // El anfitrión no busca garajes aquí
  }

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

  // Configurar idioma de moment
  moment.locale('es');

  // ─── Diccionarios de UI ───
  const estadoClase = {
    'pendiente': 'badge-pendiente',
    'confirmada': 'badge-confirmada',
    'rechazada': 'badge-rechazada',
    'finalizada': 'badge-finalizada'
  };

  const estadoLabel = {
    'pendiente': 'Pendiente',
    'confirmada': 'Confirmada',
    'rechazada': 'Rechazada',
    'finalizada': 'Finalizada'
  };

  // ─── Cargar Datos ───
  async function cargarReservas() {
    try {
      loadingReservas.style.display = 'block';
      emptyReservas.style.display = 'none';
      seccionPendientes.style.display = 'none';
      seccionHistorial.style.display = 'none';

      const res = await fetch(`/api/reservas/mis-reservas?usuario_id=${currentUser.id}&rol_id=${currentUser.rol_id}`);
      const json = await res.json();

      loadingReservas.style.display = 'none';

      if (!res.ok || json.status !== 'ok') {
        alert('Error al cargar las reservas');
        return;
      }

      if (json.data.length === 0) {
        emptyReservas.style.display = 'block';
        return;
      }

      const pendientes = json.data.filter(r => r.estado === 'pendiente');
      const historial = json.data.filter(r => r.estado !== 'pendiente');

      if (esAnfitrion) {
        tituloReservas.innerHTML = '<i class="fa-solid fa-list-check"></i> Panel de Alquileres';
        
        if (pendientes.length > 0) {
          seccionPendientes.style.display = 'block';
          gridPendientes.innerHTML = generarTarjetas(pendientes);
        }
        if (historial.length > 0) {
          seccionHistorial.style.display = 'block';
          tituloHistorial.style.display = 'block';
          reservasGrid.innerHTML = generarTarjetas(historial);
        }
      } else {
        // Conductor no se separa, o todo va a historial
        seccionHistorial.style.display = 'block';
        reservasGrid.innerHTML = generarTarjetas(json.data);
      }

    } catch (err) {
      console.error(err);
      loadingReservas.style.display = 'none';
      alert('Error de red al cargar las reservas');
    }
  }

  // ─── Renderizado ───
  function generarTarjetas(reservas) {
    return reservas.map(res => {
      
      const badgeClass = estadoClase[res.estado] || 'badge-finalizada';
      const estadoStr  = estadoLabel[res.estado] || res.estado;

      // Status icons
      const estadoIcono = { pendiente: 'fa-clock', confirmada: 'fa-circle-check', rechazada: 'fa-circle-xmark', finalizada: 'fa-flag-checkered' };
      const icono = estadoIcono[res.estado] || 'fa-circle';

      // Dates
      const fInicioDate = moment(res.fecha_inicio);
      const fFinDate    = moment(res.fecha_fin);

      let bloqueOpcional = '';
      let espacioBadge   = '';
      let cardFooterHtml = '';

      // ── Space badge ──
      if (res.numero_espacio) {
        espacioBadge = `<div class="espacio-badge"><i class="fa-solid fa-square-parking"></i> Espacio ${res.numero_espacio}</div>`;
      }

      if (esAnfitrion) {
        // Conductor info block
        const initial = (res.conductor_nombre || 'C')[0].toUpperCase();
        bloqueOpcional = `
          <div class="conductor-card">
            <div class="conductor-avatar">${initial}</div>
            <div class="conductor-info">
              <div class="c-name"><i class="fa-solid fa-user" style="color:#006a62;margin-right:5px;font-size:0.75rem;"></i>${res.conductor_nombre || 'N/A'}</div>
              <div class="c-phone"><i class="fa-solid fa-phone" style="margin-right:5px;font-size:0.7rem;"></i>${res.conductor_telefono || 'Sin teléfono'}</div>
            </div>
          </div>
        `;

        if (res.estado === 'pendiente') {
          cardFooterHtml = `
            <div class="card-footer-inner">
              <button class="btn-action-card btn-rechazar" onclick="cambiarEstado(${res.id}, 'rechazada')">
                <i class="fa-solid fa-xmark"></i> Rechazar
              </button>
              <button class="btn-action-card btn-confirmar" onclick="cambiarEstado(${res.id}, 'confirmada')">
                <i class="fa-solid fa-check"></i> Confirmar
              </button>
            </div>
          `;
        }

      } else if (esConductor) {
        // Access instructions
        if (res.instrucciones_acceso) {
          bloqueOpcional = `
            <div class="access-card">
              <div class="access-header">
                <i class="fa-solid fa-key"></i> Instrucciones de Acceso
              </div>
              <div class="access-text">${res.instrucciones_acceso}</div>
            </div>
          `;
        }

        // Action buttons for confirmed reservations
        if (res.estado === 'confirmada') {
          const addressEnc = encodeURIComponent(res.garaje_direccion);
          cardFooterHtml = `
            <div class="card-footer-inner">
              <a href="https://www.google.com/maps/search/?api=1&query=${addressEnc}" target="_blank" class="btn-action-card btn-navigate">
                <i class="fa-solid fa-location-arrow"></i> Llegar
              </a>
              <button class="btn-action-card btn-checkin" onclick="mostrarCheckIn(${res.id})">
                <i class="fa-solid fa-qrcode"></i> Check-in
              </button>
            </div>
          `;
        }
      }

      return `
        <div class="reserva-card" id="reserva-${res.id}">
          <!-- Status color strip -->
          <div class="card-status-strip strip-${res.estado}"></div>

          <!-- Card Header -->
          <div class="card-head">
            <div class="card-head-location">
              <div class="location-icon"><i class="fa-solid fa-warehouse"></i></div>
              <div style="min-width:0;">
                <div class="location-name" title="${res.garaje_direccion}">${res.garaje_direccion}</div>
                <div class="reserva-num">Reserva #${res.id}</div>
              </div>
            </div>
            <span class="badge-estado ${badgeClass}">
              <i class="fa-solid ${icono}" style="font-size:0.65rem;"></i>
              ${estadoStr}
            </span>
          </div>

          <!-- Card Body -->
          <div class="card-body-inner">

            ${espacioBadge}

            <!-- Date Timeline -->
            <div class="date-timeline">
              <div class="date-block">
                <div class="date-label">Check-in</div>
                <div class="date-value">${fInicioDate.format('DD MMM YYYY')}</div>
                <div class="date-time">${fInicioDate.format('HH:mm')}</div>
              </div>
              <div class="date-divider"></div>
              <div class="date-arrow"><i class="fa-solid fa-arrow-right"></i></div>
              <div class="date-divider"></div>
              <div class="date-block">
                <div class="date-label">Check-out</div>
                <div class="date-value">${fFinDate.format('DD MMM YYYY')}</div>
                <div class="date-time">${fFinDate.format('HH:mm')}</div>
              </div>
            </div>

            <!-- Price -->
            <div class="price-row">
              <div class="price-label"><i class="fa-solid fa-coins" style="margin-right:5px;"></i>Total a pagar</div>
              <div class="price-amount">Bs. ${parseFloat(res.precio_total).toFixed(2)}</div>
            </div>

            ${bloqueOpcional}

          </div>

          ${cardFooterHtml}
        </div>
      `;
    }).join('');
  }


  // ─── Actualizar Estado (Anfitrión) ───
  window.cambiarEstado = async function(id, nuevoEstado) {
    if(!confirm(`¿Estás seguro de ${nuevoEstado === 'confirmada' ? 'Confirmar' : 'Rechazar'} la reserva?`)) return;

    try {
      const btnGroup = document.querySelector(`#reserva-${id} .border-top`);
      if(btnGroup) btnGroup.innerHTML = '<span class="text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Actualizando...</span>';

      const res = await fetch(`/api/reservas/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
      });

      const json = await res.json();
      if(res.ok && json.status === 'ok') {
        cargarReservas(); // Recargar todo para refrescar la lista y el UI
      } else {
        alert(json.message || 'Error al actualizar');
        cargarReservas();
      }
    } catch(err) {
      console.error(err);
      alert('Error de red al actualizar estado');
      cargarReservas();
    }
  }

  // ─── Check-in (Simulación QR) ───
  window.mostrarCheckIn = function(id) {
    const modalHTML = `
      <div id="checkInModal" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div class="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <h3 class="text-2xl font-bold text-slate-900 mb-2">Check-in</h3>
          <p class="text-slate-500 mb-6">Muestra este código al llegar al garaje</p>
          <div class="bg-slate-100 p-4 rounded-xl mb-6 flex justify-center">
             <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=EstAirbnb-Reserva-${id}" alt="QR Code" class="w-48 h-48">
          </div>
          <p class="text-xs text-slate-400 mb-6">Reserva #${id} · Valida por 15 minutos</p>
          <button onclick="document.getElementById('checkInModal').remove()" class="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // ─── Iniciar ───
  initTheme();
  cargarReservas();

})();
