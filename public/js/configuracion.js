// ============================================================
// EstAirbnb — configuracion.js
// Lógica de la página de Configuración de Perfil
// ============================================================

// ============================================================
// 1. SESIÓN — Leer usuario del localStorage
// ============================================================
const USUARIO_KEY = 'estairbnb_user';
const session     = JSON.parse(localStorage.getItem(USUARIO_KEY));

// Protección de ruta: si no hay sesión, redirigir a login
if (!session || !session.id) {
  window.location.href = '/login.html';
  throw new Error('No autenticado');
}

const USUARIO_ID = session.id;

// Nav visibility inicial según rol (se refina en cargarPerfil tras la API)
if (session.rol_id === 1) { // anfitrión
  const navExplorar  = document.getElementById('navLinkExplorar');
  const navFavoritos = document.getElementById('navLinkFavoritos');
  const navReservas  = document.getElementById('navLinkReservas');
  if (navExplorar)  navExplorar.style.display  = 'none';
  if (navFavoritos) navFavoritos.style.display = 'none';
  if (navReservas)  navReservas.style.display  = 'none';
} else { // conductor
  const navGarajes = document.getElementById('navLinkGarajes');
  if (navGarajes) navGarajes.style.display = 'none';
}
const navCupones = document.getElementById('navLinkCupones');
if (navCupones) navCupones.style.display = '';

// Mostrar nombre e iniciales en navbar
const navUserNameEl = document.getElementById('navUserName');
if (navUserNameEl) navUserNameEl.textContent = session.nombre || '';
const initials = ((session.nombre || '?')[0] + (session.apellidos || '?')[0]).toUpperCase();
const navInitialsEl = document.getElementById('navInitials');
if (navInitialsEl) navInitialsEl.textContent = initials;
document.getElementById('avatarBigInitials').textContent = initials;

// Cerrar sesión
const btnLogoutConf = document.getElementById('btnLogout');
if (btnLogoutConf && !btnLogoutConf.dataset.bound) {
  btnLogoutConf.dataset.bound = '1';
  btnLogoutConf.addEventListener('click', () => {
    localStorage.removeItem(USUARIO_KEY);
    window.location.href = '/login.html';
  });
}


// ============================================================
// 2. TOAST — Notificaciones
// ============================================================
function showToast(message, type = 'success') {
  const toastEl   = document.getElementById('toastNotification');
  const toastBody = document.getElementById('toastBody');
  toastEl.classList.remove('toast-success', 'toast-error');
  toastEl.classList.add(type === 'success' ? 'toast-success' : 'toast-error');
  const icon = type === 'success'
    ? '<i class="fa-solid fa-circle-check"></i>'
    : '<i class="fa-solid fa-circle-exclamation"></i>';
  toastBody.innerHTML = `${icon} <span>${message}</span>`;
  new bootstrap.Toast(toastEl, { delay: 4000 }).show();
}


// ============================================================
// 3. TOGGLE EDIT — Edición inline tipo Facebook
// ============================================================
const editState = { Nombre: false, Apellidos: false, Telefono: false };

function toggleEdit(field) {
  const val = document.getElementById(`val${field}`);
  const inp = document.getElementById(`inp${field}`);
  const btn = document.querySelector(`[data-field="${field}"]`);

  const isEditing = editState[field];

  if (!isEditing) {
    // Entrar en modo edición
    inp.value = val.textContent === '—' ? '' : val.textContent;
    val.style.display = 'none';
    inp.style.display  = 'block';
    inp.focus();
    btn.textContent = 'Cancelar';
    btn.classList.add('cancel-mode');
    editState[field] = true;
  } else {
    // Cancelar edición de este campo
    val.style.display  = '';
    inp.style.display  = 'none';
    btn.textContent = 'Editar';
    btn.classList.remove('cancel-mode');
    editState[field] = false;
  }

  actualizarBarraGuardar();
}

// Muestra u oculta el botón de Guardar según si hay algún campo activo
function actualizarBarraGuardar() {
  const hayEdiciones = Object.values(editState).some(v => v);
  document.getElementById('saveBarWrapper').style.display = hayEdiciones ? 'block' : 'none';
}

// Cancela TODAS las ediciones activas
function cancelarTodo() {
  ['Nombre', 'Apellidos', 'Telefono'].forEach(f => {
    if (editState[f]) toggleEdit(f);
  });
}


