// ============================================================
// EstAirbnb — mis-favoritos.js
// Lógica para la página de Favoritos del Conductor
// Incluye wizard de reserva directo (sin pasar por detalle-garaje)
// ============================================================

(function () {
  'use strict';

  // ─── Session Check ───
  const USUARIO_KEY = 'estairbnb_user';
  const currentUser = JSON.parse(localStorage.getItem(USUARIO_KEY) || 'null');

  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  if (currentUser.rol_id === 1) {
    window.location.href = '/mis-garajes.html';
    return;
  }

  // ─── DOM ───
  const loadingFavs = document.getElementById('loadingFavs');
  const emptyFavs   = document.getElementById('emptyFavs');
  const favsGrid    = document.getElementById('favsGrid');
  const favCounter  = document.getElementById('favCounter');
  const favTotal    = document.getElementById('favTotal');

  // ─── Toast helper ───
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

  // ─── Vehicle Labels ───
  const TIPO_LABELS = {
    auto: '🚗 Auto',
    moto: '🏍️ Moto',
    camioneta: '🚙 Camioneta'
  };

  // ============================================================
  // WIZARD DE RESERVA DIRECTO
  // ============================================================

  let _wizardGaraje    = null;
  let _wizardEspacioId  = null;
  let _wizardEspacioNum = null;
  let _wizardCupon     = null;
  let _wizardStep      = 1;
  const WIZARD_STEPS   = 3;

  // ─── Abrir wizard cargando datos del garaje ───
  async function abrirWizardFavorito(garajeId, direccion) {
    // Verificar si ya hay una reserva activa en este garaje
    try {
      const chk = await fetch(`/api/reservas/check-garaje?conductor_id=${currentUser.id}&garaje_id=${garajeId}`);
      const chkJson = await chk.json();
      if (chkJson.status === 'ok' && chkJson.tiene_reserva) {
        showToast('Ya tienes una reserva activa o pendiente en este parqueo.', 'error');
        return;
      }
    } catch (_) { /* si falla el check, dejar abrir el wizard igual */ }

    _wizardGaraje    = null;
    _wizardEspacioId  = null;
    _wizardEspacioNum = null;
    _wizardCupon     = null;

    // Reset mapa
    const mapaEl = document.getElementById('mapa-parqueo');
    if (mapaEl) mapaEl.innerHTML = '<div style="text-align:center;padding:32px;color:#64748b;"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;"></i><br><small style="display:block;margin-top:8px;">Cargando mapa de espacios...</small></div>';

    const espInfoEl = document.getElementById('espacioSeleccionadoInfo');
    if (espInfoEl) espInfoEl.classList.add('hidden');

    // Reset cupón
    const ic = document.getElementById('inputCupon');
    const fb = document.getElementById('cuponFeedback');
    const rd = document.getElementById('rowDescuento');
    if (ic) ic.value = '';
    if (fb) { fb.style.display = 'none'; fb.textContent = ''; }
    if (rd) rd.style.display = 'none';

    // Reset flatpickr a fechas por defecto
    if (window._fpEntrada || window._fpSalida) {
      const now = new Date();
      now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
      const defaultEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      if (window._fpEntrada) window._fpEntrada.setDate(now, true);
      if (window._fpSalida)  window._fpSalida.setDate(defaultEnd, true);
    }

    // Reset precio live
    const liveEl = document.getElementById('reservaPrecioLive');
    if (liveEl) liveEl.classList.add('hidden');
    const alertEl = document.getElementById('reservaAlert');
    if (alertEl) alertEl.classList.add('hidden');

    // Reset checkbox
    const checkAcepto = document.getElementById('checkAcepto');
    const btnConfirm  = document.getElementById('btnConfirmarReserva');
    if (checkAcepto) checkAcepto.checked = false;
    if (btnConfirm)  btnConfirm.disabled = true;

    // Título del wizard
    const titleEl = document.getElementById('wizardGarajeTitulo');
    if (titleEl) titleEl.textContent = `📍 ${direccion || 'Reservar espacio'}`;

    // Abrir overlay en paso 1
    wizardGoTo(1);
    const overlay = document.getElementById('reservaWizardOverlay');
    if (overlay) {
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    // Cargar datos del garaje y espacios en paralelo
    try {
      const [garajeRes, espaciosRes] = await Promise.all([
        fetch(`/api/explorar/${garajeId}`),
        fetch(`/api/garajes/${garajeId}/espacios`)
      ]);

      const garajeJson   = await garajeRes.json();
      const espaciosJson = await espaciosRes.json();

      if (garajeJson.status === 'ok') {
        _wizardGaraje = garajeJson.data;
      }

      if (espaciosJson.status === 'ok' && espaciosJson.data) {
        renderMapaFavorito(espaciosJson.data, _wizardGaraje?.layout_mapa || null);
      } else {
        if (mapaEl) mapaEl.innerHTML = '<p style="color:#dc2626;font-size:.85rem;padding:12px;">No se pudieron cargar los espacios.</p>';
      }
    } catch (err) {
      console.error('Error al cargar garaje para wizard:', err);
      if (mapaEl) mapaEl.innerHTML = '<p style="color:#dc2626;font-size:.85rem;padding:12px;">Error de conexión al cargar el garaje.</p>';
    }
  }

  function cerrarWizardFavorito() {
    const overlay = document.getElementById('reservaWizardOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
  }

  // ─── Navegación entre pasos ───
  function wizardGoTo(step) {
    _wizardStep = step;
    document.querySelectorAll('.reserva-panel').forEach(p => {
      p.classList.toggle('active', parseInt(p.dataset.step) === step);
    });
    document.querySelectorAll('.reserva-step-item').forEach(item => {
      const s = parseInt(item.dataset.step);
      item.classList.remove('active', 'completed');
      if (s === step)    item.classList.add('active');
      else if (s < step) item.classList.add('completed');
    });
    const counter   = document.getElementById('reservaStepCounter');
    const btnPrev   = document.getElementById('btnReservaPrev');
    const btnNext   = document.getElementById('btnReservaNext');
    const btnConfirm = document.getElementById('btnConfirmarReserva');
    if (counter)   counter.textContent   = `Paso ${step} de ${WIZARD_STEPS}`;
    if (btnPrev)   btnPrev.style.display   = step === 1 ? 'none' : '';
    if (btnNext)   btnNext.style.display   = step === WIZARD_STEPS ? 'none' : '';
    if (btnConfirm) btnConfirm.style.display = step === WIZARD_STEPS ? '' : 'none';
    const body = document.querySelector('.reserva-wizard-body');
    if (body) body.scrollTop = 0;
  }

  function validateWizardStep(step) {
    if (step === 1) {
      if (!_wizardEspacioId) {
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
    }
    return true;
  }

  // ─── Resumen paso 3 ───
  function buildWizardSummary() {
    const fe = document.getElementById('fechaEntrada');
    const fs = document.getElementById('fechaSalida');
    if (!fe?.value || !fs?.value || !_wizardGaraje) return;

    const start    = new Date(fe.value);
    const end      = new Date(fs.value);
    const difHoras = Math.ceil((end - start) / (1000 * 60 * 60));
    const subtotal = difHoras * parseFloat(_wizardGaraje.precio_hora);
    const tarifa   = subtotal * 0.10;
    let descuento  = 0;
    if (_wizardCupon) descuento = subtotal * (_wizardCupon.descuento_porcentaje / 100);
    const total = subtotal + tarifa - descuento;

    const fmt   = dt => dt.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setEl('sumEspacio',  `Espacio ${_wizardEspacioNum || '--'}`);
    setEl('sumEntrada',  fmt(start));
    setEl('sumSalida',   fmt(end));
    setEl('sumHoras',    difHoras);
    setEl('sumSubtotal', `Bs. ${subtotal.toFixed(2)}`);
    setEl('sumTarifa',   `Bs. ${tarifa.toFixed(2)}`);
    setEl('sumTotal',    `Bs. ${total.toFixed(2)}`);

    const rowDescuento = document.getElementById('rowDescuento');
    if (_wizardCupon && rowDescuento) {
      setEl('sumDescuentoLabel', `Descuento (${_wizardCupon.codigo} −${_wizardCupon.descuento_porcentaje}%)`);
      setEl('sumDescuento', `-Bs. ${descuento.toFixed(2)}`);
      rowDescuento.style.display = '';
    } else if (rowDescuento) {
      rowDescuento.style.display = 'none';
    }

    const checkAcepto = document.getElementById('checkAcepto');
    const btnConfirm  = document.getElementById('btnConfirmarReserva');
    if (checkAcepto) checkAcepto.checked = false;
    if (btnConfirm)  btnConfirm.disabled = true;
  }

  // ─── Cupón ───
  async function handleWizardCupon() {
    const input = document.getElementById('inputCupon');
    const fb    = document.getElementById('cuponFeedback');
    const btn   = document.getElementById('btnAplicarCupon');
    if (!input || !fb) return;

    const codigo = input.value.trim().toUpperCase();
    if (!codigo) {
      _wizardCupon = null;
      fb.style.display = 'none';
      buildWizardSummary();
      return;
    }
    if (btn) { btn.style.opacity = '0.6'; btn.disabled = true; }

    try {
      const res  = await fetch(`/api/cupones/${encodeURIComponent(codigo)}`);
      const json = await res.json();
      if (res.ok && json.status === 'ok') {
        _wizardCupon = json.data;
        fb.style.cssText = 'display:block;margin-top:6px;font-size:.8rem;font-weight:600;padding:6px 10px;border-radius:8px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;';
        let ahorroStr = '';
        const feEl = document.getElementById('fechaEntrada');
        const fsEl = document.getElementById('fechaSalida');
        if (feEl?.value && fsEl?.value && _wizardGaraje) {
          const difH  = Math.ceil((new Date(fsEl.value) - new Date(feEl.value)) / (1000 * 60 * 60));
          const base  = difH * parseFloat(_wizardGaraje.precio_hora);
          const ahorro = base * (_wizardCupon.descuento_porcentaje / 100);
          ahorroStr = ` — Ahorras Bs. ${ahorro.toFixed(2)}`;
        }
        fb.textContent = `✓ Cupón aplicado: ${_wizardCupon.descuento_porcentaje}% de descuento${ahorroStr}`;
      } else {
        _wizardCupon = null;
        fb.style.cssText = 'display:block;margin-top:6px;font-size:.8rem;font-weight:600;padding:6px 10px;border-radius:8px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;';
        fb.textContent = json.message || 'Cupón inválido o expirado.';
      }
    } catch {
      _wizardCupon = null;
      fb.style.cssText = 'display:block;margin-top:6px;font-size:.8rem;font-weight:600;padding:6px 10px;border-radius:8px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;';
      fb.textContent = 'Error al verificar el cupón.';
    } finally {
      if (btn) { btn.style.opacity = ''; btn.disabled = false; }
    }
    buildWizardSummary();
  }

  // ─── Precio en vivo paso 2 ───
  function calcularPrecioWizard() {
    const fe     = document.getElementById('fechaEntrada');
    const fs     = document.getElementById('fechaSalida');
    const liveEl = document.getElementById('reservaPrecioLive');
    const textoH = document.getElementById('textoHoras');
    const textoT = document.getElementById('textoTotal');
    const alertEl = document.getElementById('reservaAlert');
    if (!fe || !fs || !_wizardGaraje) return;
    if (alertEl) alertEl.classList.add('hidden');
    if (!fe.value || !fs.value) { if (liveEl) liveEl.classList.add('hidden'); return; }
    const start = new Date(fe.value), end = new Date(fs.value);
    if (end <= start) {
      if (liveEl) liveEl.classList.add('hidden');
      if (alertEl) { alertEl.textContent = 'La salida debe ser posterior a la llegada.'; alertEl.classList.remove('hidden'); }
      return;
    }
    const difHoras = Math.ceil((end - start) / (1000 * 60 * 60));
    const total    = difHoras * parseFloat(_wizardGaraje.precio_hora);
    if (textoH) textoH.textContent = `${difHoras} hora${difHoras > 1 ? 's' : ''} × Bs. ${parseFloat(_wizardGaraje.precio_hora).toFixed(2)}`;
    if (textoT) textoT.textContent = `Bs. ${total.toFixed(2)}`;
    if (liveEl) liveEl.classList.remove('hidden');
  }

  // ─── Selección de espacio ───
  function seleccionarEspacioFavorito(cellEl, espacio) {
    const mapaEl = document.getElementById('mapa-parqueo');
    if (mapaEl) {
      mapaEl.querySelectorAll('[data-selected="true"]').forEach(el => {
        el.dataset.selected = 'false';
        el.style.filter = '';
        el.style.transform = '';
        el.style.zIndex = '';
      });
      mapaEl.querySelectorAll('.espacio-btn.seleccionado').forEach(el => el.classList.remove('seleccionado'));
    }
    if (cellEl.classList.contains('espacio-btn')) cellEl.classList.add('seleccionado');
    else { cellEl.dataset.selected = 'true'; cellEl.style.filter = 'brightness(1.3)'; cellEl.style.transform = 'scale(1.08)'; cellEl.style.zIndex = '4'; }

    _wizardEspacioId  = espacio.id;
    _wizardEspacioNum = espacio.numero_espacio;

    const infoEl  = document.getElementById('espacioSeleccionadoInfo');
    const labelEl = document.getElementById('espacioSeleccionadoLabel');
    if (labelEl) labelEl.textContent = espacio.numero_espacio;
    if (infoEl)  infoEl.classList.remove('hidden');
  }

  // ─── Renderizado del mapa ───
  function renderMapaFavorito(espacios, layoutMapa) {
    const mapaEl = document.getElementById('mapa-parqueo');
    if (!mapaEl) return;
    mapaEl.innerHTML = '';
    _wizardEspacioId  = null;
    _wizardEspacioNum = null;
    const infoEl = document.getElementById('espacioSeleccionadoInfo');
    if (infoEl) infoEl.classList.add('hidden');

    if (layoutMapa) {
      try {
        const matriz = JSON.parse(layoutMapa);
        if (!Array.isArray(matriz) || matriz.length === 0) throw new Error('invalid');
        renderTilemapFavorito(matriz, espacios, mapaEl);
        return;
      } catch (e) { /* fall through to legacy */ }
    }

    // Legacy grid
    const maxCol = Math.max(...espacios.map(e => e.columna || 1), 1);
    const cols   = Math.min(maxCol, 5);
    mapaEl.className = 'mapa-grid';
    mapaEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    espacios.forEach(esp => {
      const slot = document.createElement('div');
      slot.className = `espacio-btn${esp.estado === 'ocupado' ? ' ocupado' : ''}`;
      slot.dataset.id     = esp.id;
      slot.dataset.numero = esp.numero_espacio;
      slot.dataset.estado = esp.estado;
      const iconMap = { auto: 'fa-car', moto: 'fa-motorcycle', camioneta: 'fa-truck-pickup', techado: 'fa-warehouse' };
      slot.innerHTML = `<i class="fa-solid ${iconMap[esp.tipo_vehiculo] || 'fa-car'}" style="font-size:1.1rem;margin-bottom:2px;"></i><div>${esp.numero_espacio}</div>`;
      if (esp.estado === 'libre') slot.addEventListener('click', () => seleccionarEspacioFavorito(slot, esp));
      mapaEl.appendChild(slot);
    });
  }

  function renderTilemapFavorito(matriz, espacios, mapaEl) {
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
      document.head.appendChild(style);
    }

    const espacioMap = {};
    espacios.forEach(e => { espacioMap[`${e.fila}-${e.columna}`] = e; });
    const filas = matriz.length;
    const cols  = filas > 0 ? matriz[0].length : 0;

    mapaEl.style.cssText = 'background:#16213e;padding:12px;border-radius:12px;border:1px solid #4b5563;overflow-x:auto;-webkit-overflow-scrolling:touch;';
    mapaEl.innerHTML = '';

    const grid = document.createElement('div');
    grid.style.cssText = `display:inline-grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:2px;min-width:100%;`;

    const vCfg = {
      auto:      { icon: 'directions_car',   color: '#3b82f6', sz: '15px' },
      moto:      { icon: 'two_wheeler',      color: '#f59e0b', sz: '13px' },
      camioneta: { icon: 'local_shipping',   color: '#8b5cf6', sz: '15px' },
      techado:   { icon: 'garage',           color: '#10b981', sz: '15px' }
    };

    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        const cd   = matriz[f][c] || { tile: 'empty', tipo_vehiculo: 'auto' };
        const tile = cd.tile || 'empty';
        const key  = `${f + 1}-${c + 1}`;
        const esp  = espacioMap[key];
        const cell = document.createElement('div');
        cell.className = 'gc';
        cell.setAttribute('data-t', tile);

        if (tile === 'parking' && esp) {
          const libre        = esp.estado === 'libre';
          const mantenimiento = esp.estado === 'mantenimiento';
          const v = vCfg[esp.tipo_vehiculo] || vCfg.auto;

          if (mantenimiento) {
            cell.style.background   = '#422006';
            cell.style.borderLeft   = '3px solid #f59e0b';
            cell.style.borderRight  = '3px solid #f59e0b';
            cell.style.borderTop    = '1px solid rgba(245,158,11,0.25)';
            cell.style.borderBottom = '1px solid rgba(245,158,11,0.25)';
          } else if (!libre) {
            cell.style.background   = '#450a0a';
            cell.style.borderLeft   = '3px solid #ef4444';
            cell.style.borderRight  = '3px solid #ef4444';
            cell.style.borderTop    = '1px solid rgba(239,68,68,0.25)';
            cell.style.borderBottom = '1px solid rgba(239,68,68,0.25)';
          }
          cell.style.cursor = libre ? 'pointer' : 'not-allowed';

          const top = document.createElement('div');
          top.className  = 'gc-ico';
          top.style.cssText = `color:${libre ? v.color : (mantenimiento ? '#fbbf24' : '#f87171')};display:flex;align-items:center;justify-content:center`;
          top.innerHTML  = `<span class="material-symbols-outlined" style="font-size:${v.sz};">${v.icon}</span>`;

          const num = document.createElement('div');
          num.className  = 'gc-num';
          num.style.color     = libre ? 'rgba(255,255,255,0.9)' : (mantenimiento ? '#fde68a' : '#fca5a5');
          num.style.fontSize  = mantenimiento ? '8px' : '10px';
          num.textContent     = mantenimiento ? 'MANT' : esp.numero_espacio;

          cell.appendChild(top);
          cell.appendChild(num);
          cell.title = `${esp.numero_espacio} — ${libre ? 'Libre' : (mantenimiento ? 'En Mantenimiento' : 'Ocupado')}`;

          if (libre) {
            cell.addEventListener('mouseenter', () => { if (cell.dataset.selected !== 'true') { cell.style.filter = 'brightness(1.18)'; cell.style.transform = 'scale(1.06)'; cell.style.zIndex = '3'; } });
            cell.addEventListener('mouseleave', () => { if (cell.dataset.selected !== 'true') { cell.style.filter = ''; cell.style.transform = ''; cell.style.zIndex = ''; } });
            cell.addEventListener('click', () => seleccionarEspacioFavorito(cell, esp));
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
          if (cd.adir === 'cross')    inner.innerHTML = '<div class="gc-aisle-cross"></div>';
          else if (cd.adir === 'v')   inner.innerHTML = '<div class="gc-aisle-v"></div>';
          else                        inner.innerHTML = '<div class="gc-aisle-h"></div>';
          cell.appendChild(inner);
        }
        grid.appendChild(cell);
      }
    }
    mapaEl.appendChild(grid);

    const leg = document.createElement('div');
    leg.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;padding:8px 12px;background:#1e293b;border-radius:8px;border:1px solid #334155;';
    leg.innerHTML = `
      <span style="display:flex;align-items:center;gap:4px;font-size:.68rem;color:#94a3b8;font-weight:600;"><span style="width:12px;height:8px;border-radius:2px;background:#14532d;border-left:3px solid #22c55e;border-right:3px solid #22c55e;display:inline-block;"></span>Libre</span>
      <span style="display:flex;align-items:center;gap:4px;font-size:.68rem;color:#94a3b8;font-weight:600;"><span style="width:12px;height:8px;border-radius:2px;background:#450a0a;border-left:3px solid #ef4444;border-right:3px solid #ef4444;display:inline-block;"></span>Ocupado</span>
      <span style="display:flex;align-items:center;gap:4px;font-size:.68rem;color:#94a3b8;font-weight:600;"><span style="width:12px;height:8px;border-radius:2px;background:#422006;border-left:3px solid #f59e0b;border-right:3px solid #f59e0b;display:inline-block;"></span>Mantenimiento</span>
    `;
    mapaEl.appendChild(leg);
  }

  // ─── Bind todos los eventos del wizard ───
  function initWizardFavorito() {
    const overlay   = document.getElementById('reservaWizardOverlay');
    const btnCerrar = document.getElementById('btnCerrarWizardReserva');
    const btnNext   = document.getElementById('btnReservaNext');
    const btnPrev   = document.getElementById('btnReservaPrev');
    const btnConfirm = document.getElementById('btnConfirmarReserva');
    const checkAcepto = document.getElementById('checkAcepto');
    const btnCupon  = document.getElementById('btnAplicarCupon');
    const inputCupon = document.getElementById('inputCupon');

    if (btnCerrar) btnCerrar.addEventListener('click', cerrarWizardFavorito);
    if (overlay)   overlay.addEventListener('click', e => { if (e.target === overlay) cerrarWizardFavorito(); });

    if (btnNext) btnNext.addEventListener('click', () => {
      if (!validateWizardStep(_wizardStep)) return;
      if (_wizardStep < WIZARD_STEPS) {
        if (_wizardStep === 2) buildWizardSummary();
        wizardGoTo(_wizardStep + 1);
      }
    });

    if (btnPrev) btnPrev.addEventListener('click', () => {
      if (_wizardStep > 1) wizardGoTo(_wizardStep - 1);
    });

    if (checkAcepto && btnConfirm) {
      checkAcepto.addEventListener('change', e => { btnConfirm.disabled = !e.target.checked; });
    }

    document.addEventListener('change', e => {
      if (e.target.id === 'fechaEntrada' || e.target.id === 'fechaSalida') calcularPrecioWizard();
    });

    if (btnCupon)   btnCupon.addEventListener('click', handleWizardCupon);
    if (inputCupon) inputCupon.addEventListener('keydown', e => { if (e.key === 'Enter') handleWizardCupon(); });

    if (btnConfirm) {
      btnConfirm.addEventListener('click', async () => {
        const fe = document.getElementById('fechaEntrada');
        const fs = document.getElementById('fechaSalida');
        if (!_wizardGaraje || !fe?.value || !fs?.value || !_wizardEspacioId) return;

        const originalHTML   = btnConfirm.innerHTML;
        btnConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Confirmando...';
        btnConfirm.disabled  = true;

        try {
          const response = await fetch('/api/reservas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              espacio_id:   _wizardEspacioId,
              conductor_id: currentUser.id,
              fecha_inicio: fe.value,
              fecha_fin:    fs.value,
              cupon_codigo: _wizardCupon?.codigo || null
            })
          });
          const json = await response.json();

          if (response.ok && json.status === 'ok') {
            cerrarWizardFavorito();
            showToast('¡Reserva solicitada! El anfitrión te responderá pronto.');
          } else {
            showToast(json.message || 'No se pudo procesar la reserva.', 'error');
            btnConfirm.innerHTML = originalHTML;
            btnConfirm.disabled  = false;
          }
        } catch (err) {
          console.error(err);
          showToast('Error de red. Verifica tu conexión.', 'error');
          btnConfirm.innerHTML = originalHTML;
          btnConfirm.disabled  = false;
        }
      });
    }
  }

  // ============================================================
  // FAVORITOS
  // ============================================================

  async function cargarFavoritos() {
    loadingFavs.style.display = 'flex';
    emptyFavs.style.display   = 'none';
    favsGrid.innerHTML        = '';
    favCounter.style.display  = 'none';

    try {
      const resp = await fetch(`/api/favoritos?conductor_id=${currentUser.id}`);
      const json = await resp.json();

      loadingFavs.style.display = 'none';

      if (json.status !== 'ok' || !json.data || json.data.length === 0) {
        emptyFavs.style.display = 'flex';
        return;
      }

      const favoritos = json.data;
      favTotal.textContent    = favoritos.length;
      favCounter.style.display = 'inline-flex';

      favoritos.forEach((fav, index) => {
        const card = crearTarjetaFavorito(fav, index);
        favsGrid.appendChild(card);
      });

    } catch (err) {
      console.error('Error al cargar favoritos:', err);
      loadingFavs.style.display = 'none';
      emptyFavs.style.display   = 'flex';
    }
  }

  function crearTarjetaFavorito(fav, index) {
    const card = document.createElement('div');
    card.className        = 'fav-card';
    card.dataset.garajeId = fav.garaje_id;
    card.style.animationDelay = `${0.05 * (index % 6)}s`;

    let imagenHTML;
    if (fav.foto_portada) {
      imagenHTML = `<img src="${fav.foto_portada}" alt="Foto de ${fav.direccion}" loading="lazy">`;
    } else {
      imagenHTML = `<div class="fav-card-placeholder"><i class="fa-solid fa-image"></i><span>Sin foto</span></div>`;
    }

    const tipoLabel = TIPO_LABELS[fav.tipo_vehiculo] || fav.tipo_vehiculo;
    const precio    = parseFloat(fav.precio_hora).toFixed(2);
    const hostName  = [fav.anfitrion_nombre, fav.anfitrion_apellidos].filter(Boolean).join(' ') || 'Anfitrión';
    const isInactive = !fav.estado_activo;

    const fechaAgg = fav.fecha_agregado ? new Date(fav.fecha_agregado).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'short', year: 'numeric'
    }) : '';

    card.innerHTML = `
      <div class="fav-card-img-wrap">
        ${imagenHTML}
        <span class="fav-card-tag">
          <i class="fa-solid fa-car"></i> ${tipoLabel}
        </span>
        ${isInactive ? '<span class="fav-card-inactive">No disponible</span>' : ''}
        <button class="fav-card-remove" data-garaje-id="${fav.garaje_id}" title="Quitar de favoritos">
          <i class="fa-solid fa-heart-crack"></i>
        </button>
      </div>
      <div class="fav-card-body">
        <div class="fav-card-direccion">${fav.direccion}</div>
        <div class="fav-card-host">
          <i class="fa-solid fa-user-circle"></i> ${hostName}
          ${fechaAgg ? `<span style="margin-left:auto;font-size:0.68rem;color:#a0a0a0;">Guardado ${fechaAgg}</span>` : ''}
        </div>
        <div class="fav-card-badges">
          <span><i class="fa-solid fa-shield-halved"></i> ${fav.nivel_seguridad || 'Estándar'}</span>
          <span><i class="fa-solid fa-key"></i> ${fav.metodo_acceso || 'Manual'}</span>
        </div>
        <div class="fav-card-footer">
          <span class="fav-card-precio">
            Bs. ${precio} <small>/ hora</small>
          </span>
          ${isInactive
            ? '<span style="color:#ba1a1a;font-size:0.78rem;font-weight:600;">Inactivo</span>'
            : `<button class="fav-card-action" data-reservar="true">
                Reservar <i class="fa-solid fa-bolt"></i>
               </button>`
          }
        </div>
      </div>
    `;

    // Quitar de favoritos
    card.querySelector('.fav-card-remove').addEventListener('click', e => {
      e.stopPropagation();
      handleRemoveFavorite(fav.garaje_id, card);
    });

    // Abrir wizard de reserva directamente
    const btnReservar = card.querySelector('[data-reservar="true"]');
    if (btnReservar) {
      btnReservar.addEventListener('click', () => abrirWizardFavorito(fav.garaje_id, fav.direccion));
    }

    return card;
  }

  async function handleRemoveFavorite(garajeId, cardEl) {
    cardEl.classList.add('removing');
    try {
      const resp = await fetch('/api/favoritos/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conductor_id: currentUser.id, garaje_id: garajeId })
      });
      const json = await resp.json();

      if (json.status === 'ok' && !json.favorito) {
        setTimeout(() => {
          cardEl.remove();
          const remaining = favsGrid.querySelectorAll('.fav-card').length;
          if (remaining === 0) {
            favCounter.style.display = 'none';
            emptyFavs.style.display  = 'flex';
          } else {
            favTotal.textContent = remaining;
          }
        }, 350);
      }
    } catch (err) {
      console.error('Error al quitar favorito:', err);
      cardEl.classList.remove('removing');
    }
  }

  // ─── Init ───
  initWizardFavorito();
  cargarFavoritos();

})();
