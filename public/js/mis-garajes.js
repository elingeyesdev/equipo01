// ============================================================
// EstAirbnb — mis-garajes.js
// Lógica de la página de Gestión de Garajes (Anfitrión)
// ============================================================

const USUARIO_KEY = 'estairbnb_user';

// ============================================================
// Verificar sesión — redirige a login si no hay usuario
// ============================================================
const currentUser = JSON.parse(localStorage.getItem(USUARIO_KEY) || 'null');
if (!currentUser || !currentUser.id) {
  window.location.href = '/login.html';
}

// Solo anfitriones (rol_id = 1) pueden acceder a esta página
if (currentUser && currentUser.rol_id !== 1) {
  window.location.href = '/explorar.html';
}

// ============================================================
// DOM Elements
// ============================================================
const formGaraje        = document.getElementById('formGaraje');
const inpDireccion      = document.getElementById('inpDireccion');
const inpDescripcion    = document.getElementById('inpDescripcion');
const inpPrecio         = document.getElementById('inpPrecio');
const selTipo           = document.getElementById('selTipo');
const inpFotos          = document.getElementById('inpFotos');
const uploadZone        = document.getElementById('uploadZone');
const photoPreviewGrid  = document.getElementById('photoPreviewGrid');
const btnPublicar       = document.getElementById('btnPublicar');
const garajesGrid       = document.getElementById('garajesGrid');
const loadingGarajes    = document.getElementById('loadingGarajes');
const emptyState        = document.getElementById('emptyState');
const statsBar          = document.getElementById('statsBar');
const contadorGarajes   = document.getElementById('contadorGarajes');

// ============================================================
// Navbar — User info & avatar
// ============================================================
function initNavbar() {
  const nameEl = document.getElementById('navUserName');
  const avatarEl = document.getElementById('userAvatar');
  const initialsEl = document.getElementById('navInitials');

  if (currentUser.nombre) {
    nameEl.textContent = currentUser.nombre;
    const initials = (currentUser.nombre[0] || '') + (currentUser.apellidos?.[0] || '');
    initialsEl.textContent = initials.toUpperCase();
  }

  // Si tiene foto de perfil
  if (currentUser.foto_url) {
    avatarEl.style.backgroundImage = `url('${currentUser.foto_url}')`;
    initialsEl.style.display = 'none';
  }
}

// ============================================================
// Dark Mode Toggle
// ============================================================
function initTheme() {
  const saved = localStorage.getItem('estairbnb_theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('themeIcon').className = 'fa-solid fa-sun';
  }

  document.getElementById('btnThemeToggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      document.getElementById('themeIcon').className = 'fa-solid fa-moon';
      localStorage.setItem('estairbnb_theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.getElementById('themeIcon').className = 'fa-solid fa-sun';
      localStorage.setItem('estairbnb_theme', 'dark');
    }
  });
}

// ============================================================
// Logout
// ============================================================
document.getElementById('btnLogout').addEventListener('click', () => {
  localStorage.removeItem(USUARIO_KEY);
  window.location.href = '/login.html';
});

// ============================================================
// Toast Notifications
// ============================================================
function showToast(msg, type = 'success') {
  const toastEl = document.getElementById('toastNotification');
  const toastBody = document.getElementById('toastBody');
  const toastMsg = document.getElementById('toastMessage');

  toastEl.className = `toast toast-${type}`;
  toastBody.querySelector('i').className =
    type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation';
  toastMsg.textContent = msg;

  const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
  toast.show();
}

// ============================================================
// Photo Preview — Archivos seleccionados
// ============================================================
let selectedFiles = [];  // DataTransfer para manejar archivos

function initFileUpload() {
  // Click en la zona de upload
  inpFotos.addEventListener('change', handleFilesSelected);

  // Drag & Drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragging');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragging');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragging');
    const files = Array.from(e.dataTransfer.files).filter(f =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(f.type)
    );
    addFiles(files);
  });
}