// ============================================================
// 4. GUARDAR CAMBIOS — PUT /api/perfil/general
// ============================================================
async function guardarCambios() {
  const btn = document.getElementById('btnGuardar');

  // Recolectar valores: si en edición toma el input, si no toma el span
  const nombre    = editState.Nombre    ? document.getElementById('inpNombre').value.trim()    : document.getElementById('valNombre').textContent;
  const apellidos = editState.Apellidos ? document.getElementById('inpApellidos').value.trim() : document.getElementById('valApellidos').textContent;
  const telefono  = editState.Telefono  ? document.getElementById('inpTelefono').value.trim()  : document.getElementById('valTelefono').textContent;

  // Validaciones rápidas
  if (!nombre || nombre.length < 2) {
    showToast('El nombre debe tener al menos 2 caracteres.', 'error');
    document.getElementById('inpNombre').focus();
    return;
  }
  if (!apellidos || apellidos.length < 2) {
    showToast('Los apellidos deben tener al menos 2 caracteres.', 'error');
    document.getElementById('inpApellidos').focus();
    return;
  }

  // Estado cargando
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Guardando...`;

  try {
    const response = await fetch('/api/perfil/general', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ usuario_id: USUARIO_ID, nombre, apellidos, telefono }),
    });

    const data = await response.json();

    if (response.ok && data.status === 'ok') {
      // Actualizar los spans con los nuevos valores
      document.getElementById('valNombre').textContent    = nombre;
      document.getElementById('valApellidos').textContent = apellidos;
      document.getElementById('valTelefono').textContent  = telefono || '—';

      // Cerrar todos los modos de edición
      cancelarTodo();
      showToast('¡Perfil actualizado correctamente!', 'success');
    } else {
      showToast(data.message || 'Error al actualizar.', 'error');
    }

  } catch (err) {
    console.error('Error de red:', err);
    showToast('No se pudo conectar con el servidor.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHTML;
  }
}


// ============================================================
// 5. CARGAR PERFIL — GET /api/perfil/general
// ============================================================
async function cargarPerfil() {
  try {
    const res = await fetch(`/api/perfil/general?usuario_id=${USUARIO_ID}`);
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      const u = data.data;
      document.getElementById('valNombre').textContent    = u.nombre    || '—';
      document.getElementById('valApellidos').textContent = u.apellidos || '—';
      document.getElementById('valTelefono').textContent  = u.telefono  || '—';
      document.getElementById('valEmail').textContent     = u.email     || '—';

      if (u.foto_url) {
        actualizarAvatares(u.foto_url);
      }

      // ── Actualizar rol dinámicamente ──
      const rolBadge = document.getElementById('rolBadge');
      const rolNombre = u.rol_nombre || 'conductor';
      const esAnfitrion = rolNombre === 'anfitrion';

      if (rolBadge) {
        rolBadge.className = `role-badge ${esAnfitrion ? 'anfitrion' : 'conductor'}`;
        rolBadge.innerHTML = esAnfitrion
          ? '<i class="fa-solid fa-warehouse"></i> Anfitrión'
          : '<i class="fa-solid fa-car"></i> Conductor';
      }

      // ── Mostrar/ocultar nav links según rol ──
      const navLinkExplorar  = document.getElementById('navLinkExplorar');
      const navLinkFavoritos = document.getElementById('navLinkFavoritos');
      const navLinkGarajes   = document.getElementById('navLinkGarajes');
      const navLinkReservas  = document.getElementById('navLinkReservas');
      const navLinkCupones   = document.getElementById('navLinkCupones');

      if (navLinkExplorar)  navLinkExplorar.style.display  = esAnfitrion ? 'none' : 'flex';
      if (navLinkFavoritos) navLinkFavoritos.style.display = esAnfitrion ? 'none' : 'flex';
      if (navLinkGarajes)   navLinkGarajes.style.display   = esAnfitrion ? 'flex' : 'none';
      if (navLinkReservas)  navLinkReservas.style.display  = esAnfitrion ? 'none' : 'flex';
      if (navLinkCupones)   navLinkCupones.style.display   = 'flex';
    } else {
      showToast('No se pudo cargar el perfil.', 'error');
    }
  } catch (err) {
    console.error('Error al cargar perfil:', err);
    showToast('Error de conexión al cargar el perfil.', 'error');
  } finally {
    document.getElementById('loadingState').style.display  = 'none';
    document.getElementById('fieldsContainer').style.display = 'block';
  }
}

function actualizarAvatares(url) {
  const tsUrl = `${url}?t=${new Date().getTime()}`; // cache buster
  document.getElementById('navInitials').style.display = 'none';
  document.getElementById('userAvatar').style.backgroundImage = `url('${tsUrl}')`;

  document.getElementById('avatarBigInitials').style.display = 'none';
  document.getElementById('avatarBig').style.backgroundImage = `url('${tsUrl}')`;
}


// ============================================================
// 6. FOTO DE PERFIL — Selección y Subida
// ============================================================
async function onFotoSeleccionada(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Mostrar previsualización local instantánea
  const localUrl = URL.createObjectURL(file);
  actualizarAvatares(localUrl);

  // UI Estado cargando
  const uploadingOverlay = document.getElementById('avatarUploading');
  if (uploadingOverlay) uploadingOverlay.classList.add('show');

  const formData = new FormData();
  formData.append('foto', file);
  formData.append('usuario_id', USUARIO_ID);

  try {
    const res = await fetch('/api/perfil/upload-foto', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      showToast('¡Foto de perfil actualizada!', 'success');
      // Aplicar la URL que devuelve el back
      actualizarAvatares(data.foto_url);
    } else {
      showToast(data.message || 'Error al subir la foto.', 'error');
    }
  } catch (err) {
    console.error('Error subiendo foto:', err);
    showToast('No se pudo conectar para subir la foto.', 'error');
  } finally {
    if (uploadingOverlay) uploadingOverlay.classList.remove('show');
    event.target.value = ''; // Resetear el input para poder re-seleccionar
  }
}


// ============================================================
// 7. NAVEGACIÓN — Sidebar Section Switching
// ============================================================
const SECTIONS = {
  general:    'sectionGeneral',
  seguridad:  'sectionSeguridad',
  privacidad: 'sectionPrivacidad',
  actividad:  'sectionActividad',
  vehiculos:  'sectionVehiculos',
  soporte:    'sectionSoporte',
};

function showSection(sectionKey) {
  Object.values(SECTIONS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(SECTIONS[sectionKey]);
  if (target) {
    target.style.display = 'block';
    target.style.animation = 'none';
    target.offsetHeight;
    target.style.animation = 'fadeInUp 0.4s ease';
  }
}


// ============================================================
// 8. DARK MODE — Toggle y Persistencia
// ============================================================
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('themeIcon');
  if (theme === 'dark') {
    icon.className = 'fa-solid fa-sun';
  } else {
    icon.className = 'fa-solid fa-moon';
  }
}


// ============================================================
// 9. SEGURIDAD — Cambiar Contraseña
// ============================================================
function togglePwField(inputId, btn) {
  const inp  = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  icon.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
}

function showPwAlert(msg, type = 'error') {
  const box  = document.getElementById('pwAlertBox');
  const icon = document.getElementById('pwAlertIcon');
  box.style.display = 'flex';
  if (type === 'error') {
    box.style.background = '#fff2f3';
    box.style.color      = '#c0392b';
    box.style.border     = '1.5px solid #f5c6cb';
    icon.className       = 'fa-solid fa-circle-exclamation';
  } else {
    box.style.background = '#f0faf4';
    box.style.color      = '#1a7a42';
    box.style.border     = '1.5px solid #b7dfcb';
    icon.className       = 'fa-solid fa-circle-check';
  }
  document.getElementById('pwAlertMsg').textContent = msg;
}

async function cambiarPassword() {
  document.getElementById('pwAlertBox').style.display = 'none';

  const passwordActual = document.getElementById('pwActual').value;
  const passwordNueva  = document.getElementById('pwNueva').value;
  const confirmacion   = document.getElementById('pwConfirmar').value;

  if (!passwordActual) {
    showPwAlert('Ingresa tu contraseña actual.');
    document.getElementById('pwActual').focus();
    return;
  }
  if (!passwordNueva || passwordNueva.length < 6) {
    showPwAlert('La nueva contraseña debe tener al menos 6 caracteres.');
    document.getElementById('pwNueva').focus();
    return;
  }
  if (passwordNueva !== confirmacion) {
    showPwAlert('Las contraseñas no coinciden.');
    document.getElementById('pwConfirmar').focus();
    return;
  }
  if (passwordActual === passwordNueva) {
    showPwAlert('La nueva contraseña debe ser diferente a la actual.');
    document.getElementById('pwNueva').focus();
    return;
  }

  const btn = document.getElementById('btnCambiarPw');
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Verificando...`;

  try {
    const res = await fetch('/api/perfil/seguridad/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: USUARIO_ID, passwordActual, passwordNueva }),
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      showPwAlert('¡Contraseña actualizada correctamente!', 'success');
      showToast('¡Contraseña cambiada con éxito!', 'success');
      document.getElementById('pwActual').value    = '';
      document.getElementById('pwNueva').value     = '';
      document.getElementById('pwConfirmar').value = '';
      const strengthFill = document.getElementById('pwStrengthFill');
      const strengthLabel = document.getElementById('pwStrengthLabel');
      if (strengthFill)  strengthFill.style.width = '0%';
      if (strengthLabel) strengthLabel.textContent = '';
    } else {
      showPwAlert(data.message || 'Error al cambiar la contraseña.');
    }
  } catch (err) {
    console.error('Error al cambiar contraseña:', err);
    showPwAlert('No se pudo conectar con el servidor.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHTML;
  }
}


// ============================================================
// 10. PRIVACIDAD — Cargar y Guardar preferencias
// ============================================================
function showPrivAlert(msg, type = 'success') {
  const box  = document.getElementById('privAlertBox');
  const icon = document.getElementById('privAlertIcon');
  box.style.display = 'flex';
  if (type === 'error') {
    box.style.background = '#fff2f3';
    box.style.color      = '#c0392b';
    box.style.border     = '1.5px solid #f5c6cb';
    icon.className       = 'fa-solid fa-circle-exclamation';
  } else {
    box.style.background = '#f0faf4';
    box.style.color      = '#1a7a42';
    box.style.border     = '1.5px solid #b7dfcb';
    icon.className       = 'fa-solid fa-circle-check';
  }
  document.getElementById('privAlertMsg').textContent = msg;
}

async function cargarPrivacidad() {
  try {
    const res = await fetch(`/api/perfil/privacidad?usuario_id=${USUARIO_ID}`);
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      const p = data.data;
      document.getElementById('switchTelefono').checked      = !!p.priv_telefono;
      document.getElementById('switchCalificaciones').checked = !!p.priv_calificaciones;
      document.getElementById('switchEmail').checked          = !!p.priv_email;
    }
  } catch (err) {
    console.error('Error al cargar privacidad:', err);
  }
}

