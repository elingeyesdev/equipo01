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
  window.location.href = '/configuracion.html';
}

// ============================================================
// DOM Elements
// ============================================================
const formGaraje        = document.getElementById('formGaraje');
const inpDireccion      = document.getElementById('inpDireccion');
const inpDescripcion    = document.getElementById('inpDescripcion');
const inpPrecio         = document.getElementById('inpPrecio');
const inpFotos          = document.getElementById('inpFotos');
const uploadZone        = document.getElementById('uploadZone');
const photoPreviewGrid  = document.getElementById('photoPreviewGrid');
const btnPublicar       = document.getElementById('btnWizardSubmit');
const garajesGrid       = document.getElementById('garajesGrid');
const loadingGarajes    = document.getElementById('loadingGarajes');
const emptyState        = document.getElementById('emptyState');
const statsBar          = document.getElementById('statsBar');
const contadorGarajes   = document.getElementById('contadorGarajes');
const btnUbicarDireccionMapa = document.getElementById('btnUbicarDireccionMapa');
const btnUbicarmeMapa = document.getElementById('btnUbicarmeMapa');
const btnLimpiarUbicacionMapa = document.getElementById('btnLimpiarUbicacionMapa');
const ubicacionSeleccionadaText = document.getElementById('ubicacionSeleccionadaText');
const btnEditUbicarDireccionMapa = document.getElementById('btnEditUbicarDireccionMapa');
const btnEditUbicarmeMapa = document.getElementById('btnEditUbicarmeMapa');
const btnEditLimpiarUbicacionMapa = document.getElementById('btnEditLimpiarUbicacionMapa');
const editUbicacionSeleccionadaText = document.getElementById('editUbicacionSeleccionadaText');

// Cache garajes para modal de edición
let _garajesCache = [];

// Visual builder elements — TILEMAP 2D
const tmGrid     = document.getElementById('tmGrid');
const tmFilas    = document.getElementById('tmFilas');
const tmColumnas = document.getElementById('tmColumnas');
const btnTmGenerar = document.getElementById('btnTmGenerar');
const btnTmLimpiar = document.getElementById('btnTmLimpiar');
const tmCountParking = document.getElementById('tmCountParking');
const tmCountTotal   = document.getElementById('tmCountTotal');
const tilemapError   = document.getElementById('tilemapError');

// Tilemap State
let tmFilasVal = 6;
let tmColsVal  = 8;
let tmMatriz   = [];  // 2D array: tmMatriz[fila][col] = { tile, tipo_vehiculo }
let tmPincel   = 'parking'; // herramienta activa
let tmIsPainting = false;   // drag detection

// Vehicle type cycle (kept for legacy compatibility)
const TIPOS = ['auto', 'moto', 'camioneta', 'techado'];
const TIPO_CONFIG = {
  auto:      { icon: 'fa-car',          emoji: '🚗', label: 'Auto',    color: '#3b82f6' },
  moto:      { icon: 'fa-motorcycle',   emoji: '🏍‍', label: 'Moto',    color: '#f59e0b' },
  camioneta: { icon: 'fa-truck-pickup', emoji: '🚙', label: 'SUV',     color: '#8b5cf6' },
  techado:   { icon: 'fa-warehouse',    emoji: '🛖', label: 'Techado', color: '#10b981' }
};
const btnAgregarHorario = document.getElementById('btnAgregarHorario');
const horariosContainer = document.getElementById('horariosContainer');
const inpHorarioDesde = document.getElementById('inpHorarioDesde');
const inpHorarioHasta = document.getElementById('inpHorarioHasta');
const horariosError = document.getElementById('horariosError');

let horariosConfigurados = []; // Array de { dias: [1,2], inicio: "08:00", fin: "18:00" }
const inpNivelSeguridad = document.getElementById('inpNivelSeguridad');
const inpMetodoAcceso   = document.getElementById('inpMetodoAcceso');
const inpInstrucciones  = document.getElementById('inpInstrucciones');

let espaciosConfigurados = []; // derived from tilemap on submit
let ubicacionGaraje = { lat: null, lng: null, label: '' };
let ubicacionGarajeEdit = { lat: null, lng: null, label: '' };
let garajeMap = null;
let garajeMapMarker = null;
let editGarajeMap = null;
let editGarajeMapMarker = null;
const DEFAULT_GARAJE_CENTER = { lat: -16.4897, lng: -68.1193 };

// ============================================================
// Navbar — User info & avatar
// ============================================================
function initNavbar() {
  const nameEl = document.getElementById('navUserName');
  const avatarEl = document.getElementById('userAvatar');
  const initialsEl = document.getElementById('navInitials');

  if (currentUser.nombre) {
    if (nameEl) nameEl.textContent = currentUser.nombre;
    const initials = (currentUser.nombre[0] || '') + (currentUser.apellidos?.[0] || '');
    if (initialsEl) initialsEl.textContent = initials.toUpperCase();
  }

  // Si tiene foto de perfil
  if (currentUser.foto_url && avatarEl) {
    avatarEl.style.backgroundImage = `url('${currentUser.foto_url}')`;
    if (initialsEl) initialsEl.style.display = 'none';
  }
}