function handleFilesSelected(e) {
  const files = Array.from(e.target.files);
  addFiles(files);
}

function addFiles(newFiles) {
  // Limitar a 5 total
  const remaining = 5 - selectedFiles.length;
  if (remaining <= 0) {
    showToast('Máximo 5 fotos por garaje.', 'error');
    return;
  }

  const toAdd = newFiles.slice(0, remaining);
  selectedFiles.push(...toAdd);
  renderPreviews();

  if (selectedFiles.length >= 5) {
    showToast('Has alcanzado el máximo de 5 fotos.', 'error');
  }
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderPreviews();
}

function renderPreviews() {
  photoPreviewGrid.innerHTML = '';

  selectedFiles.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.className = 'photo-preview-item';
      div.innerHTML = `
        <img src="${e.target.result}" alt="Preview ${idx + 1}">
        <button type="button" class="remove-photo" onclick="removeFile(${idx})" title="Quitar">
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;
      photoPreviewGrid.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================
// Publicar Garaje — POST /api/garajes
// ============================================================
formGaraje.addEventListener('submit', async (e) => {
  e.preventDefault();

  const direccion     = inpDireccion.value.trim();
  const descripcion   = inpDescripcion.value.trim();
  const precio_hora   = inpPrecio.value;
  const tipo_vehiculo = selTipo.value;

  // Validaciones del lado del cliente
  if (!direccion || direccion.length < 5) {
    showToast('La dirección debe tener al menos 5 caracteres.', 'error');
    inpDireccion.focus();
    return;
  }
  if (!precio_hora || Number(precio_hora) <= 0) {
    showToast('Ingresa un precio por hora válido.', 'error');
    inpPrecio.focus();
    return;
  }
  if (!tipo_vehiculo) {
    showToast('Selecciona un tipo de vehículo.', 'error');
    selTipo.focus();
    return;
  }

  // Construir FormData
  const formData = new FormData();
  formData.append('usuario_id', currentUser.id);
  formData.append('direccion', direccion);
  formData.append('descripcion', descripcion);
  formData.append('precio_hora', precio_hora);
  formData.append('tipo_vehiculo', tipo_vehiculo);

  // Adjuntar archivos
  selectedFiles.forEach(file => {
    formData.append('fotos', file);
  });

  // UI: desactivar botón
  const origHTML = btnPublicar.innerHTML;
  btnPublicar.disabled = true;
  btnPublicar.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Publicando...`;

  try {
    const res = await fetch('/api/garajes', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      showToast(data.message || '¡Espacio publicado exitosamente!');

      // Limpiar formulario
      formGaraje.reset();
      selectedFiles = [];
      photoPreviewGrid.innerHTML = '';

      // Recargar lista de garajes
      await cargarMisGarajes();
    } else {
      showToast(data.message || 'Error al publicar el espacio.', 'error');
    }

  } catch (err) {
    console.error('Error al publicar:', err);
    showToast('No se pudo conectar con el servidor.', 'error');
  } finally {
    btnPublicar.disabled = false;
    btnPublicar.innerHTML = origHTML;
  }
});

// ============================================================
// Cargar Mis Garajes — GET /api/garajes/mis-espacios
// ============================================================
async function cargarMisGarajes() {
  loadingGarajes.style.display = 'block';
  garajesGrid.innerHTML = '';
  emptyState.style.display = 'none';
  statsBar.style.display = 'none';

  try {
    const res = await fetch(`/api/garajes/mis-espacios?usuario_id=${currentUser.id}`);
    const data = await res.json();

    loadingGarajes.style.display = 'none';

    if (res.ok && data.status === 'ok') {
      const garajes = data.data;

      if (garajes.length === 0) {
        emptyState.style.display = 'block';
        contadorGarajes.textContent = '';
        return;
      }

      // Stats
      const total = garajes.length;
      const activos = garajes.filter(g => g.estado_activo).length;
      const inactivos = total - activos;

      document.getElementById('statTotal').textContent = total;
      document.getElementById('statActivos').textContent = activos;
      document.getElementById('statInactivos').textContent = inactivos;
      statsBar.style.display = 'flex';
      contadorGarajes.textContent = `${total} espacio${total !== 1 ? 's' : ''}`;

      // Render cards
      garajes.forEach((garaje, index) => {
        garajesGrid.appendChild(crearTarjetaGaraje(garaje, index));
      });

    } else {
      showToast(data.message || 'Error al cargar los espacios.', 'error');
    }

  } catch (err) {
    loadingGarajes.style.display = 'none';
    console.error('Error al cargar garajes:', err);
    showToast('No se pudo conectar con el servidor.', 'error');
  }
}