async function guardarPrivacidad() {
  const btn = document.getElementById('btnGuardarPriv');
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Guardando...`;

  const body = {
    usuario_id: USUARIO_ID,
    priv_telefono:       document.getElementById('switchTelefono').checked,
    priv_calificaciones: document.getElementById('switchCalificaciones').checked,
    priv_email:          document.getElementById('switchEmail').checked,
  };

  try {
    const res = await fetch('/api/perfil/privacidad', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      showPrivAlert('¡Preferencias de privacidad guardadas!');
      showToast('¡Privacidad actualizada!', 'success');
    } else {
      showPrivAlert(data.message || 'Error al guardar.', 'error');
    }
  } catch (err) {
    console.error('Error al guardar privacidad:', err);
    showPrivAlert('No se pudo conectar con el servidor.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHTML;
  }
}


// ============================================================
// 11. ACTIVIDAD — Resumen de actividad del usuario por rol
// ============================================================
const QUICK_LINK_STYLE = 'display:flex;align-items:center;gap:10px;padding:12px 16px;border-radius:12px;background:#f7f9fb;border:1px solid #e2e8f0;text-decoration:none;color:#002542;font-size:.88rem;font-weight:600;transition:all .2s;';

async function cargarActividad() {
  const loading   = document.getElementById('actividadLoading');
  const statsDiv  = document.getElementById('actividadStats');
  const linksBox  = document.getElementById('actividadLinksBox');
  const linksGrid = document.getElementById('actividadLinksGrid');
  const esAnfitrion = session.rol_id === 1;

  function statCard(icon, color, value, label) {
    return `<div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,37,66,.07);border:1px solid rgba(0,37,66,.06);display:flex;align-items:center;gap:14px;">
      <div style="width:44px;height:44px;background:${color};border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem;flex-shrink:0;">${icon}</div>
      <div><div style="font-size:1.7rem;font-weight:900;color:#002542;line-height:1;">${value}</div><div style="font-size:.68rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-top:4px;">${label}</div></div>
    </div>`;
  }

  function quickLink(href, emoji, label) {
    return `<a href="${href}" style="${QUICK_LINK_STYLE}" onmouseover="this.style.background='#e8f5e9';this.style.borderColor='#006a62'" onmouseout="this.style.background='#f7f9fb';this.style.borderColor='#e2e8f0'">${emoji} ${label}</a>`;
  }

  try {
    if (esAnfitrion) {
      let garajesCount = 0, pendientesCount = 0, cuponesCount = 0;
      try {
        const [garRes, cupRes] = await Promise.all([
          fetch(`/api/mis-garajes?anfitrion_id=${USUARIO_ID}`),
          fetch('/api/cupones/disponibles')
        ]);
        if (garRes.ok) { const d = await garRes.json(); garajesCount = Array.isArray(d.data) ? d.data.length : (Array.isArray(d) ? d.length : 0); }
        if (cupRes.ok) { const d = await cupRes.json(); cuponesCount = Array.isArray(d.data) ? d.data.length : 0; }
      } catch(e) {}

      statsDiv.innerHTML =
        statCard('<i class="fa-solid fa-warehouse"></i>', 'linear-gradient(135deg,#002542,#436182)', garajesCount, 'Mis Garajes') +
        statCard('<i class="fa-solid fa-ticket"></i>', 'linear-gradient(135deg,#7c3aed,#a78bfa)', cuponesCount, 'Cupones Activos');

      linksGrid.innerHTML =
        quickLink('/mis-garajes.html', '🏠', 'Gestionar Mis Garajes') +
        quickLink('/cupones.html', '🎟️', 'Crear / Ver Cupones');

    } else {
      let reservasCount = 0, favoritosCount = 0, cuponesCount = 0;
      try {
        const [resRes, favRes, cupRes] = await Promise.all([
          fetch(`/api/reservas?conductor_id=${USUARIO_ID}`),
          fetch(`/api/favoritos?usuario_id=${USUARIO_ID}`),
          fetch('/api/cupones/disponibles')
        ]);
        if (resRes.ok) { const d = await resRes.json(); reservasCount = Array.isArray(d.data) ? d.data.length : (Array.isArray(d) ? d.length : 0); }
        if (favRes.ok) { const d = await favRes.json(); favoritosCount = Array.isArray(d.data) ? d.data.length : (Array.isArray(d) ? d.length : 0); }
        if (cupRes.ok) { const d = await cupRes.json(); cuponesCount = Array.isArray(d.data) ? d.data.length : 0; }
      } catch(e) {}

      statsDiv.innerHTML =
        statCard('<i class="fa-solid fa-calendar-check"></i>', 'linear-gradient(135deg,#002542,#436182)', reservasCount, 'Total Reservas') +
        statCard('<i class="fa-solid fa-heart"></i>', 'linear-gradient(135deg,#ff4757,#ff6b81)', favoritosCount, 'Favoritos') +
        statCard('<i class="fa-solid fa-ticket"></i>', 'linear-gradient(135deg,#7c3aed,#a78bfa)', cuponesCount, 'Cupones Disponibles');

      linksGrid.innerHTML =
        quickLink('/explorar.html', '🔍', 'Explorar Garajes') +
        quickLink('/mis-reservas.html', '📋', 'Mis Reservas') +
        quickLink('/mis-favoritos.html', '❤️', 'Mis Favoritos') +
        quickLink('/cupones.html', '🎟️', 'Ver Cupones');
    }
  } finally {
    if (loading)  loading.style.display  = 'none';
    if (statsDiv) statsDiv.style.display = 'grid';
    if (linksBox) linksBox.style.display = 'block';
  }
}


// ============================================================
// 12. VEHÍCULOS — CRUD completo (solo conductor)
// ============================================================
let _vehiculosCache = [];

async function cargarVehiculos() {
  if (session.rol_id !== 2) return;
  const grid    = document.getElementById('vehiculosGrid');
  const empty   = document.getElementById('vehiculosEmpty');
  if (!grid) return;
  grid.innerHTML = '<div class="col-12 text-center py-3"><div class="spinner-border spinner-border-sm text-secondary" role="status"></div></div>';
  try {
    const res  = await fetch(`/api/vehiculos?conductor_id=${USUARIO_ID}`);
    const data = await res.json();
    _vehiculosCache = Array.isArray(data.data) ? data.data : [];
    if (_vehiculosCache.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    const tipoIcono = { auto: 'fa-car', moto: 'fa-motorcycle', camioneta: 'fa-truck' };
    const tipoLabel = { auto: 'Auto', moto: 'Moto', camioneta: 'Camioneta' };
    grid.innerHTML = _vehiculosCache.map(v => `
      <div class="col-12 col-sm-6 col-md-4" id="vehiculoCard-${v.id}">
        <div class="card border-0 shadow-sm h-100" style="border-radius:14px;overflow:hidden;">
          <div class="card-body p-3">
            <div class="d-flex align-items-center gap-3 mb-2">
              <div style="width:42px;height:42px;border-radius:12px;background:${v.es_principal ? '#e8f5e9' : '#f1f5f9'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:${v.es_principal ? '#006a62' : '#64748b'};">
                <i class="fa-solid ${tipoIcono[v.tipo] || 'fa-car'}"></i>
              </div>
              <div class="flex-grow-1 min-w-0">
                <div class="fw-bold text-truncate" style="color:#002542;font-size:.92rem;">${escHTML(v.placa)}</div>
                <div class="text-muted small">${escHTML(v.marca)} ${escHTML(v.modelo)}${v.color ? ' · ' + escHTML(v.color) : ''}</div>
              </div>
              ${v.es_principal ? '<span class="badge" style="background:#006a62;color:#fff;font-size:.68rem;">Principal</span>' : ''}
            </div>
            <div class="d-flex gap-2 mt-2">
              <span class="badge" style="background:#f1f5f9;color:#475569;font-size:.72rem;">${tipoLabel[v.tipo] || v.tipo}</span>
            </div>
          </div>
          <div class="card-footer bg-transparent border-top py-2 px-3 d-flex gap-2 justify-content-end">
            <button class="btn btn-sm btn-outline-secondary" style="font-size:.75rem;" onclick="editarVehiculo(${v.id})">
              <i class="fa-solid fa-pen-to-square me-1"></i>Editar
            </button>
            <button class="btn btn-sm btn-outline-danger" style="font-size:.75rem;" onclick="eliminarVehiculo(${v.id})">
              <i class="fa-solid fa-trash me-1"></i>Eliminar
            </button>
          </div>
        </div>
      </div>`).join('');
  } catch (err) {
    grid.innerHTML = '<div class="col-12"><p class="text-muted small">Error al cargar vehículos.</p></div>';
  }
}

function escHTML(val) {
  const d = document.createElement('div');
  d.textContent = val == null ? '' : String(val);
  return d.innerHTML;
}

function abrirModalVehiculo(v = null) {
  document.getElementById('vehiculoEditId').value   = v ? v.id : '';
  document.getElementById('vehiculoModalTitulo').textContent = v ? 'Editar Vehículo' : 'Agregar Vehículo';
  document.getElementById('vPlaca').value    = v ? v.placa   : '';
  document.getElementById('vMarca').value    = v ? v.marca   : '';
  document.getElementById('vModelo').value   = v ? v.modelo  : '';
  document.getElementById('vColor').value    = v ? (v.color || '') : '';
  document.getElementById('vTipo').value     = v ? v.tipo    : 'auto';
  document.getElementById('vPrincipal').checked = v ? !!v.es_principal : false;
  document.getElementById('vehiculoModalError').style.display = 'none';
  const overlay = document.getElementById('vehiculoModalOverlay');
  overlay.style.display = 'flex';
}

function cerrarModalVehiculo() {
  document.getElementById('vehiculoModalOverlay').style.display = 'none';
}

function editarVehiculo(id) {
  const v = _vehiculosCache.find(x => x.id === id);
  if (v) abrirModalVehiculo(v);
}

async function guardarVehiculo() {
  const editId   = document.getElementById('vehiculoEditId').value;
  const placa    = document.getElementById('vPlaca').value.trim().toUpperCase();
  const marca    = document.getElementById('vMarca').value.trim();
  const modelo   = document.getElementById('vModelo').value.trim();
  const color    = document.getElementById('vColor').value.trim();
  const tipo     = document.getElementById('vTipo').value;
  const principal = document.getElementById('vPrincipal').checked;
  const errEl    = document.getElementById('vehiculoModalError');

  if (!placa || !marca || !modelo) {
    errEl.textContent = 'Placa, marca y modelo son obligatorios.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('btnGuardarVehiculo');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const body = { conductor_id: USUARIO_ID, placa, marca, modelo, color: color || null, tipo, es_principal: principal };
  const url    = editId ? `/api/vehiculos/${editId}` : '/api/vehiculos';
  const method = editId ? 'PUT' : 'POST';

  try {
    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      cerrarModalVehiculo();
      showToast(data.message, 'success');
      await cargarVehiculos();
    } else {
      errEl.textContent = data.message || 'Error al guardar.';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Error de conexión.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

async function eliminarVehiculo(id) {
  if (!confirm('¿Eliminar este vehículo?')) return;
  try {
    const res  = await fetch(`/api/vehiculos/${id}?conductor_id=${USUARIO_ID}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conductor_id: USUARIO_ID })
    });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      showToast('Vehículo eliminado.', 'success');
      await cargarVehiculos();
    } else {
      showToast(data.message || 'Error al eliminar.', 'error');
    }
  } catch (err) {
    showToast('Error de conexión.', 'error');
  }
}