// ============================================================
// Dark Mode Toggle
// ============================================================
function initTheme() {
  const themeIcon = document.getElementById('themeIcon');
  const saved = localStorage.getItem('estairbnb_theme');
  if (saved === 'dark') {
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
}

// ============================================================
// Logout
// ============================================================
const btnLogoutGarajes = document.getElementById('btnLogout');
if (btnLogoutGarajes && !btnLogoutGarajes.dataset.bound) {
  btnLogoutGarajes.dataset.bound = '1';
  btnLogoutGarajes.addEventListener('click', () => {
    localStorage.removeItem(USUARIO_KEY);
    window.location.href = '/login.html';
  });
}

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

function pedirMotivoRechazo() {
  return new Promise((resolve) => {
    const existing = document.getElementById('rechazoReservaOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'rechazoReservaOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.62);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
      <div style="width:100%;max-width:460px;background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(15,23,42,.24);overflow:hidden;">
        <div style="padding:18px 20px 14px;border-bottom:1px solid #e2e8f0;">
          <div style="font-size:1rem;font-weight:800;color:#0f172a;">Motivo del rechazo</div>
          <div style="font-size:.82rem;color:#64748b;margin-top:4px;">Este mensaje se enviará al conductor para que sepa por qué no fue aceptada la reserva.</div>
        </div>
        <div style="padding:18px 20px;">
          <textarea id="rechazoReservaInput" rows="4" placeholder="Ej: El espacio no estará disponible en ese horario por un cierre temporal del garaje." style="width:100%;resize:vertical;border:1.5px solid #cbd5e1;border-radius:12px;padding:12px 14px;font:inherit;font-size:.9rem;color:#0f172a;outline:none;"></textarea>
          <div id="rechazoReservaError" style="display:none;margin-top:8px;font-size:.78rem;font-weight:700;color:#b91c1c;"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;padding:0 20px 18px;">
          <button type="button" id="btnCancelarRechazoReserva" style="padding:10px 16px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;color:#475569;font:inherit;font-size:.85rem;font-weight:700;cursor:pointer;">Cancelar</button>
          <button type="button" id="btnConfirmarRechazoReserva" style="padding:10px 16px;border-radius:12px;border:none;background:#b91c1c;color:#fff;font:inherit;font-size:.85rem;font-weight:700;cursor:pointer;">Rechazar reserva</button>
        </div>
      </div>
    `;

    const cleanup = (value) => {
      overlay.remove();
      resolve(value);
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) cleanup(null);
    });

    document.body.appendChild(overlay);

    const input = document.getElementById('rechazoReservaInput');
    const errorEl = document.getElementById('rechazoReservaError');
    const btnCancel = document.getElementById('btnCancelarRechazoReserva');
    const btnConfirm = document.getElementById('btnConfirmarRechazoReserva');

    if (input) input.focus();
    if (btnCancel) btnCancel.addEventListener('click', () => cleanup(null));
    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => {
        const motivo = input ? input.value.trim() : '';
        if (motivo.length < 5) {
          if (errorEl) {
            errorEl.textContent = 'Escribe un motivo de al menos 5 caracteres.';
            errorEl.style.display = 'block';
          }
          if (input) input.focus();
          return;
        }
        cleanup(motivo);
      });
    }
  });
}

// ============================================================
// Geolocalizacion del garaje
// ============================================================
function formatCoord(value) {
  return Number(value).toFixed(6);
}

function updateLocationStatus(targetEl, location, idleMessage) {
  if (!targetEl) return;
  const hasCoords = Number.isFinite(location?.lat) && Number.isFinite(location?.lng);
  targetEl.innerHTML = hasCoords
    ? `<i class="fa-solid fa-location-dot" style="margin-top:2px;"></i><span>Punto seleccionado: ${formatCoord(location.lat)}, ${formatCoord(location.lng)}${location.label ? `<br><small style="display:block;margin-top:4px;color:#475569;font-weight:600;">${escapeHTML(location.label)}</small>` : ''}</span>`
    : `<i class="fa-solid fa-location-dot" style="margin-top:2px;"></i><span>${idleMessage}</span>`;
}

function ensureBaseTileLayer(mapInstance) {
  if (!mapInstance || mapInstance._estairbnbHasTiles) return;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(mapInstance);
  mapInstance._estairbnbHasTiles = true;
}

function placeMapMarker(mapInstance, currentMarker, lat, lng, popupText) {
  if (!mapInstance) return currentMarker;
  if (!currentMarker) {
    currentMarker = L.marker([lat, lng], { draggable: false }).addTo(mapInstance);
  } else {
    currentMarker.setLatLng([lat, lng]);
  }
  if (popupText) currentMarker.bindPopup(popupText);
  return currentMarker;
}

async function updateDireccionFromReverseGeocode(inputEl, lat, lng) {
  if (!window.EstAirbnbMapUtils || !inputEl) return '';
  try {
    const result = await window.EstAirbnbMapUtils.reverseGeocode(lat, lng);
    if (!inputEl.value.trim()) inputEl.value = result.label;
    return result.label;
  } catch (_) {
    return '';
  }
}

function initGarajeLocationMap() {
  const mapEl = document.getElementById('garajeLocationMap');
  if (!mapEl || typeof L === 'undefined') return;

  if (!garajeMap) {
    garajeMap = L.map(mapEl, { zoomControl: true }).setView([DEFAULT_GARAJE_CENTER.lat, DEFAULT_GARAJE_CENTER.lng], 13);
    ensureBaseTileLayer(garajeMap);
    garajeMap.on('click', async (event) => {
      const lat = event.latlng.lat;
      const lng = event.latlng.lng;
      ubicacionGaraje = { lat, lng, label: '' };
      garajeMapMarker = placeMapMarker(garajeMap, garajeMapMarker, lat, lng, 'Ubicacion del garaje');
      const label = await updateDireccionFromReverseGeocode(inpDireccion, lat, lng);
      ubicacionGaraje.label = label || inpDireccion.value.trim();
      updateLocationStatus(ubicacionSeleccionadaText, ubicacionGaraje, 'Marca la ubicacion exacta del garaje. Puedes buscar por direccion o hacer clic manualmente sobre el mapa.');
    });
  }

  setTimeout(() => garajeMap.invalidateSize(), 120);
}

function initEditGarajeLocationMap() {
  const mapEl = document.getElementById('editGarajeLocationMap');
  if (!mapEl || typeof L === 'undefined') return;

  if (!editGarajeMap) {
    editGarajeMap = L.map(mapEl, { zoomControl: true }).setView([DEFAULT_GARAJE_CENTER.lat, DEFAULT_GARAJE_CENTER.lng], 13);
    ensureBaseTileLayer(editGarajeMap);
    editGarajeMap.on('click', async (event) => {
      const lat = event.latlng.lat;
      const lng = event.latlng.lng;
      ubicacionGarajeEdit = { lat, lng, label: '' };
      editGarajeMapMarker = placeMapMarker(editGarajeMap, editGarajeMapMarker, lat, lng, 'Ubicacion del garaje');
      const label = await updateDireccionFromReverseGeocode(document.getElementById('editDireccion'), lat, lng);
      ubicacionGarajeEdit.label = label || document.getElementById('editDireccion').value.trim();
      updateLocationStatus(editUbicacionSeleccionadaText, ubicacionGarajeEdit, 'Ajusta la ubicacion exacta del garaje para las rutas del conductor.');
    });
  }
}

function resetGarajeLocation() {
  ubicacionGaraje = { lat: null, lng: null, label: '' };
  if (garajeMapMarker && garajeMap) {
    garajeMap.removeLayer(garajeMapMarker);
    garajeMapMarker = null;
  }
  updateLocationStatus(
    ubicacionSeleccionadaText,
    ubicacionGaraje,
    'Marca la ubicacion exacta del garaje. Puedes buscar por direccion o hacer clic manualmente sobre el mapa.'
  );
  if (garajeMap) garajeMap.setView([DEFAULT_GARAJE_CENTER.lat, DEFAULT_GARAJE_CENTER.lng], 13);
}

function setGarajeLocationFromData(lat, lng, label) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !garajeMap) return;
  ubicacionGaraje = { lat, lng, label: label || inpDireccion.value.trim() };
  garajeMapMarker = placeMapMarker(garajeMap, garajeMapMarker, lat, lng, 'Ubicacion del garaje');
  garajeMap.setView([lat, lng], 16);
  updateLocationStatus(
    ubicacionSeleccionadaText,
    ubicacionGaraje,
    'Marca la ubicacion exacta del garaje. Puedes buscar por direccion o hacer clic manualmente sobre el mapa.'
  );
}

function setEditGarajeLocationFromData(lat, lng, label) {
  if (!editGarajeMap) return;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    ubicacionGarajeEdit = { lat: null, lng: null, label: '' };
    if (editGarajeMapMarker) {
      editGarajeMap.removeLayer(editGarajeMapMarker);
      editGarajeMapMarker = null;
    }
    updateLocationStatus(editUbicacionSeleccionadaText, ubicacionGarajeEdit, 'Ajusta la ubicacion exacta del garaje para las rutas del conductor.');
    editGarajeMap.setView([DEFAULT_GARAJE_CENTER.lat, DEFAULT_GARAJE_CENTER.lng], 13);
    return;
  }

  ubicacionGarajeEdit = { lat, lng, label: label || document.getElementById('editDireccion').value.trim() };
  editGarajeMapMarker = placeMapMarker(editGarajeMap, editGarajeMapMarker, lat, lng, 'Ubicacion del garaje');
  editGarajeMap.setView([lat, lng], 16);
  updateLocationStatus(editUbicacionSeleccionadaText, ubicacionGarajeEdit, 'Ajusta la ubicacion exacta del garaje para las rutas del conductor.');
}

async function geocodeIntoMap(inputEl, mapInstance, applyLocation) {
  const query = inputEl?.value?.trim();
  if (!query || query.length < 5) {
    showToast('Escribe una direccion valida antes de buscarla en el mapa.', 'error');
    inputEl?.focus();
    return;
  }
  if (!window.EstAirbnbMapUtils) {
    showToast('El modulo de mapas no esta disponible en este momento.', 'error');
    return;
  }

  const originalText = inputEl.value;
  const triggerButton = inputEl?.id === 'editDireccion' ? btnEditUbicarDireccionMapa : btnUbicarDireccionMapa;
  try {
    if (triggerButton) {
      triggerButton.disabled = true;
      triggerButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Buscando...';
    }
    const result = await window.EstAirbnbMapUtils.geocodeAddress(query);
    mapInstance?.setView([result.lat, result.lng], 16);
    applyLocation(result.lat, result.lng, result.label);
    showToast('Ubicacion encontrada y marcada en el mapa.');
  } catch (err) {
    console.error('Error geocodificando direccion:', err);
    showToast('No se pudo ubicar esa direccion exacta. Corrige el texto o usa "Ubicarme" y marca manualmente.', 'error');
  } finally {
    if (triggerButton) {
      triggerButton.disabled = false;
      triggerButton.innerHTML = '<i class="fa-solid fa-magnifying-glass-location"></i> Buscar direccion en el mapa';
      if (triggerButton === btnEditUbicarDireccionMapa) {
        triggerButton.innerHTML = '<i class="fa-solid fa-magnifying-glass-location"></i> Buscar direccion';
      }
    }
    if (inputEl.value !== originalText && !inputEl.value.trim()) {
      inputEl.value = originalText;
    }
  }
}

function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalizacion no soportada'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 15000,
      ...options,
    });
  });
}

async function centerMapToCurrentLocation(mapInstance, inputEl, applyLocation, buttonEl) {
  if (!mapInstance || typeof applyLocation !== 'function') return;
  try {
    if (buttonEl) {
      buttonEl.disabled = true;
      buttonEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ubicando...';
    }
    const position = await getCurrentPosition();
    const lat = Number(position.coords.latitude);
    const lng = Number(position.coords.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Coordenadas invalidas');
    mapInstance.setView([lat, lng], 17);
    const label = await updateDireccionFromReverseGeocode(inputEl, lat, lng);
    applyLocation(lat, lng, label || inputEl?.value?.trim() || 'Ubicacion actual');
    showToast('Tu ubicacion actual fue marcada en el mapa.');
  } catch (err) {
    console.error('Error ubicando posicion actual:', err);
    showToast('No se pudo obtener tu ubicacion actual. Revisa permisos del navegador.', 'error');
  } finally {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Ubicarme';
    }
  }
}

function initLocationPickers() {
  initGarajeLocationMap();
  initEditGarajeLocationMap();
  updateLocationStatus(
    ubicacionSeleccionadaText,
    ubicacionGaraje,
    'Marca la ubicacion exacta del garaje. Puedes buscar por direccion o hacer clic manualmente sobre el mapa.'
  );
  updateLocationStatus(
    editUbicacionSeleccionadaText,
    ubicacionGarajeEdit,
    'Ajusta la ubicacion exacta del garaje para las rutas del conductor.'
  );

  if (btnUbicarDireccionMapa && !btnUbicarDireccionMapa.dataset.bound) {
    btnUbicarDireccionMapa.dataset.bound = '1';
    btnUbicarDireccionMapa.addEventListener('click', () => {
      geocodeIntoMap(inpDireccion, garajeMap, (lat, lng, label) => setGarajeLocationFromData(lat, lng, label));
    });
  }

  if (btnLimpiarUbicacionMapa && !btnLimpiarUbicacionMapa.dataset.bound) {
    btnLimpiarUbicacionMapa.dataset.bound = '1';
    btnLimpiarUbicacionMapa.addEventListener('click', resetGarajeLocation);
  }

  if (btnUbicarmeMapa && !btnUbicarmeMapa.dataset.bound) {
    btnUbicarmeMapa.dataset.bound = '1';
    btnUbicarmeMapa.addEventListener('click', () => {
      centerMapToCurrentLocation(
        garajeMap,
        inpDireccion,
        (lat, lng, label) => setGarajeLocationFromData(lat, lng, label),
        btnUbicarmeMapa
      );
    });
  }

  if (btnEditUbicarDireccionMapa && !btnEditUbicarDireccionMapa.dataset.bound) {
    btnEditUbicarDireccionMapa.dataset.bound = '1';
    btnEditUbicarDireccionMapa.addEventListener('click', () => {
      geocodeIntoMap(
        document.getElementById('editDireccion'),
        editGarajeMap,
        (lat, lng, label) => setEditGarajeLocationFromData(lat, lng, label)
      );
    });
  }

  if (btnEditLimpiarUbicacionMapa && !btnEditLimpiarUbicacionMapa.dataset.bound) {
    btnEditLimpiarUbicacionMapa.dataset.bound = '1';
    btnEditLimpiarUbicacionMapa.addEventListener('click', () => {
      setEditGarajeLocationFromData(null, null, '');
    });
  }

  if (btnEditUbicarmeMapa && !btnEditUbicarmeMapa.dataset.bound) {
    btnEditUbicarmeMapa.dataset.bound = '1';
    btnEditUbicarmeMapa.addEventListener('click', () => {
      centerMapToCurrentLocation(
        editGarajeMap,
        document.getElementById('editDireccion'),
        (lat, lng, label) => setEditGarajeLocationFromData(lat, lng, label),
        btnEditUbicarmeMapa
      );
    });
  }

  document.addEventListener('estairbnb:wizard-opened', () => {
    initGarajeLocationMap();
    if (Number.isFinite(ubicacionGaraje.lat) && Number.isFinite(ubicacionGaraje.lng)) {
      setGarajeLocationFromData(ubicacionGaraje.lat, ubicacionGaraje.lng, ubicacionGaraje.label);
    }
  });
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
// TILEMAP 2D EDITOR ENGINE
// ============================================================
function initTilemap() {
  tmGenerarGrilla(tmFilasVal, tmColsVal);

  // Tool selection
  document.querySelectorAll('.tm-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tm-tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tmPincel = btn.dataset.tool;
      // Show vehicle selector only when painting parking
      const sel = document.getElementById('tmVehicleSelector');
      if (sel) sel.style.opacity = tmPincel === 'parking' ? '1' : '0.22';
      // Update active tool name banner
      const toolNames = { parking:'Parqueo', wall:'Pared', entrance:'Entrada', exit:'Salida', aisle:'Carril', eraser:'Borrar' };
      const nameEl = document.getElementById('tmActiveToolName');
      if (nameEl) nameEl.textContent = toolNames[tmPincel] || tmPincel;
    });
  });

  // Regenerate grid
  if (btnTmGenerar) {
    btnTmGenerar.addEventListener('click', () => {
      const f = Math.min(Math.max(parseInt(tmFilas.value, 10) || 6, 3), 12);
      const c = Math.min(Math.max(parseInt(tmColumnas.value, 10) || 8, 3), 12);
      tmFilasVal = f; tmColsVal = c;
      tmGenerarGrilla(f, c);
    });
  }

  // Clear all
  if (btnTmLimpiar) {
    btnTmLimpiar.addEventListener('click', () => {
      tmMatriz = tmMatriz.map(fila => fila.map(() => ({ tile: 'empty', tipo_vehiculo: 'auto' })));
      tmRenderGrilla();
      tmActualizarStats();
    });
  }

  // Presets
  document.querySelectorAll('.tm-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tmAplicarPreset(btn.dataset.preset, tmFilasVal, tmColsVal);
    });
  });

  // Drag painting
  document.addEventListener('mouseup', () => { tmIsPainting = false; });
  document.addEventListener('touchend', () => { tmIsPainting = false; });
}

const VICO = {
  auto:      { icon: 'directions_car', color: '#2563eb', sz: '18px' },
  moto:      { icon: 'two_wheeler',    color: '#d97706', sz: '16px' },
  camioneta: { icon: 'local_shipping', color: '#475569', sz: '18px' },
  suv:       { icon: 'local_shipping', color: '#475569', sz: '18px' }
};

function tmGenerarGrilla(filas, cols) {
  tmMatriz = [];
  for (let f = 0; f < filas; f++) {
    tmMatriz[f] = [];
    for (let c = 0; c < cols; c++) {
      tmMatriz[f][c] = { tile: 'empty', tipo_vehiculo: 'auto', adir: 'h', num: 0 };
    }
  }
  tmRenderGrilla();
  tmActualizarStats();
}

function renderCellEl(cell, cellData) {
  cell.setAttribute('data-t', cellData.tile);
  cell.innerHTML = '';
  if (cellData.tile === 'parking') {
    const v = VICO[cellData.tipo_vehiculo] || VICO.auto;
    const top = document.createElement('div');
    top.className = 'gc-ico';
    top.style.cssText = `color:${v.color};display:flex;align-items:center;justify-content:center`;
    top.innerHTML = `<span class="material-symbols-outlined" style="font-size:${v.sz};">${v.icon}</span>`;
    const num = document.createElement('div');
    num.className = 'gc-num';
    num.textContent = 'A' + (cellData.num || '');
    cell.appendChild(top); cell.appendChild(num);
  } else if (cellData.tile === 'entrance') {
    cell.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M10 5l3 3-3 3" stroke="#10b981" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="gc-lbl" style="color:#10b981">ENT</div>';
  } else if (cellData.tile === 'exit') {
    cell.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M6 5L3 8l3 3" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="gc-lbl" style="color:#ef4444">SAL</div>';
  } else if (cellData.tile === 'wall') {
    cell.innerHTML = '<div style="font-size:8px;color:rgba(255,255,255,0.15);font-weight:700;letter-spacing:0.05em">▪▪▪</div>';
  } else if (cellData.tile === 'aisle') {
    const inner = document.createElement('div');
    inner.className = 'gc-aisle-inner';
    if (cellData.adir === 'cross') {
      const cross = document.createElement('div'); cross.className = 'gc-aisle-cross'; inner.appendChild(cross);
    } else if (cellData.adir === 'v') {
      const bar = document.createElement('div'); bar.className = 'gc-aisle-v'; inner.appendChild(bar);
    } else {
      const bar = document.createElement('div'); bar.className = 'gc-aisle-h'; inner.appendChild(bar);
    }
    cell.appendChild(inner);
  }
}

function renderCellEl(cell, cellData) {
  cell.setAttribute('data-t', cellData.tile);
  cell.innerHTML = '';
  cell.title = '';

  if (cellData.tile === 'parking') {
    const v = VICO[cellData.tipo_vehiculo] || VICO.auto;
    const top = document.createElement('div');
    top.className = 'gc-ico';
    top.style.cssText = `color:${v.color};display:flex;align-items:center;justify-content:center`;
    top.innerHTML = `<span class="material-symbols-outlined" style="font-size:${v.sz};">${v.icon}</span>`;

    const num = document.createElement('div');
    num.className = 'gc-num';
    num.textContent = 'A' + (cellData.num || '');
    cell.title = `Parqueo A${cellData.num || ''}`;
    cell.appendChild(top);
    cell.appendChild(num);
    return;
  }

  if (cellData.tile === 'entrance') {
    cell.title = 'Entrada';
    cell.innerHTML = '<span class="material-symbols-outlined gc-symbol">login</span><div class="gc-lbl">Entrada</div>';
    return;
  }

  if (cellData.tile === 'exit') {
    cell.title = 'Salida';
    cell.innerHTML = '<span class="material-symbols-outlined gc-symbol">logout</span><div class="gc-lbl">Salida</div>';
    return;
  }

  if (cellData.tile === 'wall') {
    cell.title = 'Pared';
    cell.innerHTML = '<span class="material-symbols-outlined gc-symbol">density_large</span><div class="gc-lbl">Pared</div>';
    return;
  }

  if (cellData.tile === 'aisle') {
    cell.title = 'Carril de circulacion';
    const inner = document.createElement('div');
    inner.className = 'gc-aisle-inner';
    if (cellData.adir === 'cross') {
      const cross = document.createElement('div');
      cross.className = 'gc-aisle-cross';
      inner.appendChild(cross);
    } else if (cellData.adir === 'v') {
      const bar = document.createElement('div');
      bar.className = 'gc-aisle-v';
      inner.appendChild(bar);
    } else {
      const bar = document.createElement('div');
      bar.className = 'gc-aisle-h';
      inner.appendChild(bar);
    }
    cell.appendChild(inner);
  }
}

function updateAisleNeighbors(r, c) {
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const R = tmMatriz.length, C = tmMatriz[0].length;
  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
    if (tmMatriz[nr][nc].tile === 'aisle') {
      tmMatriz[nr][nc].adir = computeAisleDirFromNeighbors(nr, nc);
      const el = document.querySelector(`#tmGrid .gc[data-fila="${nr}"][data-col="${nc}"]`);
      if (el) renderCellEl(el, tmMatriz[nr][nc]);
    }
  }
}

function computeAisleDirFromNeighbors(r, c) {
  const R = tmMatriz.length, C = tmMatriz[0].length;
  const hasN = r > 0 && tmMatriz[r-1][c].tile === 'aisle';
  const hasS = r < R-1 && tmMatriz[r+1][c].tile === 'aisle';
  const hasE = c < C-1 && tmMatriz[r][c+1].tile === 'aisle';
  const hasW = c > 0 && tmMatriz[r][c-1].tile === 'aisle';
  const v = hasN || hasS, h = hasE || hasW;
  if (v && h) return 'cross';
  if (v) return 'v';
  return 'h';
}

function tmRenderGrilla() {
  if (!tmGrid) return;
  tmGrid.innerHTML = '';
  const filas = tmMatriz.length;
  const cols  = filas > 0 ? tmMatriz[0].length : 0;
  tmGrid.style.gridTemplateColumns = `repeat(${cols}, minmax(58px, 1fr))`;

  let parkingCounter = 1;
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      if (tmMatriz[f][c].tile === 'parking') {
        tmMatriz[f][c].num = parkingCounter++;
      }
      const cell = document.createElement('div');
      cell.className = 'gc';
      cell.dataset.fila = f;
      cell.dataset.col  = c;

      renderCellEl(cell, tmMatriz[f][c]);

      cell.addEventListener('mousedown', (e) => {
        e.preventDefault();
        tmIsPainting = true;
        tmPintarCelda(f, c);
      });
      cell.addEventListener('mouseover', () => {
        if (tmIsPainting) {
          tmPintarCelda(f, c);
        }
      });
      cell.addEventListener('touchstart', (e) => {
        e.preventDefault();
        tmIsPainting = true;
        tmPintarCelda(f, c);
      }, { passive: false });
      cell.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (el && el.dataset.fila !== undefined) {
          const nf = parseInt(el.dataset.fila);
          const nc = parseInt(el.dataset.col);
          tmPintarCelda(nf, nc);
        }
      }, { passive: false });

      tmGrid.appendChild(cell);
    }
  }
}

