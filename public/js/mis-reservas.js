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

  // Configuración de Rol
  const esAnfitrion = (currentUser.rol_id === 1);
  const esConductor = (currentUser.rol_id === 2);

  if (esAnfitrion) {
    linkMisGarajes.style.display = 'inline-block';
    linkExplorar.style.display = 'none';
    btnNuevaReserva.style.display = 'none'; // El anfitrión no busca garajes aquí
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
      
      const badgeClass = estadoClase[res.estado] || 'bg-secondary';
      const fInicio = moment(res.fecha_inicio).format('DD MMM YYYY, HH:mm');
      const fFin = moment(res.fecha_fin).format('DD MMM YYYY, HH:mm');
      
      let bloqueOpcional = '';
      let actionButtons = '';

      if (esAnfitrion) {
        // Bloque del anfitrión
        bloqueOpcional = `
          <div class="info-block" style="grid-column: span 2;">
            <span>Conductor</span>
            <div><i class="fa-solid fa-user me-1 text-muted"></i> ${res.conductor_nombre}</div>
            <div><i class="fa-solid fa-phone me-1 text-muted"></i> ${res.conductor_telefono || 'Sin teléfono'}</div>
          </div>
        `;
        
        // Mostrar botones solo si está pendiente
        if (res.estado === 'pendiente') {
          actionButtons = `
            <div class="mt-3 pt-3 border-top d-flex gap-2 justify-content-end">
              <button class="btn btn-outline-danger btn-action" onclick="cambiarEstado(${res.id}, 'rechazada')">
                <i class="fa-solid fa-xmark"></i> Rechazar
              </button>
              <button class="btn btn-success btn-action" onclick="cambiarEstado(${res.id}, 'confirmada')">
                <i class="fa-solid fa-check"></i> Confirmar
              </button>
            </div>
          `;
        }
      }

      return `
        <div class="reserva-card" id="reserva-${res.id}">
          <div class="reserva-header">
            <div>
              <div class="reserva-title"><i class="fa-solid fa-location-dot me-2 text-muted"></i>${res.garaje_direccion}</div>
              <small class="text-muted">Reserva #${res.id}</small>
            </div>
            <span class="badge-estado ${badgeClass}">${estadoLabel[res.estado].toUpperCase()}</span>
          </div>

          <div class="reserva-info">
            <div class="info-block">
              <span>Fechas</span>
              <div><i class="fa-regular fa-clock me-1 text-muted"></i> ${fInicio}</div>
              <div><i class="fa-solid fa-arrow-right me-1 text-muted"></i> ${fFin}</div>
            </div>
            
            <div class="info-block">
              <span>Total a pagar</span>
              <div style="font-weight: 700; color: var(--brand-color, #4f46e5); font-size: 1.1rem;">
                Bs. ${parseFloat(res.precio_total).toFixed(2)}
              </div>
            </div>

            ${bloqueOpcional}
          </div>

          ${actionButtons}
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

  // ─── Iniciar ───
  cargarReservas();

})();