// ============================================================
// 13. SOPORTE — Tickets
// ============================================================
async function cargarTickets() {
  const list   = document.getElementById('ticketsList');
  const empty  = document.getElementById('ticketsEmpty');
  const loader = document.getElementById('ticketsLoading');
  if (!list) return;
  if (loader) loader.style.display = 'block';
  try {
    const res  = await fetch(`/api/soporte/tickets?usuario_id=${USUARIO_ID}`);
    const data = await res.json();
    if (loader) loader.style.display = 'none';
    const tickets = Array.isArray(data.data) ? data.data : [];
    if (tickets.length === 0) {
      if (empty) empty.style.display = 'block';
      list.innerHTML = '';
      return;
    }
    if (empty) empty.style.display = 'none';
    const estadoColor = { abierto: '#f59e0b', en_revision: '#2563eb', resuelto: '#006a62', cerrado: '#94a3b8' };
    const estadoLabel = { abierto: 'Abierto', en_revision: 'En revisión', resuelto: 'Resuelto', cerrado: 'Cerrado' };
    const catLabel    = { consulta: 'Consulta', disputa: 'Disputa', reembolso: 'Reembolso', problema_acceso: 'Acceso', otro: 'Otro' };
    list.innerHTML = tickets.map(t => `
      <div class="d-flex align-items-start gap-3 p-3 mb-2 rounded" style="background:#f8fafc;border:1px solid #e2e8f0;">
        <div style="width:36px;height:36px;border-radius:10px;background:${estadoColor[t.estado] || '#94a3b8'}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <i class="fa-solid fa-ticket" style="color:${estadoColor[t.estado] || '#94a3b8'};font-size:.85rem;"></i>
        </div>
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <span class="fw-bold" style="font-size:.88rem;color:#0f172a;">${escHTML(t.asunto)}</span>
            <span style="font-size:.72rem;font-weight:700;padding:2px 8px;border-radius:20px;background:${estadoColor[t.estado] || '#94a3b8'}22;color:${estadoColor[t.estado] || '#94a3b8'};">${estadoLabel[t.estado] || t.estado}</span>
            <span style="font-size:.7rem;color:#94a3b8;background:#f1f5f9;padding:2px 8px;border-radius:20px;">${catLabel[t.categoria] || t.categoria}</span>
          </div>
          <div class="text-muted" style="font-size:.78rem;">${new Date(t.fecha_creacion).toLocaleDateString('es-BO', { day:'2-digit', month:'short', year:'numeric' })}</div>
          ${t.respuesta ? `<div class="mt-2 p-2 rounded" style="background:#f0fdf4;border:1px solid #bbf7d0;font-size:.8rem;color:#166534;"><i class="fa-solid fa-reply me-1"></i>${escHTML(t.respuesta)}</div>` : ''}
        </div>
      </div>`).join('');
  } catch (err) {
    if (loader) loader.style.display = 'none';
    if (list) list.innerHTML = '<p class="text-muted small">Error al cargar reportes.</p>';
  }
}