function tmPintarCelda(f, c) {
  const tipoVehiculo = document.getElementById('tmTipoVehiculo')?.value || 'auto';
  const old = tmMatriz[f][c];
  
  if (old.tile === tmPincel && old.tipo_vehiculo === tipoVehiculo && tmPincel !== 'parking') {
    return;
  }
  
  let num = old.num, adir = 'h';
  
  if (tmPincel === 'eraser') {
    tmMatriz[f][c] = { tile: 'empty', tipo_vehiculo: 'auto', num: 0, adir: 'h' };
  } else {
    tmMatriz[f][c] = { tile: tmPincel, tipo_vehiculo: tipoVehiculo, num, adir: 'h' };
  }
  
  if (tmPincel === 'aisle') {
    tmMatriz[f][c].adir = computeAisleDirFromNeighbors(f, c);
  }
  
  const el = document.querySelector(`#tmGrid .gc[data-fila="${f}"][data-col="${c}"]`);
  if (el) renderCellEl(el, tmMatriz[f][c]);
  
  if (tmPincel === 'aisle' || tmPincel === 'eraser' || old.tile === 'aisle') {
    updateAisleNeighbors(f, c);
  }
  
  if (tmPincel === 'parking' || old.tile === 'parking') {
    tmRenderGrilla(); 
  }
  
  tmActualizarStats();
  if (tilemapError) tilemapError.classList.add('hidden');
}

