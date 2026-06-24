(function () {
  'use strict';

  const USUARIO_KEY = 'estairbnb_user';
  const currentUser = JSON.parse(localStorage.getItem(USUARIO_KEY) || 'null');
  if (!currentUser) { window.location.href = '/login.html'; return; }
  const isHost = currentUser.rol_id === 1;

  // ─── Helpers ───
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  const fmtFecha = (d) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

  // ─── Theme ───
  const saved = localStorage.getItem('estairbnb_theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
    const ti = document.getElementById('themeIcon');
    if (ti) ti.textContent = 'light_mode';
  }
  const btnTheme = document.getElementById('btnThemeToggle');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      document.documentElement.classList.toggle('dark', !isDark);
      const ti = document.getElementById('themeIcon');
      if (ti) ti.textContent = isDark ? 'dark_mode' : 'light_mode';
      localStorage.setItem('estairbnb_theme', isDark ? 'light' : 'dark');
    });
  }

  // ─── Logout ───
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', () => {
    localStorage.removeItem(USUARIO_KEY);
    window.location.href = '/login.html';
  });

  // ─── Avatar ───
  const navInitials = document.getElementById('navInitials');
  if (navInitials && currentUser.nombre) {
    navInitials.textContent = (currentUser.nombre[0] + (currentUser.apellidos?.[0] || '')).toUpperCase();
  }
  const navUserName = document.getElementById('navUserName');
  if (navUserName && currentUser.nombre) navUserName.textContent = currentUser.nombre;

  // ─── Toast ───
  function showToast(msg, type = 'success') {
    const el = document.getElementById('_appToast');
    if (!el) return;
    el.style.background = type === 'error' ? '#dc2626' : '#006a62';
    el.innerHTML = `<span>${escapeHTML(msg)}</span>`;
    clearTimeout(el._t);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = 'translateX(0)'; }));
    el._t = setTimeout(() => { el.style.transform = 'translateX(calc(100% + 32px))'; }, 2800);
  }

  function setFeedback(el, msg, ok) {
    el.style.display = 'block';
    el.style.background = ok ? '#f0fdf4' : '#fef2f2';
    el.style.color      = ok ? '#166534' : '#dc2626';
    el.style.border     = `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`;
    el.textContent      = msg;
  }

  // ============================================================
  // ANFITRIÓN — Crear cupón (% o monto fijo)
  // ============================================================
  let tipoCupon = 'porcentaje';
  window.setTipoCupon = function (t) {
    tipoCupon = t === 'monto_fijo' ? 'monto_fijo' : 'porcentaje';
    document.querySelectorAll('#adminTipoSeg .cseg-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tipo === tipoCupon));
    const cp = document.getElementById('campoPorcentaje');
    const cm = document.getElementById('campoMonto');
    if (cp) cp.style.display = tipoCupon === 'porcentaje' ? '' : 'none';
    if (cm) cm.style.display = tipoCupon === 'monto_fijo' ? '' : 'none';
  };

  window.crearCupon = async function () {
    const codigo       = document.getElementById('adminCodigo').value.trim().toUpperCase();
    const descuento    = parseInt(document.getElementById('adminDescuento').value, 10);
    const monto        = parseFloat(document.getElementById('adminMonto')?.value);
    const fecha_fin    = document.getElementById('adminFechaFin').value;
    const usos_maximos = document.getElementById('adminMaxUsos').value;
    const descripcion  = document.getElementById('adminDescripcion').value.trim();
    const soloPrimera  = document.getElementById('adminSoloPrimera')?.checked || false;
    const feedback     = document.getElementById('createFeedback');
    const btn          = document.getElementById('btnCrearCupon');

    if (!codigo || codigo.length < 3) return setFeedback(feedback, 'El código debe tener al menos 3 caracteres.', false);
    if (tipoCupon === 'porcentaje') {
      if (!descuento || descuento < 1 || descuento > 100) return setFeedback(feedback, 'El descuento debe ser entre 1% y 100%.', false);
    } else {
      if (!monto || monto <= 0) return setFeedback(feedback, 'El monto fijo debe ser mayor a 0.', false);
    }
    if (!fecha_fin) return setFeedback(feedback, 'La fecha de vencimiento es obligatoria.', false);

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creando...';

    try {
      const res = await fetch('/api/cupones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo,
          tipo_descuento: tipoCupon,
          descuento_porcentaje: tipoCupon === 'porcentaje' ? descuento : 0,
          monto_fijo: tipoCupon === 'monto_fijo' ? monto : null,
          fecha_fin,
          usos_maximos: usos_maximos ? parseInt(usos_maximos, 10) : null,
          descripcion: descripcion || null,
          solo_primera_reserva: soloPrimera,
          usuario_id: currentUser.id
        })
      });
      const json = await res.json();

      if (res.ok && json.status === 'ok') {
        setFeedback(feedback, json.message, true);
        document.getElementById('adminCodigo').value      = '';
        document.getElementById('adminDescuento').value   = '';
        if (document.getElementById('adminMonto')) document.getElementById('adminMonto').value = '';
        document.getElementById('adminFechaFin').value    = '';
        document.getElementById('adminMaxUsos').value     = '';
        document.getElementById('adminDescripcion').value = '';
        if (document.getElementById('adminSoloPrimera')) document.getElementById('adminSoloPrimera').checked = false;
        showToast(json.message);
        await cargarMisCupones();
      } else {
        setFeedback(feedback, json.message || 'Error al crear el cupón.', false);
      }
    } catch (err) {
      setFeedback(feedback, 'No se pudo conectar con el servidor.', false);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-ticket"></i> Crear Cupón';
    }
  };

  // ============================================================
  // ANFITRIÓN — Listar / gestionar cupones
  // ============================================================
  const ESTADO_INFO = {
    activo:     { label: 'Activo',     cls: 'activo' },
    inactivo:   { label: 'Inactivo',   cls: 'inactivo' },
    expirado:   { label: 'Vencido',    cls: 'expirado' },
    agotado:    { label: 'Agotado',    cls: 'agotado' },
    programado: { label: 'Programado', cls: 'programado' },
  };

  async function cargarMisCupones() {
    const loading = document.getElementById('loadingCupones');
    const list    = document.getElementById('cuponesAdminList');
    const head    = document.getElementById('cuponesAdminHead');
    const stats   = document.getElementById('cuponStats');
    try {
      const res  = await fetch(`/api/cupones/mis-cupones?usuario_id=${currentUser.id}`);
      const json = await res.json();
      if (loading) loading.style.display = 'none';

      const cupones = (res.ok && json.status === 'ok' && Array.isArray(json.data)) ? json.data : [];

      // KPIs
      renderCuponKpis(cupones);
      if (stats) stats.style.display = 'grid';

      if (head) head.style.display = 'flex';
      const count = document.getElementById('cuponesAdminCount');
      if (count) count.textContent = `${cupones.length} cupón${cupones.length !== 1 ? 'es' : ''}`;

      if (!cupones.length) {
        list.innerHTML = `<div class="cupon-empty">
          <span class="material-symbols-outlined">confirmation_number</span>
          <p>Todavía no has creado cupones. Usa el formulario de abajo para tu primera promoción.</p>
        </div>`;
        list.style.display = 'grid';
        return;
      }

      list.innerHTML = cupones.map(cuponAdminCardHTML).join('');
      list.style.display = 'grid';
    } catch (err) {
      console.error(err);
      if (loading) loading.style.display = 'none';
      if (list) {
        list.innerHTML = '<div class="cupon-empty text-danger">Error al cargar los cupones. Intenta más tarde.</div>';
        list.style.display = 'grid';
      }
    }
  }

  function renderCuponKpis(cupones) {
    const total = cupones.length;
    const activos = cupones.filter(c => c.estado_calculado === 'activo').length;
    const vencidos = cupones.filter(c => c.estado_calculado === 'expirado').length;
    const usos = cupones.reduce((a, c) => a + (Number(c.usos_actuales) || 0), 0);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('ckTotal', total);
    set('ckActivos', activos);
    set('ckVencidos', vencidos);
    set('ckUsos', usos);
  }

  function cuponAdminCardHTML(c) {
    const info = ESTADO_INFO[c.estado_calculado] || ESTADO_INFO.activo;
    const esMonto = c.tipo_descuento === 'monto_fijo';
    const valor = esMonto
      ? `Bs. ${Number(c.monto_fijo || 0).toFixed(2)}`
      : `${c.descuento_porcentaje}%`;

    let uso;
    if (c.usos_maximos !== null && c.usos_maximos !== undefined) {
      const pct = c.usos_maximos > 0 ? Math.min(100, (c.usos_actuales / c.usos_maximos) * 100) : 0;
      uso = `
        <div class="ca-usage">
          <div class="ca-usage-top"><span>Usos</span><span>${c.usos_actuales} / ${c.usos_maximos}</span></div>
          <div class="ca-usage-bar"><div class="ca-usage-fill" style="width:${pct}%"></div></div>
        </div>`;
    } else {
      uso = `<div class="ca-usage-inf"><i class="fa-solid fa-infinity"></i> Usos ilimitados · ${c.usos_actuales} usados</div>`;
    }

    const activo = !!c.activo;
    const desc = c.descripcion ? `<div class="ca-desc">${escapeHTML(c.descripcion)}</div>` : '';
    const tagPrimera = c.solo_primera_reserva ? `<span class="ca-tag"><i class="fa-solid fa-star"></i> Solo 1ª reserva</span>` : '';

    return `
      <div class="cupon-admin estado-${info.cls}">
        <div class="ca-top">
          <div class="ca-code">${escapeHTML(c.codigo)}</div>
          <span class="ca-badge ca-badge--${info.cls}">${info.label}</span>
        </div>
        <div class="ca-value">${valor}<span class="ca-value-lbl">${esMonto ? 'de descuento' : 'de descuento'}</span></div>
        ${desc}
        <div class="ca-meta">
          <span><i class="fa-regular fa-calendar"></i> Vence ${fmtFecha(c.fecha_fin)}</span>
          ${tagPrimera}
        </div>
        ${uso}
        <div class="ca-actions">
          <button class="ca-toggle ${activo ? 'is-on' : 'is-off'}" onclick="toggleCupon(${c.id}, this)">
            <i class="fa-solid ${activo ? 'fa-toggle-on' : 'fa-toggle-off'}"></i>
            ${activo ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>`;
  }

  window.toggleCupon = async function (id, btn) {
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
      const res = await fetch(`/api/cupones/${id}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: currentUser.id })
      });
      const json = await res.json();
      if (res.ok && json.status === 'ok') {
        showToast(json.message || 'Cupón actualizado.');
        await cargarMisCupones();
      } else {
        showToast(json.message || 'Error al actualizar el cupón.', 'error');
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    } catch (err) {
      showToast('No se pudo conectar con el servidor.', 'error');
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  };

  // ============================================================
  // CONDUCTOR — Cupones disponibles (copiar y usar)
  // ============================================================
  window.copiarCodigo = function (btn, codigo) {
    navigator.clipboard.writeText(codigo).then(() => {
      btn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Copiado!';
      btn.classList.add('copied');
      showToast(`Código ${codigo} copiado al portapapeles`);
      setTimeout(() => {
        btn.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar código';
        btn.classList.remove('copied');
      }, 2500);
    }).catch(() => {
      showToast('No se pudo copiar. Hazlo manualmente.', 'error');
    });
  };

  async function cargarCupones() {
    try {
      const res  = await fetch('/api/cupones/disponibles');
      const json = await res.json();
      document.getElementById('loadingCupones').style.display = 'none';

      const grid = document.getElementById('cuponesGrid');
      if (!res.ok || json.status !== 'ok' || json.data.length === 0) {
        grid.innerHTML = '<div class="col-12 text-center py-5 text-secondary">No hay cupones disponibles en este momento.</div>';
        grid.style.display = 'flex';
        return;
      }

      const isDemo = (c) => c.codigo === 'DEMO50';
      grid.style.display = '';
      grid.innerHTML = json.data.map(c => {
        const codigo = escapeHTML(c.codigo);
        return `
        <div class="col-12 col-md-6">
          <div class="cupon-card ${isDemo(c) ? 'demo' : ''}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
              <div>
                <div class="cupon-pct">${c.descuento_porcentaje}%</div>
                <div style="font-size:.75rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">de descuento</div>
                ${isDemo(c) ? '<span class="badge-demo">Solo demo</span>' : ''}
              </div>
              <div style="text-align:right;">
                <div class="cupon-codigo" onclick="copiarCodigo(this, '${codigo}')">${codigo}</div>
                <div class="cupon-vence"><i class="fa-regular fa-calendar"></i> Válido hasta ${fmtFecha(c.fecha_fin)}</div>
                ${c.usos_maximos !== null
                  ? `<div class="cupon-vence"><i class="fa-solid fa-users"></i> ${c.usos_maximos - c.usos_actuales} usos restantes</div>`
                  : '<div class="cupon-vence"><i class="fa-solid fa-infinity"></i> Usos ilimitados</div>'}
              </div>
            </div>
            <div style="margin-top:16px;">
              <button class="btn-copy" onclick="copiarCodigo(this, '${codigo}')">
                <i class="fa-solid fa-copy"></i> Copiar código
              </button>
            </div>
          </div>
        </div>`;
      }).join('');

      document.getElementById('instrucciones').style.display = 'block';
    } catch (err) {
      console.error(err);
      document.getElementById('loadingCupones').style.display = 'none';
      const grid = document.getElementById('cuponesGrid');
      grid.innerHTML = '<div class="col-12 text-center py-5 text-danger">Error al cargar los cupones. Intenta más tarde.</div>';
      grid.style.display = 'flex';
    }
  }

  // ============================================================
  // Init por rol
  // ============================================================
  if (isHost) {
    // Mostrar panel de creación + lista de gestión; ocultar vista de conductor
    const panel = document.getElementById('panelCrearCupon');
    if (panel) panel.style.display = 'block';
    const grid = document.getElementById('cuponesGrid');
    if (grid) grid.style.display = 'none';
    const instr = document.getElementById('instrucciones');
    if (instr) instr.style.display = 'none';

    // Fecha mínima = mañana
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const min = manana.toISOString().split('T')[0];
    const inputFin = document.getElementById('adminFechaFin');
    if (inputFin) { inputFin.min = min; inputFin.value = ''; }

    cargarMisCupones();
  } else {
    cargarCupones();
  }
})();