async function enviarTicket() {
  const categoria   = document.getElementById('ticketCategoria').value;
  const reserva_id  = document.getElementById('ticketReservaId').value.trim();
  const asunto      = document.getElementById('ticketAsunto').value.trim();
  const descripcion = document.getElementById('ticketDescripcion').value.trim();
  const alerta      = document.getElementById('ticketAlerta');

  alerta.className = 'alert d-none';
  if (!asunto || asunto.length < 5) {
    alerta.className = 'alert alert-danger';
    alerta.textContent = 'El asunto debe tener al menos 5 caracteres.';
    return;
  }
  if (!descripcion || descripcion.length < 20) {
    alerta.className = 'alert alert-danger';
    alerta.textContent = 'La descripción debe tener al menos 20 caracteres.';
    return;
  }

  const btn = document.getElementById('btnEnviarTicket');
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Enviando...';

  try {
    const res  = await fetch('/api/soporte/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: USUARIO_ID, categoria, asunto, descripcion, reserva_id: reserva_id || null })
    });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      alerta.className = 'alert alert-success';
      alerta.textContent = data.message;
      document.getElementById('ticketAsunto').value      = '';
      document.getElementById('ticketDescripcion').value = '';
      document.getElementById('ticketReservaId').value   = '';
      showToast(data.message, 'success');
      await cargarTickets();
    } else {
      alerta.className = 'alert alert-danger';
      alerta.textContent = data.message || 'Error al enviar el reporte.';
    }
  } catch (err) {
    alerta.className = 'alert alert-danger';
    alerta.textContent = 'Error de conexión.';
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHTML;
  }
}