function tmActualizarStats() {
  let parkCount = 0; let total = 0;
  tmMatriz.forEach(fila => fila.forEach(cell => {
    if (cell.tile !== 'empty') total++;
    if (cell.tile === 'parking') parkCount++;
  }));
  if (tmCountParking) tmCountParking.textContent = parkCount;
  if (tmCountTotal) tmCountTotal.textContent = total;
}

function tmAplicarPreset(preset, filas, cols) {
  const currentCount = parseInt(tmCountParking?.textContent, 10) || 4;
  const cap = parseInt(document.getElementById('wzCapNumber')?.textContent, 10) || currentCount;
  let generated = null;
  if (preset === 'linea' && typeof autoGenerarLinea === 'function') generated = autoGenerarLinea(cap);
  if (preset === 'ele' && typeof autoGenerarEle === 'function') generated = autoGenerarEle(cap);
  if (preset === 'patio' && typeof autoGenerarPatio === 'function') generated = autoGenerarPatio(cap);
  if (generated) {
    tmFilasVal = generated.rows;
    tmColsVal = generated.cols;
    tmMatriz = generated.matrix;
    if (tmFilas) tmFilas.value = generated.rows;
    if (tmColumnas) tmColumnas.value = generated.cols;
    tmRenderGrilla();
    tmActualizarStats();
    return;
  }

  tmGenerarGrilla(filas, cols); 
  const halfway = Math.floor(cols / 2);

  if (preset === 'linea') {
    for (let c = 0; c < cols; c++) {
      if (c !== halfway) { tmMatriz[0][c].tile = 'parking'; tmMatriz[filas-1][c].tile = 'parking'; }
    }
    for (let c = 0; c < cols; c++) tmMatriz[Math.floor(filas/2)][c] = { tile: 'aisle', adir: 'h', tipo_vehiculo:'auto', num:0 };
    tmMatriz[0][0].tile = 'entrance';
    tmMatriz[filas-1][cols-1].tile = 'exit';
  } else if (preset === 'ele') {
    for (let c = 0; c < cols; c++) tmMatriz[0][c].tile = 'parking';
    for (let f = 1; f < filas; f++) tmMatriz[f][0].tile = 'parking';
    for (let c = 1; c < cols; c++) tmMatriz[1][c] = {tile:'aisle', adir:'h', tipo_vehiculo:'auto', num:0};
    for (let f = 2; f < filas; f++) tmMatriz[f][1] = {tile:'aisle', adir:'v', tipo_vehiculo:'auto', num:0};
    tmMatriz[1][1].adir = 'cross';
    tmMatriz[0][0].tile = 'entrance';
    tmMatriz[filas-1][cols-1].tile = 'exit';
  } else if (preset === 'patio') {
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        if (f === 0 || f === filas-1 || c === 0 || c === cols-1) {
          tmMatriz[f][c].tile = 'wall';
        } else if (c === halfway) {
          tmMatriz[f][c] = {tile:'aisle', adir:'v', tipo_vehiculo:'auto', num:0};
        } else {
          tmMatriz[f][c].tile = 'parking';
        }
      }
    }
    tmMatriz[0][halfway].tile = 'entrance';
    tmMatriz[filas-1][halfway].tile = 'exit';
  }

  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      if (tmMatriz[f][c].tile === 'aisle') tmMatriz[f][c].adir = computeAisleDirFromNeighbors(f, c);
    }
  }

  tmRenderGrilla();
  tmActualizarStats();
}

function exportarMapa() {
  const espacios = [];
  tmMatriz.forEach((fila, f) => {
    fila.forEach((cell, c) => {
      if (cell.tile === 'parking') {
        espacios.push({
          numero_espacio: `A${cell.num}`,
          tipo_vehiculo: cell.tipo_vehiculo || 'auto',
          fila: f + 1,
          columna: c + 1
        });
      }
    });
  });
  return { matriz: tmMatriz, espacios };
}

// ============================================================
// Horarios Flexibles Builder
// ============================================================
function initHorariosBuilder() {
  const mapDias = {1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 0: 'Dom'};

  function renderHorarios() {
    horariosContainer.innerHTML = '';
    horariosConfigurados.forEach((horario, idx) => {
      const diasLabels = horario.dias.map(d => mapDias[d]).join(', ');
      const div = document.createElement('div');
      div.className = 'wz-horario-tag';

      if (horario._auto) {
        div.innerHTML = `
          <div>
            <span class="days"><i class="fa-solid fa-clock" style="margin-right:4px;color:#006a62"></i>Todos los días</span><br>
            <span class="time"><i class="fa-regular fa-clock" style="margin-right:4px"></i>00:00 — 23:59</span>
          </div>
          <span style="font-size:0.7rem;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:20px;white-space:nowrap">24/7 Auto</span>
        `;
      } else {
        div.innerHTML = `
          <div>
            <span class="days"><i class="fa-regular fa-calendar" style="margin-right:4px"></i>${diasLabels}</span><br>
            <span class="time"><i class="fa-regular fa-clock" style="margin-right:4px"></i>${horario.inicio} — ${horario.fin}</span>
          </div>
          <div style="display:flex;gap:6px">
            <button type="button" class="edit-h" onclick="editarHorario(${idx})" title="Editar">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button type="button" class="remove-h" onclick="eliminarHorario(${idx})" title="Eliminar">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `;
      }
      horariosContainer.appendChild(div);
    });

    if (horariosConfigurados.length > 0 && horariosError) {
      horariosError.classList.add('hidden');
    }
  }

  window.eliminarHorario = function(idx) {
    horariosConfigurados.splice(idx, 1);
    renderHorarios();
  };

  window.editarHorario = function(idx) {
    const h = horariosConfigurados[idx];
    document.querySelectorAll('input[name="diasHorario"]').forEach(cb => {
      cb.checked = h.dias.includes(parseInt(cb.value, 10));
    });
    if (inpHorarioDesde) inpHorarioDesde.value = h.inicio;
    if (inpHorarioHasta) inpHorarioHasta.value = h.fin;
    horariosConfigurados.splice(idx, 1);
    renderHorarios();
    btnAgregarHorario?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // Vinculo Acceso 24h → bloquea el builder y agrega horario automático
  const chk24h = document.querySelector('input[value="acceso_24h"]');
  const builder = document.getElementById('wzHorarioBuilder');
  const banner = document.getElementById('hz24hBanner');

  window.desactivar24h = function() {
    if (chk24h) chk24h.checked = false;
    horariosConfigurados = horariosConfigurados.filter(h => !h._auto);
    if (builder) { builder.style.pointerEvents = ''; builder.style.opacity = ''; }
    if (banner) banner.style.display = 'none';
    renderHorarios();
  };

  if (chk24h) {
    chk24h.addEventListener('change', function() {
      if (this.checked) {
        horariosConfigurados = horariosConfigurados.filter(h => !h._auto);
        horariosConfigurados.push({ dias: [0,1,2,3,4,5,6], inicio: '00:00', fin: '23:59', _auto: true });
        if (builder) { builder.style.pointerEvents = 'none'; builder.style.opacity = '0.45'; }
        if (banner) banner.style.display = 'flex';
        renderHorarios();
      } else {
        window.desactivar24h();
      }
    });
  }

  if (btnAgregarHorario) {
    btnAgregarHorario.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('input[name="diasHorario"]:checked');
      const dias = Array.from(checkboxes).map(cb => parseInt(cb.value, 10));
      const inicio = inpHorarioDesde.value;
      const fin = inpHorarioHasta.value;

      if (dias.length === 0) {
        showToast('Selecciona al menos un día de la semana.', 'error');
        return;
      }
      if (!inicio || !fin || inicio >= fin) {
        showToast('La hora de inicio debe ser anterior a la hora de cierre.', 'error');
        return;
      }

      let superposicion = false;
      for (const h of horariosConfigurados) {
        const diasEnComun = dias.filter(d => h.dias.includes(d));
        if (diasEnComun.length > 0 && inicio < h.fin && fin > h.inicio) {
          superposicion = true;
          break;
        }
      }

      if (superposicion) {
        showToast('El horario se superpone con uno ya existente para esos días.', 'error');
        return;
      }

      horariosConfigurados.push({ dias, inicio, fin });
      checkboxes.forEach(cb => cb.checked = false);
      renderHorarios();
    });
  }
}

function wzPresetDias(preset) {
  const mapPreset = { lv: [1,2,3,4,5], ls: [1,2,3,4,5,6], todos: [0,1,2,3,4,5,6], finde: [0,6] };
  const vals = mapPreset[preset] || [];
  document.querySelectorAll('input[name="diasHorario"]').forEach(cb => {
    cb.checked = vals.includes(parseInt(cb.value, 10));
  });
}

function wzPresetHora(desde, hasta) {
  const d = document.getElementById('inpHorarioDesde');
  const h = document.getElementById('inpHorarioHasta');
  if (d) d.value = desde;
  if (h) h.value = hasta;
}

