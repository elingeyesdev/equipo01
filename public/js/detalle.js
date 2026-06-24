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
  const urlParams = new URLSearchParams(window.location.search);
  const PREVIEW_MODE = (urlParams.get('preview') === '1' || urlParams.get('mode') === 'preview') && currentUser && currentUser.rol_id === 1;

  // Si no está logueado, redirigir a login
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  // Si es Anfitrión (rol_id = 1), no puede ver Detalle salvo en modo preview
  if (currentUser.rol_id === 1 && !PREVIEW_MODE) {
    window.location.href = '/mis-garajes.html';
    return;
  }

  if (PREVIEW_MODE && document.body) {
    document.body.classList.add('preview-mode');
  }

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

  // Mapa 2D elements (inside wizard)
  const mapaParqueo              = document.getElementById('mapa-parqueo');
  const espacioSeleccionadoInfo  = document.getElementById('espacioSeleccionadoInfo');
  const espacioSeleccionadoLabel = document.getElementById('espacioSeleccionadoLabel');

  let garajeCargado = null;
  let espacioSeleccionadoId = null;
  let espacioSeleccionadoNumero = null;

  // ─── Booking Wizard State ───
  let reservaWizardStep = 1;
  const RESERVA_TOTAL_STEPS = 3;
  let cuponAplicado = null;

  // ─── Booking Wizard: Open / Close ───
  window.openReservaWizard = function() {
    const overlay = document.getElementById('reservaWizardOverlay');
    if (!overlay) return;
    overlay.hidden = false;
    cuponAplicado = null;
    const ic = document.getElementById('inputCupon');
    const fb = document.getElementById('cuponFeedback');
    const rd = document.getElementById('rowDescuento');
    if (ic) ic.value = '';
    if (fb) { fb.style.display = 'none'; fb.textContent = ''; }
    if (rd) rd.style.display = 'none';
    renderHorariosReserva();
    calcularPrecioEnWizard();
    reservaWizardGoTo(1);
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  window.closeReservaWizard = function() {
    const overlay = document.getElementById('reservaWizardOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    window.setTimeout(() => {
      if (!overlay.classList.contains('open')) overlay.hidden = true;
    }, 300);
  };

  function reservaWizardGoTo(step) {
    reservaWizardStep = step;
    document.querySelectorAll('.reserva-panel').forEach(p => {
      p.classList.toggle('active', parseInt(p.dataset.step) === step);
    });
    document.querySelectorAll('.reserva-step-item').forEach(item => {
      const s = parseInt(item.dataset.step);
      item.classList.remove('active', 'completed');
      if (s === step) item.classList.add('active');
      else if (s < step) item.classList.add('completed');
    });
    const counter = document.getElementById('reservaStepCounter');
    if (counter) counter.textContent = `Paso ${step} de ${RESERVA_TOTAL_STEPS}`;
    const btnPrev = document.getElementById('btnReservaPrev');
    const btnNext = document.getElementById('btnReservaNext');
    const btnConfirm = document.getElementById('btnConfirmarReserva');
    if (btnPrev) btnPrev.style.display = step === 1 ? 'none' : '';
    if (btnNext) btnNext.style.display = step === RESERVA_TOTAL_STEPS ? 'none' : '';
    if (btnConfirm) btnConfirm.style.display = step === RESERVA_TOTAL_STEPS ? '' : 'none';
    if (btnNext) btnNext.disabled = false;
    if (step === 2) actualizarEstadoBotonReservaHorario();
    const body = document.querySelector('.reserva-wizard-body');
    if (body) body.scrollTop = 0;
  }

  function reservaWizardNext() {
    if (!validateReservaStep(reservaWizardStep)) return;
    if (reservaWizardStep < RESERVA_TOTAL_STEPS) {
      if (reservaWizardStep === 2) buildReservaSummary();
      reservaWizardGoTo(reservaWizardStep + 1);
    }
  }

  function reservaWizardPrev() {
    if (reservaWizardStep > 1) reservaWizardGoTo(reservaWizardStep - 1);
  }

  function validateReservaStep(step) {
    if (step === 1) {
      if (!espacioSeleccionadoId) {
        showToast('Selecciona un espacio en el mapa para continuar.', 'error');
        return false;
      }
    }
    if (step === 2) {
      const fe = document.getElementById('fechaEntrada');
      const fs = document.getElementById('fechaSalida');
      if (!fe?.value || !fs?.value) {
        showToast('Ingresa la fecha de llegada y salida.', 'error');
        return false;
      }
      if (new Date(fs.value) <= new Date(fe.value)) {
        showToast('La salida debe ser posterior a la llegada.', 'error');
        return false;
      }
      const validacionHorario = validarHorarioSeleccionado(new Date(fe.value), new Date(fs.value));
      if (!validacionHorario.ok) {
        showToast(validacionHorario.message, 'error');
        calcularPrecioEnWizard();
        return false;
      }
    }
    return true;
  }

  function buildReservaSummary() {
    const fe = document.getElementById('fechaEntrada');
    const fs = document.getElementById('fechaSalida');
    if (!fe?.value || !fs?.value || !garajeCargado) return;
    const start = new Date(fe.value);
    const end   = new Date(fs.value);
    const difHoras = Math.ceil((end - start) / (1000 * 60 * 60));
    const subtotal  = difHoras * parseFloat(garajeCargado.precio_hora);
    const tarifa    = subtotal * 0.10;
    const baseConTarifa = subtotal + tarifa;
    let descuento = 0;
    if (cuponAplicado) {
      descuento = subtotal * (cuponAplicado.descuento_porcentaje / 100);
    }
    const total = baseConTarifa - descuento;
    const fmt = dt => dt.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('sumEspacio',  `Espacio ${espacioSeleccionadoNumero || '--'}`);
    setEl('sumEntrada',  fmt(start));
    setEl('sumSalida',   fmt(end));
    setEl('sumHoras',    difHoras);
    setEl('sumSubtotal', `Bs. ${subtotal.toFixed(2)}`);
    setEl('sumTarifa',   `Bs. ${tarifa.toFixed(2)}`);
    setEl('sumTotal',    `Bs. ${total.toFixed(2)}`);
    const rowDescuento = document.getElementById('rowDescuento');
    if (cuponAplicado && rowDescuento) {
      setEl('sumDescuentoLabel', `Descuento (${cuponAplicado.codigo} −${cuponAplicado.descuento_porcentaje}%)`);
      setEl('sumDescuento', `-Bs. ${descuento.toFixed(2)}`);
      rowDescuento.style.display = '';
    } else if (rowDescuento) {
      rowDescuento.style.display = 'none';
    }
    const checkAcepto = document.getElementById('checkAcepto');
    const btnConfirm  = document.getElementById('btnConfirmarReserva');
    if (checkAcepto) checkAcepto.checked = false;
    if (btnConfirm) btnConfirm.disabled = true;
  }

  async function handleCuponApply() {
    const input = document.getElementById('inputCupon');
    const fb    = document.getElementById('cuponFeedback');
    const btn   = document.getElementById('btnAplicarCupon');
    if (!input || !fb) return;
    const codigo = input.value.trim().toUpperCase();
    if (!codigo) {
      cuponAplicado = null;
      fb.style.display = 'none';
      buildReservaSummary();
      return;
    }
    if (btn) { btn.style.opacity = '0.6'; btn.disabled = true; }
    try {
      const res  = await fetch(`/api/cupones/${encodeURIComponent(codigo)}`);
      const json = await res.json();
      if (res.ok && json.status === 'ok') {
        cuponAplicado = json.data;
        fb.style.cssText = 'display:block;margin-top:6px;font-size:.8rem;font-weight:600;padding:6px 10px;border-radius:8px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;';
        // Calcular ahorro si ya se seleccionaron fechas
        let ahorroStr = '';
        const feEl = document.getElementById('fechaEntrada');
        const fsEl = document.getElementById('fechaSalida');
        if (feEl?.value && fsEl?.value && garajeCargado) {
          const difH = Math.ceil((new Date(fsEl.value) - new Date(feEl.value)) / (1000 * 60 * 60));
          const base = difH * parseFloat(garajeCargado.precio_hora);
          const ahorro = base * (cuponAplicado.descuento_porcentaje / 100);
          ahorroStr = ` — Ahorras Bs. ${ahorro.toFixed(2)}`;
        }
        fb.textContent = `✓ Cupón aplicado: ${cuponAplicado.descuento_porcentaje}% de descuento${ahorroStr}`;
      } else {
        cuponAplicado = null;
        fb.style.cssText = 'display:block;margin-top:6px;font-size:.8rem;font-weight:600;padding:6px 10px;border-radius:8px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;';
        fb.textContent = json.message || 'Cupón inválido o expirado.';
      }
    } catch {
      cuponAplicado = null;
      fb.style.cssText = 'display:block;margin-top:6px;font-size:.8rem;font-weight:600;padding:6px 10px;border-radius:8px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;';
      fb.textContent = 'Error al verificar el cupón.';
    } finally {
      if (btn) { btn.style.opacity = ''; btn.disabled = false; }
    }
    buildReservaSummary();
  }

  function obtenerHorariosGaraje() {
    if (!garajeCargado) return [];
    if (garajeCargado.horarios_flexibles) {
      try {
        const horarios = JSON.parse(garajeCargado.horarios_flexibles);
        if (Array.isArray(horarios)) {
          return horarios
            .filter(h => Array.isArray(h.dias) && h.inicio && h.fin)
            .map(h => ({
              dias: h.dias.map(d => Number(d)),
              inicio: String(h.inicio).slice(0, 5),
              fin: String(h.fin).slice(0, 5)
            }));
        }
      } catch (_) {}
    }

    if (garajeCargado.hora_apertura && garajeCargado.hora_cierre) {
      const diasMap = {
        'L-D': [1, 2, 3, 4, 5, 6, 0],
        'L-V': [1, 2, 3, 4, 5],
        'L-S': [1, 2, 3, 4, 5, 6],
        'S-D': [6, 0]
      };
      return [{
        dias: diasMap[garajeCargado.dias_operativos] || [1, 2, 3, 4, 5, 6, 0],
        inicio: String(garajeCargado.hora_apertura).slice(0, 5),
        fin: String(garajeCargado.hora_cierre).slice(0, 5)
      }];
    }

    return [];
  }

  function minutosDeHora(hora) {
    const [h, m] = String(hora || '00:00').split(':').map(Number);
    return (h * 60) + (m || 0);
  }

  function formatearDias(dias) {
    const nombres = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 0: 'Dom' };
    const normalizados = [...dias].map(Number).sort((a, b) => {
      const order = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 0: 7 };
      return order[a] - order[b];
    });
    if (normalizados.length === 7) return 'Todos los días';
    if (normalizados.join(',') === '1,2,3,4,5') return 'Lun a Vie';
    if (normalizados.join(',') === '1,2,3,4,5,6') return 'Lun a Sáb';
    if (normalizados.join(',') === '6,0') return 'Fin de semana';
    return normalizados.map(d => nombres[d]).join(', ');
  }

  function renderHorariosReserva() {
    const target = document.getElementById('reservaHorariosGaraje');
    if (!target) return;
    const horarios = obtenerHorariosGaraje();
    if (!horarios.length) {
      target.innerHTML = `
        <div class="reserva-availability-title"><i class="fa-regular fa-clock"></i> Horarios del garaje</div>
        <div class="reserva-schedule-list">
          <span class="reserva-schedule-chip">Horario no especificado</span>
        </div>`;
      return;
    }

    target.innerHTML = `
      <div class="reserva-availability-title"><i class="fa-regular fa-clock"></i> Horarios del garaje</div>
      <div class="reserva-schedule-list">
        ${horarios.map(h => `<span class="reserva-schedule-chip">${formatearDias(h.dias)} · ${h.inicio} - ${h.fin}</span>`).join('')}
      </div>`;
  }

  function validarHorarioSeleccionado(start, end) {
    if (!(start instanceof Date) || !(end instanceof Date) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { ok: false, message: 'Elige una fecha y hora válidas.' };
    }
    if (end <= start) {
      return { ok: false, message: 'La salida debe ser posterior a la llegada.' };
    }

    const horarios = obtenerHorariosGaraje();
    if (!horarios.length) return { ok: true };
    if (start.toDateString() !== end.toDateString()) {
      return { ok: false, message: 'Por ahora la reserva debe iniciar y terminar el mismo día.' };
    }

    const dia = start.getDay();
    const inicio = (start.getHours() * 60) + start.getMinutes();
    const fin = (end.getHours() * 60) + end.getMinutes();
    const calza = horarios.some(h => h.dias.includes(dia) && inicio >= minutosDeHora(h.inicio) && fin <= minutosDeHora(h.fin));

    if (calza) return { ok: true };
    const hoy = horarios.filter(h => h.dias.includes(dia)).map(h => `${h.inicio} - ${h.fin}`).join(', ');
    return {
      ok: false,
      message: hoy
        ? `Ese horario está fuera de la disponibilidad del garaje para ese día: ${hoy}.`
        : 'El garaje no está disponible ese día.'
    };
  }

  function actualizarEstadoBotonReservaHorario() {
    const btnNext = document.getElementById('btnReservaNext');
    if (!btnNext || reservaWizardStep !== 2) return;
    const fe = document.getElementById('fechaEntrada');
    const fs = document.getElementById('fechaSalida');
    if (!fe?.value || !fs?.value) {
      btnNext.disabled = true;
      return;
    }
    btnNext.disabled = !validarHorarioSeleccionado(new Date(fe.value), new Date(fs.value)).ok;
  }

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

  // ─── Build Image Gallery ───
  function renderCarousel(fotos) {
    if (!carouselSection) return;

    if (!fotos || fotos.length === 0) {
      carouselSection.innerHTML = `
        <div class="detalle-gallery-empty">
          <span class="material-symbols-outlined">image</span>
          <span>Sin fotos disponibles</span>
        </div>`;
      return;
    }

    if (fotos.length === 1) {
      carouselSection.innerHTML = `
        <div class="dg-full">
          <img src="${fotos[0].foto_url}" alt="Foto del parqueo" loading="lazy">
        </div>`;
      return;
    }

    const [main, ...rest] = fotos.slice(0, 3);
    const thumbs = rest.map((f, i) =>
      `<div class="dg-thumb"><img src="${f.foto_url}" alt="Foto ${i + 2}" loading="lazy"></div>`
    ).join('');

    carouselSection.innerHTML = `
      <div class="dg-main"><img src="${main.foto_url}" alt="Foto principal" loading="lazy"></div>
      <div class="dg-thumbs">${thumbs}</div>`;
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
    document.title = PREVIEW_MODE
      ? `Vista previa · ${garaje.direccion} · EstAirbnb`
      : `${garaje.direccion} · EstAirbnb`;

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
          return `<span style="display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border-radius:10px;background:var(--c-paper);font-size:0.8rem;font-weight:600;color:var(--c-primary);border:1px solid var(--c-warm-border);"><i class="fa-solid ${cfg.icon}" style="color:var(--c-outline);"></i> ${cfg.label}</span>`;
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
        <div style="margin-top:24px; padding:20px; background:var(--c-paper-2); border-radius:14px; border:1px solid var(--c-warm-border);">
          <h4 style="font-size: 0.72rem; font-weight: 700; color:var(--c-on-muted); margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.08em;">Seguridad y acceso</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 11px;">
              <div style="width: 38px; height: 38px; border-radius: 10px; background:rgba(12,110,98,.08); color:var(--c-secondary); display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid ${securityIcons[garaje.nivel_seguridad] || 'fa-shield'}"></i>
              </div>
              <div>
                <div style="font-size: 0.7rem; color:var(--c-outline); font-weight: 600;">Seguridad</div>
                <div style="font-size: 0.85rem; color:var(--c-primary); font-weight: 700;">${garaje.nivel_seguridad || 'Estándar'}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 11px;">
              <div style="width: 38px; height: 38px; border-radius: 10px; background:rgba(12,110,98,.08); color:var(--c-secondary); display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid ${accessIcons[garaje.metodo_acceso] || 'fa-key'}"></i>
              </div>
              <div>
                <div style="font-size: 0.7rem; color:var(--c-outline); font-weight: 600;">Entrada</div>
                <div style="font-size: 0.85rem; color:var(--c-primary); font-weight: 700;">${garaje.metodo_acceso || 'Manual'}</div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Instrucciones de acceso paso a paso (dentro del bloque if garajeDescripcion)
      if (garaje.instrucciones_acceso && garaje.instrucciones_acceso.trim()) {
        const texto = garaje.instrucciones_acceso.trim();
        let pasos;
        const numerados = texto.match(/\d+[\.\)]\s+[^\n]+/g);
        if (numerados && numerados.length > 1) {
          pasos = numerados.map(p => p.replace(/^\d+[\.\)]\s+/, '').trim()).filter(p => p.length > 0);
        } else {
          pasos = texto.split('\n').map(p => p.replace(/^[-•*]\s*/, '').trim()).filter(p => p.length > 0);
        }
        const stepsHtml = pasos.map((paso, i) => `
          <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;${i < pasos.length - 1 ? 'border-bottom:1px solid rgba(0,106,98,0.1);' : ''}">
            <div style="width:26px;height:26px;border-radius:50%;background:#006a62;color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;flex-shrink:0;">${i + 1}</div>
            <div style="font-size:0.88rem;color:#1e293b;line-height:1.55;padding-top:2px;">${paso}</div>
          </div>`).join('');
        garajeDescripcion.innerHTML += `
          <div style="margin-top:24px;padding:20px;background:var(--c-paper-2);border-radius:14px;border:1px solid var(--c-warm-border);">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
              <i class="fa-solid fa-route" style="color:var(--c-secondary);font-size:0.9rem;"></i>
              <h4 style="font-size:0.72rem;font-weight:700;color:var(--c-on-muted);margin:0;text-transform:uppercase;letter-spacing:0.08em;">Cómo acceder al garaje</h4>
            </div>
            ${stepsHtml}
          </div>`;
      }
    }

    // Quick info chips for the CTA card
    const quickInfo = document.getElementById('garajeQuickInfo');
    if (quickInfo) {
      const chipStyle = 'display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:8px;font-size:0.75rem;font-weight:600;background:var(--c-paper);color:var(--c-primary);border:1px solid var(--c-warm-border);';
      const chipIco = 'color:var(--c-outline);';
      quickInfo.innerHTML = `
        <span style="${chipStyle}"><i class="fa-solid fa-shield-halved" style="${chipIco}"></i> ${garaje.nivel_seguridad || 'Estándar'}</span>
        <span style="${chipStyle}"><i class="fa-solid fa-key" style="${chipIco}"></i> ${garaje.metodo_acceso || 'Manual'}</span>
        ${garaje.tipo_vehiculo ? `<span style="${chipStyle}"><i class="fa-solid fa-car" style="${chipIco}"></i> ${TIPO_CONFIG[garaje.tipo_vehiculo]?.label || garaje.tipo_vehiculo}</span>` : ''}
        ${PREVIEW_MODE ? `<span style="${chipStyle}"><i class="fa-solid fa-eye" style="${chipIco}"></i> Vista previa</span>` : ''}
      `;
    }

    if (PREVIEW_MODE) {
      const btnReserve = document.getElementById('btnAbrirWizardReserva');
      const bookingNote = document.querySelector('#bookingCtaCard .booking-note');
      if (btnReserve) btnReserve.style.display = 'none';
      if (bookingNote) bookingNote.textContent = 'Vista previa del anfitrión. Sin opción de reservar.';
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
    const espacioMap = {};
    espacios.forEach(e => { espacioMap[`${e.fila}-${e.columna}`] = e; });
    const filas = matriz.length;
    const cols = filas > 0 ? matriz[0].length : 0;

    // Inject Adaptive Lanes CSS if not present
    if (!document.getElementById('gc-adaptive-style')) {
      const style = document.createElement('style');
      style.id = 'gc-adaptive-style';
      style.innerHTML = `
        .gc{aspect-ratio:1.15;border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;transition:filter 0.08s,transform 0.08s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;overflow:hidden}
        .gc[data-t=empty]{background:#1e293b;border:1px dashed rgba(255,255,255,0.06)}
        .gc[data-t=parking]{background:#14532d;border-left:3px solid #22c55e;border-right:3px solid #22c55e;border-top:1px solid rgba(34,197,94,0.25);border-bottom:1px solid rgba(34,197,94,0.25)}
        .gc[data-t=wall]{background:#0f172a;border:1.5px solid #020617;background-image:repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(255,255,255,0.025) 4px,rgba(255,255,255,0.025) 5px)}
        .gc[data-t=entrance]{background:#064e3b;border:2px solid #10b981}
        .gc[data-t=exit]{background:#7f1d1d;border:2px solid #ef4444}
        .gc[data-t=aisle]{background:#1e293b;border:none}
        .gc-num{font-size:10px;font-weight:700;color:rgba(255,255,255,0.9);line-height:1;letter-spacing:0.03em}
        .gc-ico{width:18px;height:18px;display:flex;align-items:center;justify-content:center}
        .gc-lbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.8);margin-top:2px}
        .gc-aisle-inner{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
        .gc-aisle-h{width:86%;height:2px;background:repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 7px,transparent 7px,transparent 12px);border-radius:1px}
        .gc-aisle-v{width:2px;height:86%;background:repeating-linear-gradient(180deg,#f59e0b 0,#f59e0b 7px,transparent 7px,transparent 12px);border-radius:1px}
        .gc-aisle-cross{position:absolute;inset:0}
        .gc-aisle-cross::before{content:'';position:absolute;top:50%;left:7%;right:7%;height:2px;background:repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 7px,transparent 7px,transparent 12px);transform:translateY(-50%);border-radius:1px}
        .gc-aisle-cross::after{content:'';position:absolute;left:50%;top:7%;bottom:7%;width:2px;background:repeating-linear-gradient(180deg,#f59e0b 0,#f59e0b 7px,transparent 7px,transparent 12px);transform:translateX(-50%);border-radius:1px}
      `;
      style.innerHTML += `
        .gc{min-height:54px!important;border-radius:12px!important;border:1px solid rgba(15,23,42,.08)!important;background:rgba(255,255,255,.78)!important;box-shadow:0 1px 2px rgba(15,23,42,.06)!important;color:#111827!important;transition:transform .16s ease,box-shadow .16s ease!important}
        .gc[data-t=empty]{background:rgba(255,255,255,.52)!important;border:1px dashed rgba(148,163,184,.55)!important;box-shadow:none!important}
        .gc[data-t=parking]{background:linear-gradient(180deg,#fff,#f8fafc)!important;border:2px solid #34c759!important;box-shadow:inset 0 -4px 0 rgba(52,199,89,.16),0 4px 12px rgba(22,163,74,.10)!important}
        .gc[data-t=wall]{background:linear-gradient(135deg,#111827,#374151)!important;border:2px solid #020617!important;color:#f9fafb!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),0 5px 14px rgba(15,23,42,.18)!important}
        .gc[data-t=entrance]{background:linear-gradient(180deg,#dcfce7,#bbf7d0)!important;border:2px solid #22c55e!important;color:#166534!important}
        .gc[data-t=exit]{background:linear-gradient(180deg,#fee2e2,#fecaca)!important;border:2px solid #ef4444!important;color:#991b1b!important}
        .gc[data-t=aisle]{background:#e5e7eb!important;border:1px solid #cbd5e1!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.72)!important}
        .gc-num{color:#111827!important;font-size:12px!important;font-weight:800!important;letter-spacing:0!important}
        .gc-lbl{color:currentColor!important;font-size:9px!important;font-weight:800!important;letter-spacing:0!important;text-transform:none!important}
        .gc-symbol{font-size:20px!important;color:currentColor!important}
        .gc-aisle-h,.gc-aisle-v,.gc-aisle-cross::before,.gc-aisle-cross::after{background:#fbbf24!important;border-radius:99px!important}
        .gc-aisle-h{width:78%!important;height:4px!important}
        .gc-aisle-v{width:4px!important;height:78%!important}
        .gc.seleccionado{outline:3px solid #007aff!important;outline-offset:2px;box-shadow:0 0 0 6px rgba(0,122,255,.16),0 10px 24px rgba(15,23,42,.14)!important}
      `;
      document.head.appendChild(style);
    }

    mapaParqueo.style.cssText = 'background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(243,244,246,.95));padding:18px;border-radius:18px;border:1px solid rgba(15,23,42,.08);box-shadow:0 18px 45px rgba(15,23,42,.10);overflow-x:auto;-webkit-overflow-scrolling:touch;';
    mapaParqueo.innerHTML = '';

    const grid = document.createElement('div');
    grid.style.cssText = `display:inline-grid;grid-template-columns:repeat(${cols},minmax(58px,1fr));gap:7px;min-width:max-content;`;

    const vCfg = { 
      auto: { icon:'directions_car', color:'#3b82f6', sz:'15px' }, 
      moto: { icon:'two_wheeler', color:'#f59e0b', sz:'13px' }, 
      camioneta: { icon:'local_shipping', color:'#8b5cf6', sz:'15px' }, 
      techado: { icon:'garage', color:'#10b981', sz:'15px' } 
    };

    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        const cd = matriz[f][c] || { tile:'empty', tipo_vehiculo:'auto' };
        const tile = cd.tile || 'empty';
        const key = `${f+1}-${c+1}`;
        const esp = espacioMap[key];
        const cell = document.createElement('div');
        cell.className = 'gc';
        cell.setAttribute('data-t', tile);

        if (tile === 'parking' && esp) {
          const libre = esp.estado === 'libre';
          const mantenimiento = esp.estado === 'mantenimiento';
          const v = vCfg[esp.tipo_vehiculo] || vCfg.auto;
          
          if (mantenimiento) {
             cell.style.background = '#422006';
             cell.style.borderLeft = '3px solid #f59e0b';
             cell.style.borderRight = '3px solid #f59e0b';
             cell.style.borderTop = '1px solid rgba(245,158,11,0.25)';
             cell.style.borderBottom = '1px solid rgba(245,158,11,0.25)';
          } else if (!libre) {
             cell.style.background = '#450a0a';
             cell.style.borderLeft = '3px solid #ef4444';
             cell.style.borderRight = '3px solid #ef4444';
             cell.style.borderTop = '1px solid rgba(239,68,68,0.25)';
             cell.style.borderBottom = '1px solid rgba(239,68,68,0.25)';
          }
          cell.style.cursor = libre ? 'pointer' : 'not-allowed';

          const top = document.createElement('div');
          top.className = 'gc-ico';
          let iconColor = libre ? v.color : (mantenimiento ? '#fbbf24' : '#f87171');
          top.style.cssText = `color:${iconColor};display:flex;align-items:center;justify-content:center`;
          top.innerHTML = `<span class="material-symbols-outlined" style="font-size:${v.sz};">${v.icon}</span>`;
          
          const num = document.createElement('div');
          num.className = 'gc-num';
          num.style.color = libre ? 'rgba(255,255,255,0.9)' : (mantenimiento ? '#fde68a' : '#fca5a5');
          num.style.fontSize = mantenimiento ? '8px' : '10px';
          num.textContent = mantenimiento ? 'MANT' : esp.numero_espacio;
          
          cell.appendChild(top); cell.appendChild(num);

          let estadoText = 'Ocupado';
          if (libre) estadoText = 'Libre';
          if (mantenimiento) estadoText = 'En Mantenimiento';
          cell.title = `${esp.numero_espacio} — ${estadoText}`;
          
          if (libre) {
            cell.addEventListener('mouseenter', () => { cell.style.filter = 'brightness(1.18)'; cell.style.transform = 'scale(1.06)'; cell.style.zIndex = '3'; });
            cell.addEventListener('mouseleave', () => { if (cell.dataset.selected !== 'true') { cell.style.filter = ''; cell.style.transform = ''; cell.style.zIndex = ''; } });
            cell.addEventListener('click', () => {
              grid.querySelectorAll('.seleccionado,[data-selected="true"]').forEach(el => {
                el.classList.remove('seleccionado');
                el.dataset.selected = 'false';
                el.style.filter = '';
                el.style.transform = '';
                el.style.zIndex = '';
              });
              cell.dataset.selected = 'true';
              cell.style.zIndex = '4';
              seleccionarEspacio(cell, esp);
            });
          }
        } else if (tile === 'entrance') {
          cell.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M10 5l3 3-3 3" stroke="#10b981" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="gc-lbl" style="color:#10b981">ENT</div>';
        } else if (tile === 'exit') {
          cell.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M6 5L3 8l3 3" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="gc-lbl" style="color:#ef4444">SAL</div>';
        } else if (tile === 'wall') {
          cell.innerHTML = '<div style="font-size:8px;color:rgba(255,255,255,0.15);font-weight:700;letter-spacing:0.05em">▪▪▪</div>';
        } else if (tile === 'aisle') {
          const inner = document.createElement('div');
          inner.className = 'gc-aisle-inner';
          if (cd.adir === 'cross') {
            inner.innerHTML = '<div class="gc-aisle-cross"></div>';
          } else if (cd.adir === 'v') {
            inner.innerHTML = '<div class="gc-aisle-v"></div>';
          } else {
            inner.innerHTML = '<div class="gc-aisle-h"></div>';
          }
          cell.appendChild(inner);
        }
        if (tile === 'entrance') {
          cell.innerHTML = '<span class="material-symbols-outlined gc-symbol">login</span><div class="gc-lbl">Entrada</div>';
        } else if (tile === 'exit') {
          cell.innerHTML = '<span class="material-symbols-outlined gc-symbol">logout</span><div class="gc-lbl">Salida</div>';
        } else if (tile === 'wall') {
          cell.innerHTML = '<span class="material-symbols-outlined gc-symbol">density_large</span><div class="gc-lbl">Pared</div>';
        }
        grid.appendChild(cell);
      }
    }
    mapaParqueo.appendChild(grid);

    // Leyenda
    const leg = document.createElement('div');
    leg.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;padding:10px 12px;background:#fff;border-radius:12px;border:1px solid rgba(15,23,42,.08);';
    leg.innerHTML = `
      <span style="display:flex;align-items:center;gap:4px;font-size:.68rem;color:#94a3b8;font-weight:600;"><span style="width:12px;height:8px;border-radius:2px;background:#14532d;border-left:3px solid #22c55e;border-right:3px solid #22c55e;display:inline-block;"></span>Libre</span>
      <span style="display:flex;align-items:center;gap:4px;font-size:.68rem;color:#94a3b8;font-weight:600;"><span style="width:12px;height:8px;border-radius:2px;background:#450a0a;border-left:3px solid #ef4444;border-right:3px solid #ef4444;display:inline-block;"></span>Ocupado</span>
      <span style="display:flex;align-items:center;gap:4px;font-size:.68rem;color:#94a3b8;font-weight:600;"><span style="width:12px;height:8px;border-radius:2px;background:#422006;border-left:3px solid #f59e0b;border-right:3px solid #f59e0b;display:inline-block;"></span>Mantenimiento</span>
    `;
    mapaParqueo.appendChild(leg);
  }




  function seleccionarEspacio(slotEl, espacio) {
    mapaParqueo.querySelectorAll('.seleccionado,[data-selected="true"]').forEach(prev => {
      prev.classList.remove('seleccionado');
      prev.dataset.selected = 'false';
      prev.style.filter = '';
      prev.style.transform = '';
      prev.style.zIndex = '';
    });
    slotEl.classList.add('seleccionado');
    slotEl.dataset.selected = 'true';
    espacioSeleccionadoId = espacio.id;
    espacioSeleccionadoNumero = espacio.numero_espacio;
    if (espacioSeleccionadoLabel) espacioSeleccionadoLabel.textContent = espacio.numero_espacio;
    if (espacioSeleccionadoInfo) espacioSeleccionadoInfo.classList.remove('hidden');
  }

  // ─── Fetch Garaje Detail ───
  async function cargarDetalle() {
    const id = getGarajeId();

    if (!id) {
      showError();
      return;
    }

    try {
      const endpoint = PREVIEW_MODE
        ? `/api/garajes/${id}/preview?usuario_id=${currentUser.id}`
        : `/api/explorar/${id}`;
      const response = await fetch(endpoint);
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
      if (!PREVIEW_MODE) {
        await verificarReservaExistente();
      }

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

  // ─── Precio en vivo en el wizard (Step 2) ───
  function calcularPrecioEnWizard() {
    const fe = document.getElementById('fechaEntrada');
    const fs = document.getElementById('fechaSalida');
    const liveEl = document.getElementById('reservaPrecioLive');
    const textoH = document.getElementById('textoHoras');
    const textoT = document.getElementById('textoTotal');
    const alertEl = document.getElementById('reservaAlert');
    if (!fe || !fs || !garajeCargado) return;
    if (alertEl) {
      alertEl.classList.add('hidden');
      alertEl.classList.remove('ok', 'warn');
    }
    if (!fe.value || !fs.value) {
      if (liveEl) liveEl.classList.add('hidden');
      actualizarEstadoBotonReservaHorario();
      return;
    }
    const start = new Date(fe.value), end = new Date(fs.value);
    const validacion = validarHorarioSeleccionado(start, end);
    if (!validacion.ok) {
      if (liveEl) liveEl.classList.add('hidden');
      if (alertEl) {
        alertEl.textContent = validacion.message;
        alertEl.classList.remove('hidden');
        alertEl.classList.add('warn');
      }
      actualizarEstadoBotonReservaHorario();
      return;
    }
    const difHoras = Math.ceil((end - start) / (1000 * 60 * 60));
    const total = difHoras * parseFloat(garajeCargado.precio_hora);
    if (textoH) textoH.textContent = `${difHoras} hora${difHoras > 1 ? 's' : ''} × Bs. ${parseFloat(garajeCargado.precio_hora).toFixed(2)}`;
    if (textoT) textoT.textContent = `Bs. ${total.toFixed(2)}`;
    if (liveEl) liveEl.classList.remove('hidden');
    if (alertEl) {
      alertEl.textContent = 'Horario disponible para reservar.';
      alertEl.classList.remove('hidden');
      alertEl.classList.add('ok');
    }
    actualizarEstadoBotonReservaHorario();
  }

  document.addEventListener('change', e => {
    if (e.target.id === 'fechaEntrada' || e.target.id === 'fechaSalida') calcularPrecioEnWizard();
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'fechaEntrada' || e.target.id === 'fechaSalida') calcularPrecioEnWizard();
  });

  // ─── Verificar si ya tiene reserva ───
  async function verificarReservaExistente() {
    if (!garajeCargado || PREVIEW_MODE) return;
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
    const ctaCard = document.getElementById('bookingCtaCard');
    const existCard = document.getElementById('reservaExistenteCard');
    if (ctaCard) ctaCard.style.display = 'none';
    if (existCard) {
      existCard.classList.remove('hidden');
      existCard.innerHTML = `
        <div class="text-center p-2">
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

  // ─── Wizard event bindings (after DOM is ready) ───
  function initWizardBindings() {
    const btnAbrir  = document.getElementById('btnAbrirWizardReserva');
    const btnCerrar = document.getElementById('btnCerrarWizardReserva');
    const btnNext   = document.getElementById('btnReservaNext');
    const btnPrev   = document.getElementById('btnReservaPrev');
    const btnConfirm = document.getElementById('btnConfirmarReserva');
    const checkAcepto = document.getElementById('checkAcepto');
    const overlay   = document.getElementById('reservaWizardOverlay');

    if (btnAbrir)  btnAbrir.addEventListener('click', window.openReservaWizard);
    if (btnCerrar) btnCerrar.addEventListener('click', window.closeReservaWizard);
    if (btnNext)   btnNext.addEventListener('click', reservaWizardNext);
    if (btnPrev)   btnPrev.addEventListener('click', reservaWizardPrev);

    document.querySelectorAll('.reserva-duration-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const fe = document.getElementById('fechaEntrada');
        const minutos = Number(btn.dataset.durationMin || 60);
        if (!fe?.value) return;
        const start = new Date(fe.value);
        const end = new Date(start.getTime() + minutos * 60 * 1000);
        if (window._fpSalida) window._fpSalida.setDate(end, true);
        else {
          const fs = document.getElementById('fechaSalida');
          if (fs) fs.value = end.toISOString().slice(0, 16);
        }
        calcularPrecioEnWizard();
      });
    });

    // Close on overlay click
    if (overlay) {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) window.closeReservaWizard();
      });
    }

    // Coupon apply button
    const btnCupon = document.getElementById('btnAplicarCupon');
    if (btnCupon) {
      btnCupon.addEventListener('click', handleCuponApply);
    }
    const inputCupon = document.getElementById('inputCupon');
    if (inputCupon) {
      inputCupon.addEventListener('keydown', e => { if (e.key === 'Enter') handleCuponApply(); });
    }

    // Checkbox enables confirm button
    if (checkAcepto && btnConfirm) {
      checkAcepto.addEventListener('change', e => {
        btnConfirm.disabled = !e.target.checked;
      });
    }

    // Confirm button → API call
    if (btnConfirm) {
      btnConfirm.addEventListener('click', async () => {
        const fe = document.getElementById('fechaEntrada');
        const fs = document.getElementById('fechaSalida');
        if (!garajeCargado || !fe?.value || !fs?.value || !espacioSeleccionadoId) return;
        const validacionHorario = validarHorarioSeleccionado(new Date(fe.value), new Date(fs.value));
        if (!validacionHorario.ok) {
          showToast(validacionHorario.message, 'error');
          calcularPrecioEnWizard();
          return;
        }
        const originalHTML = btnConfirm.innerHTML;
        btnConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Confirmando...';
        btnConfirm.disabled = true;
        try {
          const response = await fetch('/api/reservas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              espacio_id: espacioSeleccionadoId,
              conductor_id: currentUser.id,
              fecha_inicio: fe.value,
              fecha_fin: fs.value,
              cupon_codigo: cuponAplicado?.codigo || null
            })
          });
          const json = await response.json();
          if (response.ok && json.status === 'ok') {
            window.closeReservaWizard();
            mostrarUIReservaExistente();
            showToast('¡Reserva solicitada! El anfitrión será notificado.');
          } else {
            showToast(json.message || 'No se pudo procesar la reserva.', 'error');
            btnConfirm.innerHTML = originalHTML;
            btnConfirm.disabled = false;
          }
        } catch (err) {
          console.error(err);
          showToast('Error de red. Verifica tu conexión.', 'error');
          btnConfirm.innerHTML = originalHTML;
          btnConfirm.disabled = false;
        }
      });
    }
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
  initWizardBindings();
  cargarDetalle();

})();