// ============================================================
// 14. HISTORIAL — Actividad con filtros de fecha
// ============================================================
let _historialCargado = false;

async function cargarHistorial(desde = '', hasta = '') {
  const tablaEl  = document.getElementById('historialTabla');
  const loader   = document.getElementById('historialLoading');
  const cardEl   = document.getElementById('historialCard');
  if (!tablaEl) return;
  if (cardEl)  cardEl.style.display  = 'block';
  if (loader)  loader.style.display  = 'block';
  tablaEl.innerHTML = '';

  let url = `/api/historial?usuario_id=${USUARIO_ID}`;
  if (desde) url += `&desde=${desde}`;
  if (hasta) url += `&hasta=${hasta}`;

  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (loader) loader.style.display = 'none';
    const items = Array.isArray(data.data) ? data.data : [];
    const rol   = data.rol || 'conductor';
    _historialCargado = true;

    if (items.length === 0) {
      tablaEl.innerHTML = `<p class="text-muted small text-center py-3">No se encontraron registros${desde || hasta ? ' para el período seleccionado' : ''}.</p>`;
      return;
    }

    const estadoColor = { pendiente:'#f59e0b', confirmada:'#006a62', finalizada:'#64748b', rechazada:'#ba1a1a', cancelada:'#94a3b8' };
    const estadoBg    = { pendiente:'#fffbeb', confirmada:'#f0fdf4', finalizada:'#f8fafc', rechazada:'#fff2f2', cancelada:'#f8fafc' };

    tablaEl.innerHTML = `
      <div class="table-responsive">
        <table class="table table-sm align-middle mb-0" style="font-size:.83rem;">
          <thead style="background:#f1f5f9;">
            <tr>
              <th class="fw-bold text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;">Garaje</th>
              ${rol === 'anfitrion' ? '<th class="fw-bold text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;">Conductor</th>' : ''}
              <th class="fw-bold text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;">Fechas</th>
              <th class="fw-bold text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;">Total</th>
              <th class="fw-bold text-muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(r => {
              const fI = new Date(r.fecha_inicio).toLocaleDateString('es-BO', { day:'2-digit', month:'short' });
              const fF = new Date(r.fecha_fin).toLocaleDateString('es-BO', { day:'2-digit', month:'short' });
              const color = estadoColor[r.estado] || '#94a3b8';
              const bg    = estadoBg[r.estado]    || '#f8fafc';
              return `
                <tr style="border-bottom:1px solid #f1f5f9;">
                  <td>
                    <div class="fw-semibold" style="color:#002542;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHTML(r.garaje_direccion)}</div>
                    <div class="text-muted" style="font-size:.72rem;">Esp. ${escHTML(r.numero_espacio)} · #${r.id}</div>
                  </td>
                  ${rol === 'anfitrion' ? `<td class="text-muted">${escHTML((r.conductor_nombre || '') + ' ' + (r.conductor_apellidos || ''))}</td>` : ''}
                  <td class="text-muted">${fI} → ${fF}</td>
                  <td class="fw-bold" style="color:#002542;">Bs. ${parseFloat(r.precio_total).toFixed(2)}</td>
                  <td><span style="padding:3px 10px;border-radius:20px;background:${bg};color:${color};font-weight:700;font-size:.72rem;border:1px solid ${color}33;">${r.estado}</span></td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    if (loader) loader.style.display = 'none';
    tablaEl.innerHTML = '<p class="text-muted small">Error al cargar el historial.</p>';
  }
}