// ============================================================
// Publicar Garaje — POST /api/garajes
// ============================================================
function initFormSubmit() {
  const formGarajeEl = document.getElementById('formGaraje');
  if (!formGarajeEl) return;

  formGarajeEl.addEventListener('submit', async (e) => {
  e.preventDefault();

  const direccion     = inpDireccion.value.trim();
  const descripcion   = inpDescripcion.value.trim();
  const precio_hora   = inpPrecio.value;
  const ubicacionValida = Number.isFinite(ubicacionGaraje.lat) && Number.isFinite(ubicacionGaraje.lng);

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
  if (!ubicacionValida) {
    showToast('Marca la ubicacion exacta del garaje en el mapa antes de publicarlo.', 'error');
    initGarajeLocationMap();
    return;
  }

  // Auto-generate map if no spots were manually placed
  let parkCheck = 0;
  tmMatriz.forEach(f => f.forEach(c => { if (c.tile === 'parking') parkCheck++; }));
  if (parkCheck === 0 && typeof aplicarAutoPlano === 'function') {
    aplicarAutoPlano();
  }

  // Collect data from Tilemap
  const { matriz, espacios } = exportarMapa();
  espaciosConfigurados = espacios;

  if (espaciosConfigurados.length === 0) {
    if (tilemapError) { tilemapError.style.display = 'block'; }
    showToast('Debes colocar al menos un espacio de parqueo (🟩) en el mapa.', 'error');
    return;
  }
  if (tilemapError) { tilemapError.style.display = 'none'; }

  if (horariosConfigurados.length === 0) {
    horariosError.classList.remove('hidden');
    showToast('Debes agregar al menos un horario de disponibilidad.', 'error');
    return;
  }

  // Recopilar comodidades seleccionadas
  const comodidades = Array.from(document.querySelectorAll('input[name="comodidad"]:checked')).map(cb => cb.value);

  // Construir FormData
  const formData = new FormData();
  formData.append('usuario_id', currentUser.id);
  formData.append('direccion', direccion);
  formData.append('latitud', ubicacionGaraje.lat);
  formData.append('longitud', ubicacionGaraje.lng);
  formData.append('descripcion', descripcion);
  formData.append('precio_hora', precio_hora);
  // Enviamos datos por defecto para los campos legacy, y el JSON real en horarios_flexibles
  formData.append('hora_apertura', horariosConfigurados[0]?.inicio || '00:00');
  formData.append('hora_cierre', horariosConfigurados[0]?.fin || '23:59');
  formData.append('dias_operativos', 'Flexible');
  formData.append('horarios_flexibles', JSON.stringify(horariosConfigurados));
  formData.append('layout_mapa', JSON.stringify(matriz));
  formData.append('nivel_seguridad', inpNivelSeguridad.value || 'Estándar');
  formData.append('metodo_acceso', inpMetodoAcceso.value || 'Manual');
  formData.append('instrucciones_acceso', inpInstrucciones.value || '');
  formData.append('espacios', JSON.stringify(espaciosConfigurados));
  formData.append('comodidades', JSON.stringify(comodidades));

  // Datos de Confianza
  const _dA = document.getElementById('inpDimAltura')?.value;
  const _dW = document.getElementById('inpDimAncho')?.value;
  const _dL = document.getElementById('inpDimLargo')?.value;
  const _dims = [_dA && `${_dA}m`, _dW && `${_dW}m`, _dL && `${_dL}m`].filter(Boolean).join(' × ');
  formData.append('dimensiones', _dims);
  formData.append('reglas_casa', document.getElementById('inpReglas')?.value || '');
  formData.append('politica_cancelacion', document.getElementById('inpPolitica')?.value || '');

  // Fidelidad
  const fidActivo = document.getElementById('inpFidelidadActivo')?.checked ? 'true' : 'false';
  formData.append('fidelidad_activo', fidActivo);
  formData.append('fidelidad_visitas', document.getElementById('inpFidelidadVisitas')?.value || '10');
  formData.append('fidelidad_descuento_pct', document.getElementById('inpFidelidadDescuento')?.value || '10');
  formData.append('fidelidad_dias_validez', document.getElementById('inpFidelidadValidez')?.value || '');

  // Adjuntar archivos
  selectedFiles.forEach(file => {
    formData.append('fotos', file);
  });

  // UI: desactivar botón
  const btnSubmit = document.getElementById('btnWizardSubmit');
  const origHTML = btnSubmit ? btnSubmit.innerHTML : '';
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Publicando...`;
  }

  try {
    const res = await fetch('/api/garajes', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      showToast(data.message || '¡Espacio publicado exitosamente!');
      closeWizard();

      // Limpiar formulario
      formGaraje.reset();
      selectedFiles = [];
      photoPreviewGrid.innerHTML = '';
      espaciosConfigurados = [];
      resetGarajeLocation();
      // Reset Tilemap
      tmGenerarGrilla(6, 8);
      if (tmFilas) tmFilas.value = 6;
      if (tmColumnas) tmColumnas.value = 8;
      // Reset loyalty
      const fidChk = document.getElementById('inpFidelidadActivo');
      const fidCfg = document.getElementById('fidelidadConfig');
      if (fidChk) fidChk.checked = false;
      if (fidCfg) fidCfg.style.display = 'none';

      // Recargar lista de garajes
      await cargarMisGarajes();
    } else {
      showToast(data.message || 'Error al publicar el espacio.', 'error');
    }

  } catch (err) {
    console.error('Error al publicar:', err);
    showToast('No se pudo conectar con el servidor.', 'error');
  } finally {
    const btn = document.getElementById('btnWizardSubmit');
    if (btn) { btn.disabled = false; btn.innerHTML = origHTML; }
  }
  }); // end formGarajeEl.addEventListener
} // end initFormSubmit

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

      // Update tab badge
      const tabBadge = document.getElementById('tabBadgeGarajes');
      if (tabBadge && total > 0) { tabBadge.textContent = total; tabBadge.style.display = 'inline-block'; }

      // Cache garajes for edit modal
      _garajesCache = garajes;

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
// Crear Tarjeta de Garaje (DOM) con diseño Tailwind
// ============================================================
function crearTarjetaGaraje(garaje) {
  const card = document.createElement('div');
  card.className = 'host-garaje-card';
  card.id = `garaje-${garaje.id}`;

  const activo = garaje.estado_activo;
  const tipoIconos = {
    auto: 'directions_car',
    moto: 'two_wheeler',
    camioneta: 'local_shipping',
  };
  const iconText = tipoIconos[garaje.tipo_vehiculo] || 'directions_car';
  const direccionPrincipal = escapeHTML((garaje.direccion || '').split(',')[0] || garaje.direccion || '');
  const horarioResumen = (() => {
    if (garaje.horarios_flexibles) {
      try {
        const horarios = JSON.parse(garaje.horarios_flexibles);
        if (Array.isArray(horarios) && horarios.length > 0) {
          const first = horarios[0];
          return `Flexible · ${first.inicio || '--:--'}-${first.fin || '--:--'}`;
        }
      } catch (_) {}
      return 'Horario flexible';
    }
    if (garaje.hora_apertura && garaje.hora_cierre) {
      return `${String(garaje.hora_apertura).substring(0, 5)} - ${String(garaje.hora_cierre).substring(0, 5)}`;
    }
    return 'Horario no especificado';
  })();

  const fotoHTML = garaje.foto_principal
    ? `<img src="${garaje.foto_principal}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Foto del parqueo" loading="lazy">`
    : `<div class="w-full h-full flex flex-col items-center justify-center bg-surface-container-highest text-on-surface-variant opacity-70">
         <span class="material-symbols-outlined text-4xl mb-2">image</span>
         <span class="font-label text-xs uppercase tracking-widest">Sin foto</span>
       </div>`;

  card.innerHTML = `
    <div class="relative aspect-video w-full overflow-hidden">
      ${fotoHTML}
      <div class="absolute top-4 right-4 bg-surface-container-lowest/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
        <div class="w-2 h-2 rounded-full ${activo ? 'bg-[#006a62]' : 'bg-outline-variant'}"></div>
        <span class="font-label text-[10px] uppercase font-bold ${activo ? 'text-secondary' : 'text-on-surface-variant'} tracking-wider">${activo ? 'Activo' : 'Inactivo'}</span>
      </div>
    </div>
    <div class="p-6 flex flex-col flex-grow">
      <div class="flex justify-between items-start mb-4 gap-2">
        <div class="flex-1 min-w-0">
          <h3 class="font-headline font-bold text-lg text-primary mb-1 truncate">${escapeHTML(garaje.direccion)}</h3>
          <p class="text-on-surface-variant text-sm font-body truncate flex items-center gap-1">
            <span class="material-symbols-outlined text-base">location_on</span>
            ${escapeHTML(garaje.direccion.split(',')[0])}
          </p>
        </div>
        <div class="text-right flex-shrink-0">
          <span class="block font-headline font-bold text-lg text-primary">Bs. ${Number(garaje.precio_hora).toFixed(2)}</span>
          <span class="text-[10px] text-on-surface-variant uppercase tracking-wider font-label">/ hora</span>
        </div>
      </div>
      
      <div class="flex items-center gap-4 mb-4 text-sm text-on-surface-variant font-body bg-surface-container-low p-3 rounded-lg">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-secondary">${iconText}</span>
          <span class="capitalize font-medium">${garaje.tipo_vehiculo}</span>
        </div>
        ${garaje.descripcion ? `
        <div class="w-px h-4 bg-outline-variant/30"></div>
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="truncate text-xs opacity-80">${escapeHTML(garaje.descripcion)}</span>
        </div>
        ` : ''}
      </div>
      ${garaje.fidelidad_activo ? `
      <div style="display:flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:600;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:4px 10px;margin-bottom:12px;">
        <i class="fa-solid fa-medal" style="color:#f59e0b"></i>
        Fidelidad activa: ${garaje.fidelidad_visitas} visitas → ${garaje.fidelidad_descuento_pct}% dto.
      </div>` : ''}
      
      <div class="mt-auto pt-4 border-t border-outline-variant/10 flex flex-col gap-2">
        <button class="btn-edit-garaje" data-garaje-id="${garaje.id}" onclick="abrirEditModalById(this.dataset.garajeId)">
            <span class="material-symbols-outlined" style="font-size:15px;">edit</span> Editar Información
        </button>
        <button class="w-full text-center text-primary font-label uppercase text-xs tracking-wider font-bold py-2 hover:bg-surface-container-low rounded-md transition-colors flex items-center justify-center gap-2" onclick="window.location.href='/panel-mantenimiento.html?id=${garaje.id}'">
            <span class="material-symbols-outlined text-sm">build</span> Administrar Espacios
        </button>
        <button class="w-full text-center font-label uppercase text-xs tracking-wider font-bold py-2 hover:bg-surface-container-low rounded-md transition-colors flex items-center justify-center gap-2 ${activo ? 'text-error hover:bg-error-container/20' : 'text-secondary'}"
                onclick="toggleEstado(${garaje.id}, this)" id="btnEstado-${garaje.id}">
            <span class="material-symbols-outlined text-sm">${activo ? 'visibility_off' : 'visibility'}</span>
            ${activo ? 'Desactivar Listado' : 'Activar Listado'}
        </button>
      </div>
    </div>
  `;

  return card;
}

// ============================================================
// Toggle Estado — PUT /api/garajes/:id/estado
// ============================================================
// Reemplazo moderno de la tarjeta de garaje
function crearTarjetaGaraje(garaje) {
  const card = document.createElement('div');
  card.className = 'host-garaje-card';
  card.id = `garaje-${garaje.id}`;

  const activo = !!garaje.estado_activo;
  const direccionPrincipal = escapeHTML((garaje.direccion || '').split(',')[0] || garaje.direccion || '');
  const tipoLabel = (garaje.tipo_vehiculo || 'auto').toString();
  const horarioResumen = (() => {
    if (garaje.horarios_flexibles) {
      try {
        const horarios = JSON.parse(garaje.horarios_flexibles);
        if (Array.isArray(horarios) && horarios.length > 0) {
          const first = horarios[0];
          return `Flexible · ${first.inicio || '--:--'}-${first.fin || '--:--'}`;
        }
      } catch (_) {}
      return 'Horario flexible';
    }
    if (garaje.hora_apertura && garaje.hora_cierre) {
      return `${String(garaje.hora_apertura).substring(0, 5)} - ${String(garaje.hora_cierre).substring(0, 5)}`;
    }
    return 'Horario no especificado';
  })();

  const fotoHTML = garaje.foto_principal
    ? `<img src="${garaje.foto_principal}" class="w-full h-full object-cover transition-transform duration-500" alt="Foto del parqueo" loading="lazy">`
    : `<div class="w-full h-full flex flex-col items-center justify-center bg-surface-container-highest text-on-surface-variant opacity-70">
         <span class="material-symbols-outlined text-4xl mb-2">image</span>
         <span class="font-label text-xs uppercase tracking-widest">Sin foto</span>
       </div>`;

  card.innerHTML = `
    <div class="host-garaje-media">
      ${fotoHTML}
      <div class="host-garaje-overlay"></div>
      <div class="host-garaje-topbar">
        <span class="host-garaje-status ${activo ? 'is-active' : 'is-inactive'}">
          <span class="host-garaje-dot"></span>
          ${activo ? 'Activo' : 'Inactivo'}
        </span>
        <button type="button" class="host-garaje-preview-chip" onclick="abrirVistaPreviaGarajeById(${garaje.id})">
          <span class="material-symbols-outlined">visibility</span>
          Vista previa
        </button>
      </div>
      <div class="host-garaje-price">
        <span class="host-garaje-price-value">Bs. ${Number(garaje.precio_hora).toFixed(2)}</span>
        <span class="host-garaje-price-label">/ hora</span>
      </div>
    </div>
    <div class="host-garaje-body">
      <div class="host-garaje-head">
        <div class="host-garaje-head-copy">
          <h3 class="host-garaje-title">${escapeHTML(garaje.direccion)}</h3>
          <p class="host-garaje-subtitle">
            <span class="material-symbols-outlined">location_on</span>
            ${direccionPrincipal}
          </p>
        </div>
        <button type="button" class="host-garaje-icon-btn" onclick="abrirEditModalById(${garaje.id})" title="Editar">
          <span class="material-symbols-outlined">edit</span>
        </button>
      </div>
      <p class="host-garaje-description">${garaje.descripcion ? escapeHTML(garaje.descripcion) : 'Sin descripción pública todavía.'}</p>
      <div class="host-garaje-chip-row">
        <span class="host-garaje-chip"><span class="material-symbols-outlined">directions_car</span>${escapeHTML(tipoLabel)}</span>
        <span class="host-garaje-chip"><span class="material-symbols-outlined">schedule</span>${escapeHTML(horarioResumen)}</span>
        <span class="host-garaje-chip"><span class="material-symbols-outlined">security</span>${escapeHTML(garaje.nivel_seguridad || 'Estándar')}</span>
        <span class="host-garaje-chip"><span class="material-symbols-outlined">key</span>${escapeHTML(garaje.metodo_acceso || 'Manual')}</span>
      </div>

      ${garaje.fidelidad_activo ? `
        <div class="host-garaje-loyalty">
          <i class="fa-solid fa-medal"></i>
          <span>Fidelidad activa: ${garaje.fidelidad_visitas} visitas → ${garaje.fidelidad_descuento_pct}% dto.</span>
        </div>` : ''}

      <div class="host-garaje-actions">
        <div class="host-garaje-actions-grid">
          <button type="button" class="host-garaje-action-btn" onclick="window.location.href='/panel-mantenimiento.html?id=${garaje.id}'">
            <span class="material-symbols-outlined">build</span>
            Espacios
          </button>
          <button type="button" class="host-garaje-action-btn ${activo ? 'warning' : 'success'}" onclick="toggleEstado(${garaje.id}, this)" id="btnEstado-${garaje.id}">
            <span class="material-symbols-outlined">${activo ? 'pause_circle' : 'play_circle'}</span>
            ${activo ? 'Pausar' : 'Activar'}
          </button>
          <button type="button" class="host-garaje-action-btn danger" onclick="abrirEliminarGarajeConfirm(${garaje.id})" style="grid-column:span 2">
            <span class="material-symbols-outlined">delete</span>
            Eliminar garaje
          </button>
        </div>
      </div>
    </div>
  `;

  return card;
}

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

let previewGarajeActualId = null;
let deleteGarajeActualId = null;

function abrirVistaPreviaGarajeById(garajeId) {
  const modal = document.getElementById('previewGarajeOverlay');
  const iframe = document.getElementById('previewGarajeFrame');
  const btnEditar = document.getElementById('btnPreviewEditar');
  if (!modal || !iframe) return;

  previewGarajeActualId = parseInt(garajeId, 10);
  iframe.src = `/detalle-garaje.html?id=${previewGarajeActualId}&preview=1`;

  if (btnEditar) {
    const previewId = previewGarajeActualId;
    btnEditar.onclick = () => {
      closePreviewGarajeModal();
      abrirEditModalById(previewId);
    };
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePreviewGarajeModal() {
  const modal = document.getElementById('previewGarajeOverlay');
  const iframe = document.getElementById('previewGarajeFrame');
  if (modal) modal.classList.remove('open');
  if (iframe) iframe.src = 'about:blank';
  previewGarajeActualId = null;
  document.body.style.overflow = '';
}

function abrirEliminarGarajeConfirm(garajeId) {
  deleteGarajeActualId = parseInt(garajeId, 10);
  const garaje = _garajesCache.find(g => String(g.id) === String(deleteGarajeActualId));
  const titleEl = document.getElementById('deleteGarajeTitle');
  const textEl = document.getElementById('deleteGarajeText');
  if (titleEl) titleEl.textContent = garaje ? `Eliminar ${garaje.direccion}` : '¿Eliminar este garaje?';
  if (textEl) {
    textEl.textContent = garaje
      ? 'Esta acción eliminará el listado y sus datos asociados. Si el garaje tiene reservas registradas, el sistema no permitirá borrarlo y te sugerirá desactivarlo.'
      : 'Esta acción eliminará el listado y sus datos asociados.';
  }
  const modal = document.getElementById('deleteGarajeOverlay');
  if (modal) modal.classList.add('open');
  const btnConfirm = document.getElementById('btnDeleteGarajeConfirm');
  if (btnConfirm) btnConfirm.onclick = eliminarGarajeConfirmado;
  document.body.style.overflow = 'hidden';
}

function closeDeleteGarajeModal() {
  const modal = document.getElementById('deleteGarajeOverlay');
  if (modal) modal.classList.remove('open');
  deleteGarajeActualId = null;
  document.body.style.overflow = '';
}

async function eliminarGarajeConfirmado() {
  if (!deleteGarajeActualId) return;
  const btn = document.getElementById('btnDeleteGarajeConfirm');
  const originalHTML = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Eliminando...';
  }

  try {
    const res = await fetch(`/api/garajes/${deleteGarajeActualId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: currentUser.id }),
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      showToast(data.message || 'Garaje eliminado correctamente.');
      closeDeleteGarajeModal();
      await cargarMisGarajes();
    } else {
      showToast(data.message || 'No se pudo eliminar el garaje.', 'error');
    }
  } catch (err) {
    console.error('Error al eliminar garaje:', err);
    showToast('No se pudo conectar con el servidor.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }
}

// ============================================================
// Cargar Reservas Recibidas — GET /api/reservas/mis-reservas (rol anfitrión)
// ============================================================
async function cargarReservasRecibidas() {
  const loadingEl = document.getElementById('loadingReservas');
  const tableWrapper = document.getElementById('reservasTableWrapper');
  const emptyEl = document.getElementById('emptyReservas');
  const contadorEl = document.getElementById('contadorReservas');

  loadingEl.style.display = 'block';
  tableWrapper.style.display = 'none';
  tableWrapper.innerHTML = '';
  emptyEl.style.display = 'none';

  try {
    const res = await fetch(`/api/reservas/mis-reservas?usuario_id=${currentUser.id}&rol_id=1`);
    const data = await res.json();

    loadingEl.style.display = 'none';

    if (res.ok && data.status === 'ok') {
      const reservas = data.data;

      if (reservas.length === 0) {
        emptyEl.style.display = 'block';
        contadorEl.textContent = '';
        const badge = document.getElementById('tabBadgeReservas');
        if (badge) badge.style.display = 'none';
        return;
      }

      const pendientes = reservas.filter(r => r.estado === 'pendiente').length;
      const confirmadas = reservas.filter(r => r.estado === 'confirmada').length;

      contadorEl.textContent = pendientes > 0
        ? `${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`
        : `${reservas.length} reserva${reservas.length !== 1 ? 's' : ''}`;

      // Update tab badge
      const badge = document.getElementById('tabBadgeReservas');
      const urgentes = pendientes + confirmadas;
      if (badge && urgentes > 0) {
        badge.textContent = urgentes;
        badge.style.display = 'inline-block';
      } else if (badge) {
        badge.style.display = 'none';
      }

      const estadoBadge = {
        pendiente:  '<span class="reserva-badge pendiente"><i class="fa-solid fa-clock"></i> Pendiente</span>',
        confirmada: '<span class="reserva-badge confirmada"><i class="fa-solid fa-circle-check"></i> Confirmada</span>',
        rechazada:  '<span class="reserva-badge rechazada"><i class="fa-solid fa-circle-xmark"></i> Rechazada</span>',
        finalizada: '<span class="reserva-badge finalizada"><i class="fa-solid fa-flag-checkered"></i> Finalizada</span>',
        cancelada:  '<span class="reserva-badge rechazada"><i class="fa-solid fa-ban"></i> Cancelada</span>',
      };

      const container = document.createElement('div');

      reservas.forEach(r => {
        const fechaInicio = new Date(r.fecha_inicio).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' });
        const fechaFin    = new Date(r.fecha_fin).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' });
        const total = Number(r.precio_total || 0);
        const multa = Number(r.multa_exceso || 0);
        const descuento = Number(r.descuento_aplicado || 0);

        let accionesHTML = '';
        if (r.estado === 'pendiente') {
          accionesHTML =
            `<span style="display:inline-flex;align-items:center;gap:4px;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:20px;font-size:0.7rem;font-weight:700;padding:3px 10px;margin-bottom:8px;"><i class="fa-solid fa-user-clock"></i> Esperando tu decisión</span><br>` +
            `<button class="btn-reserva confirmar" onclick="cambiarEstadoReserva(${r.id}, 'confirmada', this)"><i class="fa-solid fa-check"></i> Aceptar</button>` +
            `<button class="btn-reserva rechazar" onclick="rechazarReservaConMotivo(${r.id}, this)"><i class="fa-solid fa-xmark"></i> Rechazar</button>`;
        } else if (r.estado === 'confirmada') {
          if (r.estado_pago === 'pagado') {
            accionesHTML =
              `<span style="display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:20px;font-size:0.7rem;font-weight:700;padding:3px 10px;margin-bottom:8px;"><i class="fa-solid fa-qrcode"></i> Pago QR registrado</span><br>` +
              `<button class="btn-reserva" style="background:#475569;color:white;border:none;" onclick="abrirMultaModal(${r.id}, '${r.fecha_fin}', ${r.precio_hora || 0})"><i class="fa-solid fa-flag-checkered"></i> Registrar Salida</button>`;
          } else if (r.estado_pago === 'efectivo_pendiente') {
            accionesHTML =
              `<span style="display:inline-flex;align-items:center;gap:4px;background:#fff7ed;color:#92400e;border:1px solid #fed7aa;border-radius:20px;font-size:0.7rem;font-weight:700;padding:3px 10px;margin-bottom:8px;"><i class="fa-solid fa-money-bill-wave"></i> Pendiente de pago en efectivo</span><br>` +
              `<button class="btn-reserva confirmar" onclick="confirmarPagoEfectivo(${r.id}, this)"><i class="fa-solid fa-hand-holding-dollar"></i> Confirmar efectivo recibido</button>`;
          } else if (r.estado_pago === 'efectivo_confirmado') {
            accionesHTML =
              `<span style="display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:20px;font-size:0.7rem;font-weight:700;padding:3px 10px;margin-bottom:8px;"><i class="fa-solid fa-circle-check"></i> Efectivo confirmado</span><br>` +
              `<button class="btn-reserva" style="background:#475569;color:white;border:none;" onclick="abrirMultaModal(${r.id}, '${r.fecha_fin}', ${r.precio_hora || 0})"><i class="fa-solid fa-flag-checkered"></i> Registrar Salida</button>`;
          } else {
            accionesHTML =
              `<span style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:20px;font-size:0.7rem;font-weight:700;padding:3px 10px;margin-bottom:8px;"><i class="fa-solid fa-hourglass-half"></i> Esperando pago del conductor</span>`;
          }
        }

        const multaBadge = multa > 0
          ? `<span class="reserva-multa-badge"><i class="fa-solid fa-triangle-exclamation"></i> Multa Bs. ${multa.toFixed(2)}</span>`
          : '';

        const cuponHTML = (r.cupon_codigo && descuento > 0)
          ? `<span style="font-size:0.75rem;color:#16a34a;font-weight:600;"><i class="fa-solid fa-tag"></i> Cupón: ${escapeHTML(r.cupon_codigo)} (-Bs. ${descuento.toFixed(2)})</span>`
          : '';

        const cardClass = r.estado === 'pendiente' ? 'reserva-card is-pendiente'
                        : r.estado === 'confirmada' ? 'reserva-card is-confirmada'
                        : 'reserva-card';

        const motivoRechazoHTML = (r.estado === 'rechazada' && r.motivo_rechazo)
          ? `<div style="margin:8px 0 10px;padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;font-size:0.8rem;color:#991b1b;"><strong>Motivo enviado al conductor:</strong><br>${escapeHTML(r.motivo_rechazo)}</div>`
          : '';

        const card = document.createElement('div');
        card.className = cardClass;
        card.innerHTML = `
          <div class="reserva-card-header">
            <div>
              <div class="reserva-card-conductor">${escapeHTML(r.conductor_nombre || 'N/A')}</div>
              ${r.conductor_telefono ? `<div class="reserva-card-telefono"><i class="fa-solid fa-phone" style="margin-right:4px"></i>${escapeHTML(r.conductor_telefono)}</div>` : ''}
            </div>
            <div>${estadoBadge[r.estado] || r.estado}</div>
          </div>
          <div class="reserva-card-meta">
            <span><i class="fa-solid fa-warehouse" style="color:#64748b"></i> ${escapeHTML(r.garaje_direccion)}</span>
            <span><i class="fa-solid fa-parking" style="color:#64748b"></i> Espacio ${escapeHTML(r.numero_espacio || '—')}</span>
          </div>
          <div class="reserva-card-meta">
            <span><i class="fa-regular fa-clock" style="color:#64748b"></i> Entrada: <strong>${fechaInicio}</strong></span>
            <span><i class="fa-solid fa-right-from-bracket" style="color:#64748b"></i> Salida: <strong>${fechaFin}</strong></span>
          </div>
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
            <span class="reserva-card-total">Bs. ${total.toFixed(2)}</span>
            ${multaBadge}
            ${cuponHTML}
          </div>
          ${motivoRechazoHTML}
          ${accionesHTML ? `<div class="reserva-card-actions">${accionesHTML}</div>` : ''}
        `;
        container.appendChild(card);
      });

      tableWrapper.appendChild(container);
      tableWrapper.style.display = 'block';
    }
  } catch (err) {
    document.getElementById('loadingReservas').style.display = 'none';
    console.error('Error al cargar reservas:', err);
    showToast('Error al cargar las reservas recibidas.', 'error');
  }
}

// ============================================================
// Cambiar estado de reserva — PUT /api/reservas/:id/estado
// ============================================================
async function cambiarEstadoReserva(reservaId, nuevoEstado, btnElement, motivoRechazo = '') {
  btnElement.disabled = true;
  const origHTML = btnElement.innerHTML;
  btnElement.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';

  try {
    const res = await fetch(`/api/reservas/${reservaId}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado: nuevoEstado,
        anfitrion_id: currentUser.id,
        motivo_rechazo: motivoRechazo || null,
      }),
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      const labels = { confirmada: 'confirmada', rechazada: 'rechazada', finalizada: 'finalizada' };
      showToast(`¡Reserva ${labels[nuevoEstado] || nuevoEstado} exitosamente!`);
      await cargarReservasRecibidas();
    } else {
      showToast(data.message || 'Error al cambiar el estado.', 'error');
      btnElement.disabled = false;
      btnElement.innerHTML = origHTML;
    }
  } catch (err) {
    console.error('Error al cambiar estado reserva:', err);
    showToast('No se pudo conectar con el servidor.', 'error');
    btnElement.disabled = false;
    btnElement.innerHTML = origHTML;
  }
}

async function rechazarReservaConMotivo(reservaId, btnElement) {
  const motivo = await pedirMotivoRechazo();
  if (!motivo) return;
  await cambiarEstadoReserva(reservaId, 'rechazada', btnElement, motivo);
}

// ============================================================
// Confirmar recepción de pago en efectivo (anfitrión)
// ============================================================
async function confirmarPagoEfectivo(reservaId, btnElement) {
  btnElement.disabled = true;
  const origHTML = btnElement.innerHTML;
  btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Confirmando...';
  try {
    const res = await fetch(`/api/reservas/${reservaId}/confirmar-efectivo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anfitrion_id: currentUser.id }),
    });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      showToast('¡Efectivo confirmado! Ya puedes gestionar la salida de la reserva.');
      await cargarReservasRecibidas();
    } else {
      showToast(data.message || 'Error al confirmar el efectivo.', 'error');
      btnElement.disabled = false;
      btnElement.innerHTML = origHTML;
    }
  } catch (err) {
    console.error('Error al confirmar efectivo:', err);
    showToast('No se pudo conectar con el servidor.', 'error');
    btnElement.disabled = false;
    btnElement.innerHTML = origHTML;
  }
}

