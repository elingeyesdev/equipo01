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

  // ─── Estado Stepper ───
  function generarStepper(estado) {
    const idx = { pendiente: 0, confirmada: 1, finalizada: 2, rechazada: 1, cancelada: 0 };
    const actual = idx[estado] ?? 0;
    const isFail = estado === 'rechazada' || estado === 'cancelada';
    const labels = [
      estado === 'cancelada' ? 'Cancelada' : 'Pendiente',
      estado === 'rechazada' ? 'Rechazada' : 'Confirmada',
      'Finalizada'
    ];
    let html = '<div class="estado-stepper">';
    [0, 1, 2].forEach(i => {
      let cls = '';
      if (i < actual) cls = 'done';
      else if (i === actual) cls = isFail ? 'fail' : 'active';
      const icon = cls === 'done' ? '✓' : cls === 'fail' ? '✗' : '';
      if (i > 0) {
        const lc = (!isFail && i <= actual) || i < actual ? 'done' : '';
        html += `<div class="step-connector ${lc}"></div>`;
      }
      html += `<div class="step-dot"><div class="step-circle ${cls}">${icon}</div><span class="step-label ${cls}">${labels[i]}</span></div>`;
    });
    return html + '</div>';
  }

  // ─── Pasarela de Pago ───
  let _pasarelaId     = null;
  let _pasarelaTotal  = 0;
  let _pasarelaMetodo = 'qr';

  window.seleccionarMetodo = function(metodo) {
    _pasarelaMetodo = metodo;
    document.getElementById('btnMetodoQR').classList.toggle('active', metodo === 'qr');
    document.getElementById('btnMetodoEfectivo').classList.toggle('active', metodo === 'efectivo');
    document.getElementById('panelQR').classList.toggle('active', metodo === 'qr');
    document.getElementById('panelEfectivo').classList.toggle('active', metodo === 'efectivo');
  };

  window.abrirPasarela = function(id, total, precioHora) {
    _pasarelaId     = id;
    _pasarelaTotal  = parseFloat(total);
    _pasarelaMetodo = 'qr';

    const montoStr = `Bs. ${_pasarelaTotal.toFixed(2)}`;
    document.getElementById('pasarelaMonto').textContent    = montoStr;
    document.getElementById('qrMontoLabel').textContent     = montoStr;
    document.getElementById('efectivoMontoLabel').textContent = montoStr;

    // QR simulado con monto embebido (API pública libre)
    const qrData = encodeURIComponent(`EstAirbnb|Reserva:${id}|Monto:${_pasarelaTotal.toFixed(2)}`);
    document.getElementById('qrCodeImg').src =
      `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

    // Reset selector
    seleccionarMetodo('qr');

    const al = document.getElementById('pasarelaAlert');
    if (al) { al.style.display = 'none'; al.textContent = ''; }
    const btn = document.getElementById('btnConfirmarPago');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar Pago'; }
    document.getElementById('pasarelaOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.cerrarPasarela = function() {
    document.getElementById('pasarelaOverlay').classList.remove('open');
    document.body.style.overflow = '';
  };

  // ─── Modal de Pago de Multa ───
  let _multaId     = null;
  let _multaMonto  = 0;
  let _multaMetodo = 'qr';

  window.abrirModalMulta = function(id, monto) {
    _multaId     = id;
    _multaMonto  = parseFloat(monto);
    _multaMetodo = 'qr';

    const montoStr = `Bs. ${_multaMonto.toFixed(2)}`;
    document.getElementById('multaPagoMonto').textContent    = montoStr;
    document.getElementById('multaQrLabel').textContent      = montoStr;
    document.getElementById('multaEfectivoLabel').textContent = montoStr;

    const qrData = encodeURIComponent(`EstAirbnb|Multa:${id}|Monto:${_multaMonto.toFixed(2)}`);
    document.getElementById('multaQrImg').src =
      `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;

    seleccionarMetodoMulta('qr');

    const al = document.getElementById('multaPagoAlert');
    if (al) { al.style.display = 'none'; al.textContent = ''; }
    const btn = document.getElementById('btnConfirmarPagoMulta');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar Pago'; }

    document.getElementById('multaPagoOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  window.cerrarModalMulta = function() {
    document.getElementById('multaPagoOverlay').classList.remove('open');
    document.body.style.overflow = '';
  };

  window.seleccionarMetodoMulta = function(metodo) {
    _multaMetodo = metodo;
    document.getElementById('btnMetodoQRMulta').classList.toggle('active', metodo === 'qr');
    document.getElementById('btnMetodoEfectivoMulta').classList.toggle('active', metodo === 'efectivo');
    document.getElementById('panelQRMulta').classList.toggle('active', metodo === 'qr');
    document.getElementById('panelEfectivoMulta').classList.toggle('active', metodo === 'efectivo');
  };

  window.confirmarPagoMulta = async function() {
    const al = document.getElementById('multaPagoAlert');
    function showAlert(msg, ok) {
      al.style.display = 'block';
      al.style.background = ok ? '#f0fdf4' : '#fef2f2';
      al.style.color       = ok ? '#14532d' : '#991b1b';
      al.style.border      = `1px solid ${ok ? '#bbf7d0' : '#fca5a5'}`;
      al.innerHTML = `<i class="fa-solid ${ok ? 'fa-check-circle' : 'fa-circle-exclamation'}" style="margin-right:6px;"></i>${msg}`;
    }
    const btn = document.getElementById('btnConfirmarPagoMulta');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
    try {
      const res = await fetch(`/api/reservas/${_multaId}/pagar-multa`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conductor_id: currentUser.id, metodo_pago: _multaMetodo })
      });
      const json = await res.json();
      if (res.ok && json.status === 'ok') {
        showAlert('¡Multa pagada! El comprobante actualizado ya incluye este cargo.', true);
        setTimeout(() => { cerrarModalMulta(); cargarReservas(); showToast('¡Multa pagada! Comprobante actualizado.'); }, 2000);
      } else {
        showAlert(json.message || 'Error al procesar el pago.', false);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar Pago';
      }
    } catch (_) {
      showAlert('Error de red. Verifica tu conexión.', false);
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar Pago';
    }
  };

  window.pagarMulta = function(id) { /* legacy – no usado */ };

  window.confirmarPago = async function() {
    const al = document.getElementById('pasarelaAlert');

    function showPasarelaAlert(msg, ok) {
      al.style.display = 'block';
      al.style.background = ok ? '#f0fdf4' : '#fef2f2';
      al.style.color       = ok ? '#14532d' : '#991b1b';
      al.style.border      = `1px solid ${ok ? '#bbf7d0' : '#fca5a5'}`;
      al.innerHTML = `<i class="fa-solid ${ok ? 'fa-check-circle' : 'fa-circle-exclamation'}" style="margin-right:6px;"></i>${msg}`;
    }

    const btn = document.getElementById('btnConfirmarPago');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

    try {
      const res = await fetch(`/api/reservas/${_pasarelaId}/confirmar-pago`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conductor_id: currentUser.id, metodo_pago: _pasarelaMetodo })
      });
      const json = await res.json();
      if (res.ok && json.status === 'ok') {
        const esQR = _pasarelaMetodo === 'qr';
        const msg = esQR
          ? '¡Pago QR enviado! El anfitrión recibirá el comprobante y confirmará tu reserva.'
          : '¡Pago registrado! Preséntate con el efectivo al anfitrión. Él confirmará la recepción.';
        showPasarelaAlert(msg, true);
        const toastMsg = esQR
          ? '¡Comprobante QR enviado al anfitrión!'
          : '¡Efectivo registrado! El anfitrión confirmará el pago al llegar.';
        setTimeout(() => { cerrarPasarela(); cargarReservas(); showToast(toastMsg); }, 2200);
      } else {
        showPasarelaAlert(json.message || 'Error al procesar el pago.', false);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar Pago';
      }
    } catch (_) {
      showPasarelaAlert('Error de red. Verifica tu conexión e intenta de nuevo.', false);
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-lock"></i> Confirmar Pago';
    }
  };

  // ─── Calendario Visual ───
  let _calMes  = new Date().getMonth();
  let _calAnio = new Date().getFullYear();

  window.toggleCalendario = function() {
    const sec = document.getElementById('calendarSection');
    const btn = document.getElementById('btnToggleCalendar');
    if (!sec) return;
    const visible = sec.style.display !== 'none';
    sec.style.display = visible ? 'none' : 'block';
    if (btn) {
      btn.style.background = visible ? '#f1f5f9' : 'linear-gradient(135deg,#002542,#436182)';
      btn.style.color       = visible ? '#002542' : '#fff';
      btn.style.borderColor = visible ? '#e2e8f0' : 'transparent';
    }
    if (!visible) renderCalendario();
  };

  window.navCalendario = function(dir) {
    _calMes += dir;
    if (_calMes > 11) { _calMes = 0; _calAnio++; }
    if (_calMes < 0)  { _calMes = 11; _calAnio--; }
    renderCalendario();
  };

  function renderCalendario() {
    const grid   = document.getElementById('calendarGrid');
    const titulo = document.getElementById('calendarTitulo');
    if (!grid || !titulo) return;
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    titulo.textContent = `${meses[_calMes]} ${_calAnio}`;
    const primerDia = new Date(_calAnio, _calMes, 1);
    const ultimoDia = new Date(_calAnio, _calMes + 1, 0).getDate();
    const diasMap   = {};
    todasLasReservas.forEach(r => {
      const d = new Date(r.fecha_inicio);
      if (d.getMonth() === _calMes && d.getFullYear() === _calAnio) {
        const k = d.getDate();
        if (!diasMap[k]) diasMap[k] = [];
        diasMap[k].push(r);
      }
    });
    const dias = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    let html = `<div class="cal-headers">${dias.map(d=>`<div class="cal-hd">${d}</div>`).join('')}</div><div class="cal-days">`;
    const offset = (primerDia.getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) html += '<div class="cal-day empty"></div>';
    const hoy    = new Date();
    const colores = { pendiente:'#f59e0b', confirmada:'#006a62', finalizada:'#64748b', rechazada:'#ba1a1a', cancelada:'#94a3b8' };
    for (let d = 1; d <= ultimoDia; d++) {
      const reservas = diasMap[d] || [];
      const esHoy    = d === hoy.getDate() && _calMes === hoy.getMonth() && _calAnio === hoy.getFullYear();
      const hasR     = reservas.length > 0;
      const dots     = hasR ? `<div class="cal-dots">${reservas.slice(0,3).map(r=>`<span class="cal-dot" style="background:${colores[r.estado]||'#94a3b8'}"></span>`).join('')}</div>` : '';
      const tooltip  = hasR ? `title="${reservas.length} reserva(s) — clic para ver"` : '';
      const click    = hasR ? `onclick="scrollToReserva(${reservas[0].id})"` : '';
      html += `<div class="cal-day ${esHoy?'cal-today':''} ${hasR?'has-reserva':''}" ${click} ${tooltip}><span class="cal-num">${d}</span>${dots}</div>`;
    }
    html += '</div>';
    grid.innerHTML = html;
  }

  window.scrollToReserva = function(id) {
    const el = document.getElementById(`reserva-${id}`);
    if (el) { el.scrollIntoView({ behavior:'smooth', block:'center' }); el.style.outline = '2px solid #006a62'; setTimeout(() => { el.style.outline = ''; }, 1800); }
  };

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
    const calSec = document.getElementById('calendarSection');
    if (calSec && calSec.style.display !== 'none') renderCalendario();
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
      const calSec = document.getElementById('calendarSection');
      if (calSec && calSec.style.display !== 'none') renderCalendario();

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

        const multaExceso    = parseFloat(res.multa_exceso || 0);
        const multaPagada    = res.estado_pago === 'multa_pagada';
        const multaPendiente = multaExceso > 0 && !multaPagada && res.estado === 'finalizada';
        const addressEnc     = encodeURIComponent(res.garaje_direccion || '');
        const llegarBtn      = `<a href="https://www.google.com/maps/search/?api=1&query=${addressEnc}" target="_blank" class="btn-action-card btn-navigate" style="flex:1 1 auto;">
          <i class="fa-solid fa-location-arrow"></i> Cómo llegar
        </a>`;

        let pdfBtnHtml;
        if (res.estado !== 'finalizada') {
          pdfBtnHtml = `<button class="btn-action-card" style="flex:1 1 100%;opacity:0.55;cursor:not-allowed;background:#94a3b8;border:none;" disabled>
            <i class="fa-solid fa-file-pdf"></i> Descarga disponible al finalizar
          </button>`;
        } else if (multaPendiente) {
          pdfBtnHtml = `<button class="btn-action-card" style="flex:1 1 100%;opacity:0.7;cursor:not-allowed;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:none;" disabled>
            <i class="fa-solid fa-lock"></i> Paga la multa para descargar
          </button>`;
        } else {
          pdfBtnHtml = `<button class="btn-action-card btn-confirmar" style="flex:1 1 100%;background:linear-gradient(135deg,#16a34a,#15803d);box-shadow:0 4px 12px rgba(22,163,74,.25);" onclick="descargarPDF(${res.id})">
            <i class="fa-solid fa-file-pdf"></i> Descargar Comprobante
          </button>`;
        }

        if (res.estado === 'pendiente') {
          if (res.estado_pago === 'pagado') {
            cardFooterHtml = `
              <div class="card-footer-inner flex-col gap-2">
                <span style="display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:0.82rem;font-weight:700;color:#15803d;width:100%;">
                  <i class="fa-solid fa-circle-check"></i> Pago QR confirmado — Esperando confirmación del anfitrión
                </span>
                <div style="display:flex;gap:8px;width:100%;">
                  ${llegarBtn}
                  <button class="btn-action-card btn-checkin" style="flex:1 1 auto;" onclick="abrirComprobantePago(${res.id})">
                    <i class="fa-solid fa-receipt"></i> Ver comprobante
                  </button>
                </div>
              </div>`;
          } else if (res.estado_pago === 'efectivo_pendiente') {
            cardFooterHtml = `
              <div class="card-footer-inner flex-col gap-2">
                <span style="display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;font-size:0.82rem;font-weight:700;color:#c2410c;width:100%;">
                  <i class="fa-solid fa-money-bill-wave"></i> Dirígete al garaje y entrega el efectivo al anfitrión
                </span>
                <div style="display:flex;gap:8px;width:100%;">
                  ${llegarBtn}
                  <button class="btn-action-card" style="flex:1 1 auto;background:#fff7ed;color:#c2410c;border:1.5px solid #fed7aa;font-family:inherit;" onclick="abrirComprobantePago(${res.id})">
                    <i class="fa-solid fa-receipt"></i> Ver reserva
                  </button>
                </div>
              </div>`;
          } else if (res.estado_pago === 'efectivo_confirmado') {
            cardFooterHtml = `
              <div class="card-footer-inner flex-col gap-2">
                <span style="display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:0.82rem;font-weight:700;color:#15803d;width:100%;">
                  <i class="fa-solid fa-circle-check"></i> Efectivo confirmado — El anfitrión está confirmando tu reserva
                </span>
                <div style="display:flex;gap:8px;width:100%;">
                  ${llegarBtn}
                  <button class="btn-action-card btn-checkin" style="flex:1 1 auto;" onclick="abrirComprobantePago(${res.id})">
                    <i class="fa-solid fa-receipt"></i> Ver comprobante
                  </button>
                </div>
              </div>`;
          } else {
            cardFooterHtml = `
              <div class="card-footer-inner">
                <button class="btn-action-card" style="background:linear-gradient(135deg,#006a62,#009688);color:#fff;border:none;font-family:inherit;" onclick="abrirPasarela(${res.id}, ${res.precio_total}, ${res.precio_hora || 0})">
                  <i class="fa-solid fa-qrcode"></i> Pagar Bs. ${parseFloat(res.precio_total).toFixed(2)}
                </button>
              </div>`;
          }
        } else if (res.estado === 'confirmada') {
          const metodoAcceso = res.metodo_acceso || 'QR';
          const checkinIcon  = metodoAcceso === 'QR' ? 'fa-qrcode' : metodoAcceso === 'Código' ? 'fa-hashtag' : 'fa-id-card';
          const checkinLabel = metodoAcceso === 'QR' ? 'Check-in QR' : metodoAcceso === 'Código' ? 'Ver código de acceso' : 'Check-in — Mostrar al anfitrión';
          cardFooterHtml = `
            <div class="card-footer-inner" style="flex-wrap:wrap;gap:8px;">
              <button class="btn-action-card btn-checkin" style="flex:1 1 auto;" onclick="mostrarCheckIn(${res.id})">
                <i class="fa-solid ${checkinIcon}"></i> ${checkinLabel}
              </button>
              ${pdfBtnHtml}
            </div>
          `;
        } else if (res.estado === 'finalizada') {
          const reviewSection = res.ha_revisado
            ? `<span style="text-align:center;font-size:0.72rem;font-weight:700;color:#006a62;text-transform:uppercase;padding:8px 0;display:flex;align-items:center;justify-content:center;gap:6px;"><i class="fa-solid fa-check-circle"></i> Reseña Publicada</span>`
            : `<button class="btn-action-card btn-confirmar w-full" onclick="abrirModalResena(${res.id}, ${res.garaje_id})"><i class="fa-solid fa-star"></i> Calificar Espacio</button>`;

          let multaHtml = '';
          if (multaExceso > 0) {
            multaHtml = multaPagada
              ? `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:0.8rem;font-weight:700;color:#15803d;">
                  <i class="fa-solid fa-circle-check"></i> Multa de Bs. ${multaExceso.toFixed(2)} pagada
                 </div>`
              : `<div style="display:flex;flex-direction:column;gap:8px;padding:12px 14px;background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;">
                  <div style="display:flex;align-items:center;gap:6px;font-size:0.82rem;font-weight:800;color:#991b1b;">
                    <i class="fa-solid fa-triangle-exclamation"></i> Multa por exceso de tiempo
                  </div>
                  <div style="font-size:0.78rem;color:#9a3412;">Debes pagar <strong>Bs. ${multaExceso.toFixed(2)}</strong> antes de salir del parqueo.</div>
                  <button class="btn-action-card" style="background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:none;font-family:inherit;margin-top:2px;" onclick="abrirModalMulta(${res.id}, ${multaExceso})">
                    <i class="fa-solid fa-money-bill-wave"></i> Pagar Multa Bs. ${multaExceso.toFixed(2)}
                  </button>
                 </div>`;
          }

          cardFooterHtml = `
            <div class="card-footer-inner flex-col gap-2">
              ${multaHtml}
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

          <!-- Estado Stepper -->
          ${generarStepper(res.estado)}

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

  // ─── Check-in (adaptativo según metodo_acceso) ───
  window.mostrarCheckIn = function(id) {
    const reserva     = todasLasReservas.find(r => Number(r.id) === id);
    const metodo      = (reserva?.metodo_acceso || 'QR');
    const instruc     = reserva?.instrucciones_acceso || '';
    const direccion   = reserva?.garaje_direccion || '';

    let titleText, subtitleText, contentHTML, icono;

    if (metodo === 'QR') {
      icono       = 'fa-qrcode';
      titleText   = 'Check-in QR';
      subtitleText = 'Muestra este código — el anfitrión lo escanea para registrar tu entrada';
      contentHTML = `
        <div style="background:#f8fafc;padding:16px;border-radius:14px;margin-bottom:12px;display:flex;justify-content:center;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=EstAirbnb-Reserva-${id}" alt="QR Code" style="width:180px;height:180px;border-radius:6px;">
        </div>
        <p style="font-size:0.75rem;color:#94a3b8;margin-bottom:16px;">Reserva #${id} · Válido al momento de entrada</p>`;
    } else if (metodo === 'Código') {
      icono       = 'fa-hashtag';
      titleText   = 'Tu Código de Acceso';
      subtitleText = 'Ingresa este código en el teclado o panel del garaje';
      const displayCode = instruc ? instruc : `R-${String(id).padStart(5, '0')}`;
      contentHTML = `
        <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:14px;padding:24px 16px;margin-bottom:12px;">
          <div style="font-size:2rem;font-weight:900;color:#15803d;letter-spacing:6px;font-family:monospace;word-break:break-all;">${displayCode}</div>
        </div>
        <p style="font-size:0.75rem;color:#94a3b8;margin-bottom:16px;">Reserva #${id}</p>`;
    } else {
      icono       = 'fa-id-card';
      titleText   = 'Check-in Manual';
      subtitleText = 'Muestra esta pantalla al anfitrión como confirmación';
      contentHTML = `
        <div style="background:linear-gradient(135deg,#006a62,#009688);border-radius:14px;padding:18px 16px;margin-bottom:12px;color:#fff;text-align:left;">
          <div style="font-size:0.65rem;font-weight:700;opacity:0.7;text-transform:uppercase;margin-bottom:4px;letter-spacing:1px;">EstAirbnb · Reserva Confirmada</div>
          <div style="font-size:1.05rem;font-weight:800;margin-bottom:4px;">${direccion}</div>
          <div style="font-size:0.8rem;opacity:0.85;">Reserva #${id}</div>
          ${instruc ? `<div style="margin-top:10px;background:rgba(255,255,255,.18);border-radius:8px;padding:8px 10px;font-size:0.78rem;">${instruc}</div>` : ''}
        </div>
        <p style="font-size:0.75rem;color:#94a3b8;margin-bottom:16px;">El anfitrión te recibirá en persona</p>`;
    }

    const modalHTML = `
      <div id="checkInModal" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);padding:16px;" onclick="if(event.target===this)this.remove()">
        <div style="background:#fff;border-radius:20px;padding:28px 24px;max-width:340px;width:100%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.25);">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:#f0fdf4;margin-bottom:14px;">
            <i class="fa-solid ${icono}" style="font-size:1.25rem;color:#006a62;"></i>
          </div>
          <h3 style="font-size:1.15rem;font-weight:800;color:#0f172a;margin:0 0 6px;">${titleText}</h3>
          <p style="font-size:0.82rem;color:#64748b;margin:0 0 18px;">${subtitleText}</p>
          ${contentHTML}
          <button onclick="document.getElementById('checkInModal').remove()" style="width:100%;background:#0f172a;color:#fff;font-weight:700;padding:13px;border-radius:12px;border:none;cursor:pointer;font-family:inherit;font-size:0.9rem;">Cerrar</button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  };

  // ─── Comprobante visual de pago ───
  window.abrirComprobantePago = function(id) {
    const res = todasLasReservas.find(r => Number(r.id) === id);
    if (!res) return;

    const esQR              = res.estado_pago === 'pagado';
    const esEfecConf        = res.estado_pago === 'efectivo_confirmado';
    const esEfecPend        = res.estado_pago === 'efectivo_pendiente';
    const monto             = parseFloat(res.precio_total || 0).toFixed(2);
    const fmtFecha = (iso) => {
      const d = new Date(iso);
      return d.toLocaleString('es-BO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    };

    let estadoBadge, estadoColor, estadoBg, metodoLabel, metodoCuerpo;

    if (esQR) {
      estadoBadge  = 'Pago QR Confirmado';
      estadoColor  = '#15803d';
      estadoBg     = '#f0fdf4';
      metodoLabel  = 'QR / Transferencia digital';
      metodoCuerpo = `
        <div style="background:#f8fafc;padding:14px;border-radius:12px;margin-top:12px;display:flex;justify-content:center;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=EstAirbnb-Pago-${id}" alt="QR" style="width:120px;height:120px;border-radius:4px;">
        </div>
        <p style="font-size:0.72rem;color:#94a3b8;margin-top:8px;">El anfitrión puede escanear este código para verificar el pago</p>`;
    } else if (esEfecConf) {
      estadoBadge  = 'Efectivo Recibido ✓';
      estadoColor  = '#15803d';
      estadoBg     = '#f0fdf4';
      metodoLabel  = 'Efectivo en mano';
      metodoCuerpo = `<p style="font-size:0.8rem;color:#475569;margin-top:10px;">El anfitrión confirmó que recibió el efectivo. Tu reserva está siendo confirmada.</p>`;
    } else {
      estadoBadge  = 'Efectivo — Pendiente de entrega';
      estadoColor  = '#c2410c';
      estadoBg     = '#fff7ed';
      metodoLabel  = 'Efectivo en mano';
      metodoCuerpo = `<p style="font-size:0.8rem;color:#9a3412;margin-top:10px;">Dirígete al garaje y entrega el efectivo al anfitrión para que confirme tu pago.</p>`;
    }

    const modalHTML = `
      <div id="comprobanteModal" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);backdrop-filter:blur(4px);padding:16px;" onclick="if(event.target===this)this.remove()">
        <div style="background:#fff;border-radius:20px;padding:0;max-width:360px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.25);overflow:hidden;">
          <div style="background:linear-gradient(135deg,#006a62,#009688);padding:22px 24px;color:#fff;text-align:center;">
            <div style="font-size:0.65rem;font-weight:700;opacity:0.75;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;">EstAirbnb · Comprobante</div>
            <div style="font-size:1.6rem;font-weight:900;">Bs. ${monto}</div>
            <div style="margin-top:6px;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.2);border-radius:20px;padding:4px 12px;font-size:0.78rem;font-weight:700;">${estadoBadge}</div>
          </div>
          <div style="padding:20px 24px;">
            <div style="display:flex;flex-direction:column;gap:10px;font-size:0.82rem;">
              <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9;padding-bottom:8px;">
                <span style="color:#64748b;font-weight:600;">Reserva</span>
                <span style="color:#0f172a;font-weight:700;">#${id}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #f1f5f9;padding-bottom:8px;">
                <span style="color:#64748b;font-weight:600;">Garaje</span>
                <span style="color:#0f172a;font-weight:700;text-align:right;max-width:60%;">${res.garaje_direccion || '—'}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9;padding-bottom:8px;">
                <span style="color:#64748b;font-weight:600;">Check-in</span>
                <span style="color:#0f172a;font-weight:700;">${fmtFecha(res.fecha_inicio)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9;padding-bottom:8px;">
                <span style="color:#64748b;font-weight:600;">Check-out</span>
                <span style="color:#0f172a;font-weight:700;">${fmtFecha(res.fecha_fin)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="color:#64748b;font-weight:600;">Método de pago</span>
                <span style="color:#0f172a;font-weight:700;">${metodoLabel}</span>
              </div>
            </div>
            ${metodoCuerpo}
            <button onclick="document.getElementById('comprobanteModal').remove()" style="width:100%;background:#0f172a;color:#fff;font-weight:700;padding:13px;border-radius:12px;border:none;cursor:pointer;font-family:inherit;font-size:0.9rem;margin-top:18px;">Cerrar</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  };

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

    const _multaVal = parseFloat(reserva.multa_exceso || 0);
    if (_multaVal > 0 && reserva.estado_pago !== 'multa_pagada') {
      showToast('Debes pagar la multa antes de descargar el comprobante.', 'error');
      return;
    }

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

      // ── Multa (si existe) ────────────────────────────────────
      const multaExcesoPdf = parseFloat(reserva.multa_exceso || 0);
      if (multaExcesoPdf > 0) {
        const multaPagada = reserva.estado_pago === 'multa_pagada';
        const mColor = multaPagada ? [22, 163, 74] : [220, 38, 38];
        doc.setFillColor(...mColor);
        doc.roundedRect(15, y - 5, pW - 30, 22, 3, 3, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
        doc.text('CARGO ADICIONAL — MULTA POR EXCESO DE TIEMPO', 20, y + 3);
        doc.setFontSize(11);
        doc.text(`Bs. ${multaExcesoPdf.toFixed(2)}`, pW - 20, y + 3, { align: 'right' });
        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.text(multaPagada ? '✓ Multa pagada' : '⚠ Pendiente de pago', 20, y + 12);
        y += 30;
      }

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