// ============================================================
// Crear Tarjeta de Garaje (DOM)
// ============================================================
function crearTarjetaGaraje(garaje) {
  const card = document.createElement('div');
  card.className = 'garaje-card';
  card.id = `garaje-${garaje.id}`;

  const activo = garaje.estado_activo;
  const tipoIconos = {
    auto: '<i class="fa-solid fa-car"></i>',
    moto: '<i class="fa-solid fa-motorcycle"></i>',
    camioneta: '<i class="fa-solid fa-truck-pickup"></i>',
  };

  const fotoHTML = garaje.foto_principal
    ? `<img src="${garaje.foto_principal}" class="garaje-card-img" alt="Foto del parqueo" loading="lazy">`
    : `<div class="garaje-card-img-placeholder">
         <i class="fa-solid fa-image"></i>
         <span>Sin foto</span>
       </div>`;

  card.innerHTML = `
    <div class="garaje-card-img-wrapper">
      ${fotoHTML}
      <div class="garaje-card-badge ${activo ? 'active' : 'inactive'}">
        <i class="fa-solid fa-circle"></i>
        ${activo ? 'Activo' : 'Inactivo'}
      </div>
    </div>
    <div class="garaje-card-body">
      <div class="garaje-card-direccion">${escapeHTML(garaje.direccion)}</div>
      <div class="garaje-card-descripcion">${garaje.descripcion ? escapeHTML(garaje.descripcion) : '<em style="opacity:0.5;">Sin descripción</em>'}</div>
      <div class="garaje-card-meta">
        <div class="garaje-card-precio">
          Bs. ${Number(garaje.precio_hora).toFixed(2)} <span>/hora</span>
        </div>
        <div class="garaje-card-tipo">
          ${tipoIconos[garaje.tipo_vehiculo] || ''} ${garaje.tipo_vehiculo}
        </div>
      </div>
    </div>
    <div class="garaje-card-footer">
      <button class="btn-toggle-estado ${activo ? 'desactivar' : 'activar'}"
              onclick="toggleEstado(${garaje.id}, this)"
              id="btnEstado-${garaje.id}">
        <i class="fa-solid ${activo ? 'fa-eye-slash' : 'fa-eye'}"></i>
        ${activo ? 'Desactivar' : 'Activar'}
      </button>
    </div>
  `;

  return card;
}

// ============================================================
// Toggle Estado — PUT /api/garajes/:id/estado
// ============================================================
async function toggleEstado(garajeId, btnElement) {
  btnElement.disabled = true;
  const origHTML = btnElement.innerHTML;
  btnElement.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span>`;

  try {
    const res = await fetch(`/api/garajes/${garajeId}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: currentUser.id }),
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      showToast(data.message);
      // Recargar toda la lista para actualizar stats y badges
      await cargarMisGarajes();
    } else {
      showToast(data.message || 'Error al cambiar el estado.', 'error');
      btnElement.disabled = false;
      btnElement.innerHTML = origHTML;
    }

  } catch (err) {
    console.error('Error al cambiar estado:', err);
    showToast('No se pudo conectar con el servidor.', 'error');
    btnElement.disabled = false;
    btnElement.innerHTML = origHTML;
  }
}

// ============================================================
// Utilidad: Escape HTML
// ============================================================
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// Init — Al cargar la página
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initTheme();
  initFileUpload();
  cargarMisGarajes();
});