// ============================================================
// Utilitarios Adicionales
// ============================================================
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// openModalFormulario / closeModalFormulario are defined in wizard-garaje.js

// ============================================================
// Tab Navigation
// ============================================================
function switchTab(tab) {
  const garSection = document.getElementById('sectionMisParqueos');
  const resSection = document.getElementById('sectionReservas');
  const btnG = document.getElementById('tabBtnGarajes');
  const btnR = document.getElementById('tabBtnReservas');

  if (tab === 'garajes') {
    garSection.style.display = 'block';
    resSection.style.display = 'none';
    btnG.classList.add('active');
    btnR.classList.remove('active');
  } else {
    garSection.style.display = 'none';
    resSection.style.display = 'block';
    btnG.classList.remove('active');
    btnR.classList.add('active');
    cargarReservasRecibidas();
  }
}

// ============================================================
// Loyalty field toggle (wizard Step 2)
// ============================================================
function initLoyaltyToggle() {
  const chk = document.getElementById('inpFidelidadActivo');
  const cfg = document.getElementById('fidelidadConfig');
  if (chk && cfg) {
    chk.addEventListener('change', () => {
      cfg.style.display = chk.checked ? 'block' : 'none';
    });
  }

  const editChk = document.getElementById('editFidelidadActivo');
  const editCfg = document.getElementById('editFidelidadConfig');
  if (editChk && editCfg) {
    editChk.addEventListener('change', () => {
      editCfg.style.display = editChk.checked ? 'block' : 'none';
    });
  }
}

