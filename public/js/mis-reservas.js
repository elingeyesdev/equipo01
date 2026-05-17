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

  // ─── Toast helper (styled, no browser dialogs) ───
  function showToast(msg, type = 'success') {
    const isErr = type === 'error';
    let el = document.getElementById('_appToast');
    if (!el) {
      el = document.createElement('div');
      el.id = '_appToast';
      el.style.cssText = 'position:fixed;top:24px;right:24px;z-index:99999;display:flex;align-items:center;gap:12px;padding:14px 20px;border-radius:12px;font-family:Inter,sans-serif;font-size:0.875rem;font-weight:600;color:#fff;max-width:380px;line-height:1.4;box-shadow:0 8px 32px rgba(0,0,0,0.18);transform:translateX(calc(100% + 32px));transition:transform 0.4s cubic-bezier(0.16,1,0.3,1);pointer-events:none';
      document.body.appendChild(el);
    }
    const icon = isErr
      ? '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink:0"><circle cx="10" cy="10" r="9" stroke="#fff" stroke-width="1.5"/><path d="M10 6v4M10 14h.01" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink:0"><circle cx="10" cy="10" r="9" stroke="#fff" stroke-width="1.5"/><path d="M7 10l2 2 4-4" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    el.style.background = isErr ? '#dc2626' : '#006a62';
    el.innerHTML = icon + `<span>${msg}</span>`;
    clearTimeout(el._timer);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = 'translateX(0)'; }));
    el._timer = setTimeout(() => { el.style.transform = 'translateX(calc(100% + 32px))'; }, 3500);
  }

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

  // ─── Estado global de reservas (para PDF y filtros) ───
  let todasLasReservas = [];

  // ─── Filtros ───
  const filtroEstado  = document.getElementById('filtroEstado');
  const filtroDesde   = document.getElementById('filtroDesde');
  const filtroHasta   = document.getElementById('filtroHasta');
  const btnAplicar    = document.getElementById('btnAplicarFiltros');
  const btnLimpiarF   = document.getElementById('btnLimpiarFiltros');
  const filtroConteo  = document.getElementById('filtroConteo');
  const filtroConteoN = document.getElementById('filtroConteoNum');

  function aplicarFiltros() {
    const estado  = filtroEstado?.value || '';
    const desde   = filtroDesde?.value  ? new Date(filtroDesde.value)  : null;
    const hasta   = filtroHasta?.value  ? new Date(filtroHasta.value)  : null;
    if (hasta) hasta.setHours(23, 59, 59, 999);

    let filtradas = todasLasReservas;
    if (estado) filtradas = filtradas.filter(r => r.estado === estado);
    if (desde)  filtradas = filtradas.filter(r => new Date(r.fecha_inicio) >= desde);
    if (hasta)  filtradas = filtradas.filter(r => new Date(r.fecha_inicio) <= hasta);

    const hayFiltro = !!(estado || desde || hasta);

    if (filtroConteo) {
      if (hayFiltro) {
        filtroConteo.style.display = 'block';
        if (filtroConteoN) filtroConteoN.textContent = filtradas.length;
      } else {
        filtroConteo.style.display = 'none';
      }
    }

    renderizarReservas(filtradas);
  }

  if (btnAplicar) btnAplicar.addEventListener('click', aplicarFiltros);
  if (btnLimpiarF) {
    btnLimpiarF.addEventListener('click', () => {
      if (filtroEstado) filtroEstado.value = '';
      if (filtroDesde)  filtroDesde.value  = '';
      if (filtroHasta)  filtroHasta.value  = '';
      if (filtroConteo) filtroConteo.style.display = 'none';
      renderizarReservas(todasLasReservas);
    });
  }

  // ─── Renderizar (separado de cargar) ───
  function renderizarReservas(reservas) {
    seccionPendientes.style.display = 'none';
    seccionHistorial.style.display  = 'none';
    gridPendientes.innerHTML = '';
    reservasGrid.innerHTML   = '';

    if (reservas.length === 0) {
      emptyReservas.style.display = 'flex';
      document.getElementById('textoVacio').textContent = 'No hay reservas para los filtros seleccionados';
      return;
    }
    emptyReservas.style.display = 'none';

    const pendientes = reservas.filter(r => r.estado === 'pendiente');
    const historial  = reservas.filter(r => r.estado !== 'pendiente');

    if (esAnfitrion) {
      if (pendientes.length > 0) {
        seccionPendientes.style.display = 'block';
        gridPendientes.innerHTML = generarTarjetas(pendientes);
      }
      if (historial.length > 0) {
        seccionHistorial.style.display = 'block';
        reservasGrid.innerHTML = generarTarjetas(historial);
      }
    } else {
      seccionHistorial.style.display = 'block';
      reservasGrid.innerHTML = generarTarjetas(reservas);
    }
  }

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
        showToast('Error al cargar las reservas', 'error');
        return;
      }

      todasLasReservas = json.data;

      if (esAnfitrion) {
        tituloReservas.innerHTML = '<i class="fa-solid fa-list-check"></i> Panel de Alquileres';
      }

      renderizarReservas(todasLasReservas);

    } catch (err) {
      console.error(err);
      loadingReservas.style.display = 'none';
      showToast('Error de red al cargar las reservas', 'error');
    }
  }

  // ─── Renderizado ───
  function generarTarjetas(reservas) {
    return reservas.map(res => {
      
      const badgeClass  = estadoClase[res.estado] || 'badge-finalizada';
      const estadoStr   = estadoLabel[res.estado] || res.estado;
      const descMonto   = parseFloat(res.descuento_aplicado || 0);
      const cuponRowHtml = (res.cupon_codigo && descMonto > 0)
        ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:0.78rem;font-weight:600;color:#64748b;border-top:1px dashed #e2e8f0;margin-top:4px;">
             <span>🎟️ Cupón: <strong>${res.cupon_codigo}</strong></span>
             <span style="color:#16a34a;">-Bs. ${descMonto.toFixed(2)}</span>
           </div>`
        : '';

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
        } else if (res.estado === 'confirmada') {
          cardFooterHtml = `
            <div class="card-footer-inner">
              <button class="btn-action-card btn-confirmar" style="background: #64748b;" onclick="cambiarEstado(${res.id}, 'finalizada')">
                <i class="fa-solid fa-flag-checkered"></i> Finalizar Estancia
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

        const esFinalizada = res.estado === 'finalizada';
        const pdfBtnHtml = esFinalizada
          ? `<button class="btn-action-card btn-confirmar" style="flex:1 1 100%;background:linear-gradient(135deg,#16a34a,#15803d);box-shadow:0 4px 12px rgba(22,163,74,.25);" onclick="descargarPDF(${res.id})">
               <i class="fa-solid fa-file-pdf"></i> Descargar Comprobante
             </button>`
          : `<button class="btn-action-card" style="flex:1 1 100%;opacity:0.55;cursor:not-allowed;background:#94a3b8;border:none;" disabled>
               <i class="fa-solid fa-file-pdf"></i> Descarga disponible al finalizar
             </button>`;

        if (res.estado === 'confirmada') {
          const addressEnc = encodeURIComponent(res.garaje_direccion);
          cardFooterHtml = `
            <div class="card-footer-inner" style="flex-wrap:wrap;">
              <a href="https://www.google.com/maps/search/?api=1&query=${addressEnc}" target="_blank" class="btn-action-card btn-navigate">
                <i class="fa-solid fa-location-arrow"></i> Llegar
              </a>
              <button class="btn-action-card btn-checkin" onclick="mostrarCheckIn(${res.id})">
                <i class="fa-solid fa-qrcode"></i> Check-in
              </button>
              ${pdfBtnHtml}
            </div>
          `;
        } else if (res.estado === 'finalizada') {
          const reviewSection = res.ha_revisado
            ? `<span style="text-align:center;font-size:0.72rem;font-weight:700;color:#006a62;text-transform:uppercase;padding:8px 0;display:flex;align-items:center;justify-content:center;gap:6px;"><i class="fa-solid fa-check-circle"></i> Reseña Publicada</span>`
            : `<button class="btn-action-card btn-confirmar w-full" onclick="abrirModalResena(${res.id}, ${res.garaje_id})"><i class="fa-solid fa-star"></i> Calificar Espacio</button>`;
          cardFooterHtml = `
            <div class="card-footer-inner flex-col gap-2">
              ${reviewSection}
              ${pdfBtnHtml}
            </div>
          `;
        } else {
          cardFooterHtml = `
            <div class="card-footer-inner">
              ${pdfBtnHtml}
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
            ${cuponRowHtml}

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

  // ─── Lógica de Reseñas (Trust Module) ───
  let ratingSeleccionado = 0;
  const modalResena = document.getElementById('modalResena');
  const starsContainer = document.getElementById('ratingStars');
  const btnEnviarResena = document.getElementById('btnEnviarResena');

  window.abrirModalResena = function(reservaId, garajeId) {
    document.getElementById('hiddenReservaId').value = reservaId;
    document.getElementById('hiddenGarajeId').value = garajeId;
    document.getElementById('txtComentario').value = '';
    ratingSeleccionado = 0;
    actualizarEstrellas(0);
    
    const bootstrapModal = new bootstrap.Modal(modalResena);
    bootstrapModal.show();
  };

  if (starsContainer) {
    starsContainer.querySelectorAll('span').forEach(star => {
      star.addEventListener('click', () => {
        ratingSeleccionado = parseInt(star.dataset.value);
        actualizarEstrellas(ratingSeleccionado);
      });
    });
  }

  function actualizarEstrellas(rating) {
    starsContainer.querySelectorAll('span').forEach((star, i) => {
      if (i < rating) {
        star.classList.add('text-amber-400');
        star.classList.remove('text-outline-variant');
        star.style.fontVariationSettings = "'FILL' 1";
      } else {
        star.classList.remove('text-amber-400');
        star.classList.add('text-outline-variant');
        star.style.fontVariationSettings = "'FILL' 0";
      }
    });
  }

  if (btnEnviarResena) {
    btnEnviarResena.addEventListener('click', async () => {
      if (ratingSeleccionado === 0) {
        showToast('Por favor selecciona una calificación antes de enviar.', 'error');
        return;
      }

      const reserva_id = document.getElementById('hiddenReservaId').value;
      const garaje_id = document.getElementById('hiddenGarajeId').value;
      const comentario = document.getElementById('txtComentario').value;

      try {
        const res = await fetch('/api/resenas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            garaje_id,
            reserva_id,
            conductor_id: currentUser.id,
            calificacion: ratingSeleccionado,
            comentario
          })
        });

        if (res.ok) {
          const bootstrapModal = bootstrap.Modal.getInstance(modalResena);
          bootstrapModal.hide();
          showToast('¡Gracias por tu reseña! Tu opinión ayuda a otros conductores.');
          cargarReservas();
        } else {
          showToast('No se pudo enviar la reseña. Intenta de nuevo.', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Error de red. Verifica tu conexión.', 'error');
      }
    });
  }

  // ─── Descargar Comprobante PDF ───
  window.descargarPDF = async function(reservaId) {
    const id = Number(reservaId);
    const reserva = todasLasReservas.find(r => Number(r.id) === id);
    if (!reserva) { showToast('No se encontraron datos de la reserva.', 'error'); return; }

    if (typeof window.jspdf === 'undefined') {
      showToast('Generando PDF...', 'success');
      await new Promise(resolve => setTimeout(resolve, 500));
      if (typeof window.jspdf === 'undefined') {
        showToast('Error: librería PDF no cargó. Recarga la página.', 'error');
        return;
      }
    }

    showToast('Generando comprobante PDF...', 'success');

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pW = doc.internal.pageSize.getWidth();

      // ── Header ──────────────────────────────────────────────
      doc.setFillColor(0, 37, 66);
      doc.rect(0, 0, pW, 42, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22); doc.setFont('helvetica', 'bold');
      doc.text('EstAirbnb', 15, 17);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text('Plataforma de Estacionamientos', 15, 25);
      doc.setFontSize(11); doc.setFont('helvetica', 'bold');
      doc.text('COMPROBANTE DE RESERVA', pW - 15, 16, { align: 'right' });
      doc.setFontSize(16);
      doc.text(`#${reserva.id}`, pW - 15, 26, { align: 'right' });
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(`Emitido: ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}`, pW - 15, 34, { align: 'right' });

      let y = 52;

      // ── Estado badge ─────────────────────────────────────────
      const sc = { pendiente:[245,158,11], confirmada:[0,106,98], finalizada:[22,163,74], rechazada:[186,26,26], cancelada:[156,163,175] };
      const estadoPdfLabel = { pendiente:'PENDIENTE', confirmada:'CONFIRMADO', finalizada:'PAGADO', rechazada:'RECHAZADO', cancelada:'CANCELADO' };
      const c = sc[reserva.estado] || [100,116,139];
      doc.setFillColor(...c);
      doc.roundedRect(15, y, 58, 9, 2, 2, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text(estadoPdfLabel[reserva.estado] || reserva.estado.toUpperCase(), 44, y + 6, { align: 'center' });

      y += 18;

      // ── Dirección y Anfitrión ────────────────────────────────
      doc.setTextColor(0, 37, 66); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      const addr = doc.splitTextToSize(reserva.garaje_direccion || 'Sin dirección', pW - 30);
      doc.text(addr, 15, y);
      y += addr.length * 7 + 4;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      if (reserva.anfitrion_nombre) {
        doc.text(`Anfitrión: ${reserva.anfitrion_nombre}`, 15, y);
        y += 5;
      }
      doc.text(`Espacio: ${reserva.numero_espacio || '--'}`, 15, y);
      y += 12;

      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4);
      doc.line(15, y, pW - 15, y);
      y += 10;

      // ── Fechas ───────────────────────────────────────────────
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 37, 66);
      doc.text('Período de Reserva', 15, y);
      y += 8;

      const fmt = dt => dt ? new Date(dt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '--';
      const bW = (pW - 40) / 2;

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, y, bW, 22, 3, 3, 'F');
      doc.roundedRect(pW - 15 - bW, y, bW, 22, 3, 3, 'F');

      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
      doc.text('CHECK-IN',  15 + bW / 2, y + 6, { align: 'center' });
      doc.text('CHECK-OUT', pW - 15 - bW / 2, y + 6, { align: 'center' });
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 37, 66);
      doc.text(fmt(reserva.fecha_inicio), 15 + bW / 2, y + 15, { align: 'center' });
      doc.text(fmt(reserva.fecha_fin),    pW - 15 - bW / 2, y + 15, { align: 'center' });
      y += 32;

      // ── Desglose de pago ────────────────────────────────────
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 37, 66);
      doc.text('Desglose de Pago', 15, y);
      y += 8;

      const totalConTarifa = parseFloat(reserva.precio_total);
      const descuento      = parseFloat(reserva.descuento_aplicado || 0);
      const cuponCodigo    = reserva.cupon_codigo || null;
      // precio_total = base + tarifa - descuento  →  base+tarifa = precio_total + descuento
      const bruto      = totalConTarifa + descuento;
      const tarifaBase = bruto / 1.10;
      const tarifaServ = bruto - tarifaBase;

      const filas = [
        ['Monto base', `Bs. ${tarifaBase.toFixed(2)}`],
        ['Tarifa EstAirbnb (10%)', `Bs. ${tarifaServ.toFixed(2)}`],
      ];
      if (descuento > 0) filas.push([`Descuento cupón (${cuponCodigo || ''})`, `-Bs. ${descuento.toFixed(2)}`]);

      filas.forEach(([lbl, val]) => {
        doc.setFillColor(248, 250, 252); doc.rect(15, y - 5, pW - 30, 12, 'F');
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
        doc.text(lbl, 20, y + 2);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 37, 66);
        const isDisc = val.startsWith('-');
        if (isDisc) doc.setTextColor(22, 101, 52);
        doc.text(val, pW - 20, y + 2, { align: 'right' });
        y += 14;
      });

      doc.setFillColor(0, 106, 98);
      doc.roundedRect(15, y - 5, pW - 30, 14, 3, 3, 'F');
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text('TOTAL PAGADO', 20, y + 4);
      doc.text(`Bs. ${totalConTarifa.toFixed(2)}`, pW - 20, y + 4, { align: 'right' });
      y += 24;

      // ── QR ──────────────────────────────────────────────────
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=EstAirbnb-Reserva-${reserva.id}&color=002542`;
        const qrResp = await fetch(qrUrl);
        const qrBlob = await qrResp.blob();
        const qrB64  = await new Promise(res => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.readAsDataURL(qrBlob); });

        const qrSz = 38;
        const qrX  = (pW - qrSz) / 2;
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(qrX - 12, y, qrSz + 24, qrSz + 18, 4, 4, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 106, 98);
        doc.text('CÓDIGO DE VERIFICACIÓN', pW / 2, y + 8, { align: 'center' });
        doc.addImage(qrB64, 'PNG', qrX, y + 12, qrSz, qrSz);
        y += qrSz + 20;
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
        doc.text(`EstAirbnb-Reserva-${reserva.id}`, pW / 2, y + 4, { align: 'center' });
      } catch (_) {
        doc.setFontSize(9); doc.setTextColor(100, 116, 139);
        doc.text(`Código: EstAirbnb-Reserva-${reserva.id}`, pW / 2, y, { align: 'center' });
      }

      // ── Footer ───────────────────────────────────────────────
      const fY = doc.internal.pageSize.getHeight() - 18;
      doc.setDrawColor(226, 232, 240); doc.line(15, fY - 8, pW - 15, fY - 8);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
      doc.text('Este comprobante es generado por EstAirbnb. Preséntalo al anfitrión al llegar.', pW / 2, fY - 2, { align: 'center' });
      doc.text(`EstAirbnb · Plataforma de Estacionamientos · ${new Date().getFullYear()}`, pW / 2, fY + 4, { align: 'center' });

      const hoy = new Date();
      const fechaStr = hoy.toISOString().slice(0, 10).replace(/-/g, '');
      doc.save(`EstAirbnb_Comprobante_Reserva${reserva.id}_${fechaStr}.pdf`);
      showToast('¡Comprobante descargado exitosamente!', 'success');

    } catch (err) {
      console.error('Error generando PDF:', err);
      showToast('Error al generar el PDF. Intenta de nuevo.', 'error');
    }
  };

  // ─── Iniciar ───
  initTheme();
  cargarReservas();

})();
