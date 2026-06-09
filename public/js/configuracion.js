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
};

function showSection(sectionKey) {
  // Ocultar todas las secciones
  Object.values(SECTIONS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(SECTIONS[sectionKey]);
  if (target) {
    target.style.display = 'block';
    target.style.animation = 'none';
    target.offsetHeight; // trigger reflow
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
// 12. DOMContentLoaded — Inicialización principal
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Cargar datos del servidor al iniciar
  cargarPerfil();

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