// ============================================================
// Edit Garage Modal
// ============================================================
function abrirEditModalById(garajeId) {
  const garaje = _garajesCache.find(g => String(g.id) === String(garajeId));
  if (!garaje) { showToast('No se encontraron datos del garaje.', 'error'); return; }
  abrirEditModal(garaje);
}

function abrirEditModal(garaje) {
  initEditGarajeLocationMap();
  document.getElementById('editGarajeId').value = garaje.id;
  document.getElementById('editDireccion').value = garaje.direccion || '';
  document.getElementById('editDescripcion').value = garaje.descripcion || '';
  document.getElementById('editPrecio').value = garaje.precio_hora || '';
  document.getElementById('editNivelSeguridad').value = garaje.nivel_seguridad || 'Estándar';
  document.getElementById('editMetodoAcceso').value = garaje.metodo_acceso || 'Manual';
  document.getElementById('editPolitica').value = garaje.politica_cancelacion || 'Moderada: Reembolso 50% hasta 24h antes';
  document.getElementById('editInstrucciones').value = garaje.instrucciones_acceso || '';

  const fidActivo = !!garaje.fidelidad_activo;
  const editChk = document.getElementById('editFidelidadActivo');
  const editCfg = document.getElementById('editFidelidadConfig');
  editChk.checked = fidActivo;
  editCfg.style.display = fidActivo ? 'block' : 'none';
  document.getElementById('editFidelidadVisitas').value = garaje.fidelidad_visitas || 10;
  document.getElementById('editFidelidadDescuento').value = garaje.fidelidad_descuento_pct || 10;
  document.getElementById('editFidelidadValidez').value = garaje.fidelidad_dias_validez != null ? garaje.fidelidad_dias_validez : '';
  setEditGarajeLocationFromData(Number(garaje.latitud), Number(garaje.longitud), garaje.direccion || '');

  document.getElementById('editGarajeOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => editGarajeMap?.invalidateSize(), 120);
}

function closeEditModal() {
  document.getElementById('editGarajeOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function guardarEdicionGaraje() {
  const garajeId = document.getElementById('editGarajeId').value;
  const direccion = document.getElementById('editDireccion').value.trim();
  const precio_hora = document.getElementById('editPrecio').value;
  const ubicacionEditValida = Number.isFinite(ubicacionGarajeEdit.lat) && Number.isFinite(ubicacionGarajeEdit.lng);

  if (!direccion || direccion.length < 5) {
    showToast('La dirección debe tener al menos 5 caracteres.', 'error');
    return;
  }
  if (!precio_hora || Number(precio_hora) <= 0) {
    showToast('Ingresa un precio por hora válido.', 'error');
    return;
  }

  if (!ubicacionEditValida) {
    showToast('Selecciona la ubicacion exacta del garaje en el mapa antes de guardar.', 'error');
    initEditGarajeLocationMap();
    return;
  }

  const btn = document.getElementById('btnGuardarEdit');
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Guardando...';

  try {
    const fidActivo = document.getElementById('editFidelidadActivo').checked;
    const payload = {
      usuario_id: currentUser.id,
      direccion,
      latitud: ubicacionGarajeEdit.lat,
      longitud: ubicacionGarajeEdit.lng,
      descripcion:           document.getElementById('editDescripcion').value,
      precio_hora,
      nivel_seguridad:       document.getElementById('editNivelSeguridad').value,
      metodo_acceso:         document.getElementById('editMetodoAcceso').value,
      instrucciones_acceso:  document.getElementById('editInstrucciones').value,
      politica_cancelacion:  document.getElementById('editPolitica').value,
      fidelidad_activo:      fidActivo,
      fidelidad_visitas:     document.getElementById('editFidelidadVisitas').value,
      fidelidad_descuento_pct: document.getElementById('editFidelidadDescuento').value,
      fidelidad_dias_validez: document.getElementById('editFidelidadValidez').value,
    };

    const res = await fetch(`/api/garajes/${garajeId}/editar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      showToast(data.message || '¡Espacio actualizado!');
      closeEditModal();
      await cargarMisGarajes();
    } else {
      showToast(data.message || 'Error al actualizar.', 'error');
    }
  } catch (err) {
    console.error('Error al editar garaje:', err);
    showToast('No se pudo conectar con el servidor.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHTML;
  }
}

// ============================================================
// Multa Modal — Registrar Salida
// ============================================================
let _multaFechaFin = null;

function abrirMultaModal(reservaId, fechaFin, precioHora) {
  _multaFechaFin = new Date(fechaFin);
  document.getElementById('multaReservaId').value = reservaId;
  document.getElementById('multaPrecioHora').value = precioHora;
  document.getElementById('multaFechaFinDisplay').textContent =
    _multaFechaFin.toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' });

  // Pre-fill con la fecha actual
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const localNow = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  document.getElementById('inpHoraSalidaReal').value = localNow;

  document.getElementById('multaResultado').style.display = 'none';
  document.getElementById('multaOk').style.display = 'none';
  document.getElementById('multaExceso').style.display = 'none';
  document.getElementById('btnConfirmarSalida').disabled = true;

  document.getElementById('multaOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMultaModal() {
  document.getElementById('multaOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function calcularMulta() {
  const salidaRealStr = document.getElementById('inpHoraSalidaReal').value;
  if (!salidaRealStr || !_multaFechaFin) {
    showToast('Ingresa la hora real de salida.', 'error');
    return;
  }

  const salidaReal = new Date(salidaRealStr);
  const precioHora = parseFloat(document.getElementById('multaPrecioHora').value) || 0;
  const diffMs = salidaReal - _multaFechaFin;

  document.getElementById('multaResultado').style.display = 'block';

  if (diffMs <= 0) {
    document.getElementById('multaOk').style.display = 'block';
    document.getElementById('multaExceso').style.display = 'none';
  } else {
    const minutosExtra = Math.ceil(diffMs / 60000);
    const intervalos = Math.ceil(minutosExtra / 30);
    // Each 30-min interval = precio_hora × 1.5 × 0.5h
    const multa = precioHora * 1.5 * 0.5 * intervalos;

    document.getElementById('multaOk').style.display = 'none';
    document.getElementById('multaExceso').style.display = 'block';
    document.getElementById('multaMinutosExtra').textContent = minutosExtra;
    document.getElementById('multaIntervalos').textContent = intervalos;
    document.getElementById('multaMontoDisplay').textContent = `Bs. ${multa.toFixed(2)}`;
  }

  document.getElementById('btnConfirmarSalida').disabled = false;
}

async function confirmarSalida() {
  const reservaId = document.getElementById('multaReservaId').value;
  const salidaRealStr = document.getElementById('inpHoraSalidaReal').value;
  const precioHora = parseFloat(document.getElementById('multaPrecioHora').value) || 0;

  if (!salidaRealStr) {
    showToast('Ingresa la hora real de salida.', 'error');
    return;
  }

  const salidaReal = new Date(salidaRealStr);
  const diffMs = salidaReal - _multaFechaFin;
  let multaExceso = 0;
  if (diffMs > 0) {
    const minutosExtra = Math.ceil(diffMs / 60000);
    const intervalos = Math.ceil(minutosExtra / 30);
    multaExceso = precioHora * 1.5 * 0.5 * intervalos;
  }

  const btn = document.getElementById('btnConfirmarSalida');
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Confirmando...';

  try {
    const res = await fetch(`/api/reservas/${reservaId}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anfitrion_id: currentUser.id,
        estado: 'finalizada',
        multa_exceso: multaExceso,
        hora_salida_real: salidaReal.toISOString(),
      }),
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      const msg = multaExceso > 0
        ? `¡Reserva finalizada! Multa registrada: Bs. ${multaExceso.toFixed(2)}`
        : '¡Reserva finalizada correctamente!';
      showToast(msg);
      closeMultaModal();
      // Reload reservas tab
      await cargarReservasRecibidas();
    } else {
      showToast(data.message || 'Error al finalizar.', 'error');
    }
  } catch (err) {
    console.error('Error al confirmar salida:', err);
    showToast('No se pudo conectar con el servidor.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHTML;
  }
}

// ============================================================
// Init — Al cargar la página
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initTheme();
  initLocationPickers();
  initFileUpload();
  initHorariosBuilder();
  initTilemap();
  initFormSubmit();
  initLoyaltyToggle();
  if (typeof initWizard === 'function') initWizard();
  cargarMisGarajes();
  // Reservas se carga al hacer click en la tab
});