function filtrarHistorial() {
  const desde = document.getElementById('histDesde')?.value || '';
  const hasta = document.getElementById('histHasta')?.value || '';
  cargarHistorial(desde, hasta);
}

function limpiarHistorial() {
  const desdeEl = document.getElementById('histDesde');
  const hastaEl = document.getElementById('histHasta');
  if (desdeEl) desdeEl.value = '';
  if (hastaEl) hastaEl.value = '';
  cargarHistorial();
}


// ============================================================
// 12. DOMContentLoaded — Inicialización principal
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Cargar datos del servidor al iniciar
  cargarPerfil();

  // Mostrar nav de vehículos solo para conductores
  if (session.rol_id === 2) {
    const navVeh = document.getElementById('navVehiculos');
    if (navVeh) navVeh.style.display = 'flex';
  }

  // Sidebar navigation
  const navLinks = document.querySelectorAll('#sidebarNav a');
  navLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const section = link.dataset.section;
      showSection(section);
      if (section === 'actividad' && !window._actividadCargada) {
        window._actividadCargada = true;
        cargarActividad();
        cargarHistorial();
      }
      if (section === 'vehiculos' && !window._vehiculosCargados) {
        window._vehiculosCargados = true;
        cargarVehiculos();
      }
      if (section === 'soporte' && !window._ticketsCargados) {
        window._ticketsCargados = true;
        cargarTickets();
      }
    });
  });

  // Sidebar search
  const searchInput = document.getElementById('sidebarSearch');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('#sidebarNav li').forEach(item => {
        const label = item.querySelector('.nav-label').textContent.toLowerCase();
        item.style.display = label.includes(q) ? '' : 'none';
      });
    });
  }

  // Password strength indicator
  const pwNueva = document.getElementById('pwNueva');
  if (pwNueva) {
    pwNueva.addEventListener('input', function() {
      const v = this.value;
      let score = 0;
      if (v.length >= 6)  score++;
      if (v.length >= 10) score++;
      if (/[A-Z]/.test(v)) score++;
      if (/[0-9]/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;

      const fill   = document.getElementById('pwStrengthFill');
      const label  = document.getElementById('pwStrengthLabel');
      const colors = ['#dc3545','#fd7e14','#ffc107','#28a745','#1a7a42'];
      const labels = ['Muy débil','Débil','Aceptable','Fuerte','Muy fuerte'];
      if (fill)  { fill.style.width = `${(score / 5) * 100}%`; fill.style.background = colors[score - 1] || '#e4e6eb'; }
      if (label) { label.textContent = score > 0 ? labels[score - 1] : ''; }
    });
  }

  // Dark Mode Toggle
  const themeIcon = document.getElementById('themeIcon');
  const savedTheme = localStorage.getItem('estairbnb_theme');
  
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
    if (themeIcon) themeIcon.textContent = 'light_mode';
  }

  const btnThemeToggle = document.getElementById('btnThemeToggle');
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

  // Cargar privacidad
  cargarPrivacidad();
});
