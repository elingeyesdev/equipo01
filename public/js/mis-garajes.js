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
const btnPublicar       = document.getElementById('btnPublicar');
const garajesGrid       = document.getElementById('garajesGrid');
const loadingGarajes    = document.getElementById('loadingGarajes');
const emptyState        = document.getElementById('emptyState');
const statsBar          = document.getElementById('statsBar');
const contadorGarajes   = document.getElementById('contadorGarajes');

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
      if (sel) sel.style.opacity = tmPincel === 'parking' ? '1' : '0.4';
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
      const f = Math.min(Math.max(parseInt(tmFilas.value, 10) || 6, 3), 12);
      const c = Math.min(Math.max(parseInt(tmColumnas.value, 10) || 8, 3), 12);
      tmFilasVal = f; tmColsVal = c;
      tmAplicarPreset(btn.dataset.preset, f, c);
    });
  });

  // Drag painting
  document.addEventListener('mouseup', () => { tmIsPainting = false; });
  document.addEventListener('touchend', () => { tmIsPainting = false; });
}

function tmGenerarGrilla(filas, cols) {
  // Initialize empty matrix
  tmMatriz = [];
  for (let f = 0; f < filas; f++) {
    tmMatriz[f] = [];
    for (let c = 0; c < cols; c++) {
      tmMatriz[f][c] = { tile: 'empty', tipo_vehiculo: 'auto' };
    }
  }
  tmRenderGrilla();
  tmActualizarStats();
}

function tmRenderGrilla() {
  if (!tmGrid) return;
  tmGrid.innerHTML = '';
  const filas = tmMatriz.length;
  const cols  = filas > 0 ? tmMatriz[0].length : 0;

  tmGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  let parkingCounter = 1;

  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'tm-cell';
      cell.dataset.fila = f;
      cell.dataset.col  = c;

      const cellData = tmMatriz[f][c];
      cell.dataset.tile = cellData.tile;

      // Cell content
      if (cellData.tile === 'parking') {
        const num = parkingCounter++;
        const vehicleIcons = { auto: '🚗', moto: '🏍️', camioneta: '🚙' };
        cell.innerHTML = `
          <span style="font-size:1rem;line-height:1;">${vehicleIcons[cellData.tipo_vehiculo] || '🚗'}</span>
          <span class="tm-cell-num">A${num}</span>
        `;
      } else if (cellData.tile === 'wall') {
        cell.innerHTML = `<span style="font-size:1.1rem">🧱</span>`;
      } else if (cellData.tile === 'entrance') {
        cell.innerHTML = `<span style="font-size:1rem">🚪</span><span class="tm-cell-label">ENT</span>`;
      } else if (cellData.tile === 'aisle') {
        cell.innerHTML = `<span style="font-size:0.8rem;color:#38bdf8;">↔</span>`;
      }

      // Paint events
      cell.addEventListener('mousedown', (e) => {
        e.preventDefault();
        tmIsPainting = true;
        tmPintarCelda(f, c);
      });
      cell.addEventListener('mouseover', () => {
        if (tmIsPainting) tmPintarCelda(f, c);
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
          tmPintarCelda(parseInt(el.dataset.fila), parseInt(el.dataset.col));
        }
      }, { passive: false });

      tmGrid.appendChild(cell);
    }
  }
}

function tmPintarCelda(f, c) {
  const tipoVehiculo = document.getElementById('tmTipoVehiculo')?.value || 'auto';
  if (tmPincel === 'eraser') {
    tmMatriz[f][c] = { tile: 'empty', tipo_vehiculo: 'auto' };
  } else {
    tmMatriz[f][c] = { tile: tmPincel, tipo_vehiculo: tipoVehiculo };
  }
  tmRenderGrilla();
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
  tmMatriz = [];
  for (let f = 0; f < filas; f++) {
    tmMatriz[f] = [];
    for (let c = 0; c < cols; c++) tmMatriz[f][c] = { tile: 'empty', tipo_vehiculo: 'auto' };
  }

  const halfway = Math.floor(cols / 2);

  if (preset === 'linea') {
    // Walls top/bottom, aisle in middle, parking rows
    for (let c = 0; c < cols; c++) { tmMatriz[0][c].tile = 'wall'; tmMatriz[filas-1][c].tile = 'wall'; }
    const midF = Math.floor(filas / 2);
    for (let f = 1; f < filas-1; f++) {
      for (let c = 0; c < cols; c++) {
        tmMatriz[f][c].tile = f === midF ? 'aisle' : 'parking';
      }
    }
    tmMatriz[1][0].tile = 'entrance';
  } else if (preset === 'ele') {
    // L-shape: left column + bottom row are parking, rest walls/aisle
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        if (c === 0) { tmMatriz[f][c].tile = 'wall'; }
        else if (f === filas-1) { tmMatriz[f][c].tile = 'parking'; }
        else if (c === 1) { tmMatriz[f][c].tile = 'aisle'; }
        else { tmMatriz[f][c].tile = f < filas-2 ? 'parking' : 'aisle'; }
      }
    }
    tmMatriz[0][0].tile = 'entrance';
  } else if (preset === 'patio') {
    // Outer wall, aisle strip in center, parking filling left/right
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < cols; c++) {
        if (f === 0 || f === filas-1 || c === 0 || c === cols-1) {
          tmMatriz[f][c].tile = 'wall';
        } else if (c === halfway) {
          tmMatriz[f][c].tile = 'aisle';
        } else {
          tmMatriz[f][c].tile = 'parking';
        }
      }
    }
    tmMatriz[0][halfway].tile = 'entrance';
  }

  tmRenderGrilla();
  tmActualizarStats();
}

function exportarMapa() {
  // Returns { matriz: tmMatriz, espacios: [...] }
  const espacios = [];
  let parkNum = 1;
  tmMatriz.forEach((fila, f) => {
    fila.forEach((cell, c) => {
      if (cell.tile === 'parking') {
        espacios.push({
          numero_espacio: `A${parkNum++}`,
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

  window.eliminarHorario = function(idx) {
    horariosConfigurados.splice(idx, 1);
    renderHorarios();
  };

  function renderHorarios() {
    horariosContainer.innerHTML = '';
    horariosConfigurados.forEach((horario, idx) => {
      const diasLabels = horario.dias.map(d => mapDias[d]).join(', ');
      
      const div = document.createElement('div');
      div.className = 'flex items-center justify-between bg-surface-container-low p-3 rounded-lg border border-outline-variant/30';
      div.innerHTML = `
        <div class="flex flex-col">
          <span class="text-sm font-semibold text-primary"><i class="fa-regular fa-calendar text-secondary mr-1"></i> ${diasLabels}</span>
          <span class="text-xs text-on-surface-variant font-medium"><i class="fa-regular fa-clock mr-1"></i> ${horario.inicio} — ${horario.fin}</span>
        </div>
        <button type="button" class="text-error hover:bg-error-container/50 p-2 rounded-full transition-colors flex items-center justify-center" onclick="eliminarHorario(${idx})" title="Eliminar">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      `;
      horariosContainer.appendChild(div);
    });

    if (horariosConfigurados.length > 0) {
      horariosError.classList.add('hidden');
    }
  }

  if(btnAgregarHorario) {
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

      // Validar superposiciones
      let superposicion = false;
      for (const h of horariosConfigurados) {
        // Verificar si tienen días en común
        const diasEnComun = dias.filter(d => h.dias.includes(d));
        if (diasEnComun.length > 0) {
          // Verificar superposición de horas: (StartA < EndB) and (EndA > StartB)
          if (inicio < h.fin && fin > h.inicio) {
            superposicion = true;
            break;
          }
        }
      }

      if (superposicion) {
        showToast('El horario seleccionado se superpone con un horario ya existente para esos días.', 'error');
        return;
      }

      horariosConfigurados.push({ dias, inicio, fin });
      
      // Clear checkboxes for next input
      checkboxes.forEach(cb => cb.checked = false);
      
      renderHorarios();
    });
  }
}

// ============================================================
// Publicar Garaje — POST /api/garajes
// ============================================================
formGaraje.addEventListener('submit', async (e) => {
  e.preventDefault();

  const direccion     = inpDireccion.value.trim();
  const descripcion   = inpDescripcion.value.trim();
  const precio_hora   = inpPrecio.value;

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
  // Collect data from Tilemap
  const { matriz, espacios } = exportarMapa();
  espaciosConfigurados = espacios;

  if (espaciosConfigurados.length === 0) {
    if (tilemapError) tilemapError.classList.remove('hidden');
    showToast('Debes colocar al menos un espacio de parqueo (🟩) en el mapa.', 'error');
    document.getElementById('espacioBuilderSection')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (tilemapError) tilemapError.classList.add('hidden');

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
  formData.append('dimensiones', document.getElementById('inpDimensiones')?.value || '');
  formData.append('reglas_casa', document.getElementById('inpReglas')?.value || '');
  formData.append('politica_cancelacion', document.getElementById('inpPolitica')?.value || '');

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
      closeModalFormulario();

      // Limpiar formulario
      formGaraje.reset();
      selectedFiles = [];
      photoPreviewGrid.innerHTML = '';
      espaciosConfigurados = [];
      // Reset Tilemap
      tmGenerarGrilla(6, 8);
      if (tmFilas) tmFilas.value = 6;
      if (tmColumnas) tmColumnas.value = 8;

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
// Crear Tarjeta de Garaje (DOM) con diseño Tailwind
// ============================================================
function crearTarjetaGaraje(garaje) {
  const card = document.createElement('div');
  card.className = 'bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0px_24px_48px_rgba(0,37,66,0.06)] border border-outline-variant/10 flex flex-col group transition-transform duration-300 hover:-translate-y-1';
  card.id = `garaje-${garaje.id}`;

  const activo = garaje.estado_activo;
  const tipoIconos = {
    auto: 'directions_car',
    moto: 'two_wheeler',
    camioneta: 'local_shipping',
  };
  const iconText = tipoIconos[garaje.tipo_vehiculo] || 'directions_car';

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
      
      <div class="flex items-center gap-4 mb-6 text-sm text-on-surface-variant font-body bg-surface-container-low p-3 rounded-lg">
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
      
      <div class="mt-auto pt-4 border-t border-outline-variant/10 flex flex-col gap-2">
        <button class="w-full text-center text-primary font-label uppercase text-xs tracking-wider font-bold py-2.5 hover:bg-surface-container-low rounded-md transition-colors flex items-center justify-center gap-2" onclick="window.location.href='/panel-mantenimiento.html?id=${garaje.id}'">
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
        return;
      }

      const pendientes = reservas.filter(r => r.estado === 'pendiente').length;
      contadorEl.textContent = pendientes > 0
        ? `${pendientes} pendiente${pendientes !== 1 ? 's' : ''}`
        : `${reservas.length} reserva${reservas.length !== 1 ? 's' : ''}`;

      // Construir tabla
      const table = document.createElement('table');
      table.className = 'reservas-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Conductor</th>
            <th>Garaje</th>
            <th>Espacio</th>
            <th>Entrada</th>
            <th>Salida</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${reservas.map(r => {
            const fechaInicio = new Date(r.fecha_inicio).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' });
            const fechaFin = new Date(r.fecha_fin).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' });

            const estadoBadge = {
              pendiente:  '<span class="reserva-badge pendiente"><i class="fa-solid fa-clock"></i> Pendiente</span>',
              confirmada: '<span class="reserva-badge confirmada"><i class="fa-solid fa-circle-check"></i> Confirmada</span>',
              rechazada:  '<span class="reserva-badge rechazada"><i class="fa-solid fa-circle-xmark"></i> Rechazada</span>',
              finalizada: '<span class="reserva-badge finalizada"><i class="fa-solid fa-flag-checkered"></i> Finalizada</span>',
            };

            let acciones = '<span style="font-size:0.78rem;color:var(--text-secondary);">—</span>';
            
            if (r.estado === 'pendiente') {
              acciones = `
                <div class="reserva-acciones">
                  <button class="btn-reserva confirmar" onclick="cambiarEstadoReserva(${r.id}, 'confirmada', this)" title="Confirmar">
                    <i class="fa-solid fa-check"></i> Confirmar
                  </button>
                  <button class="btn-reserva rechazar" onclick="cambiarEstadoReserva(${r.id}, 'rechazada', this)" title="Rechazar">
                    <i class="fa-solid fa-xmark"></i> Rechazar
                  </button>
                </div>`;
            } else if (r.estado === 'confirmada') {
              acciones = `
                <div class="reserva-acciones">
                  <button class="btn-reserva" style="background:#64748b; color:white; border:none; padding:5px 10px; border-radius:6px; font-size:0.7rem; font-weight:700;" onclick="cambiarEstadoReserva(${r.id}, 'finalizada', this)" title="Finalizar Estancia">
                    <i class="fa-solid fa-flag-checkered"></i> Finalizar
                  </button>
                </div>`;
            }

            return `
              <tr>
                <td>
                  <div style="font-weight:600;font-size:0.85rem;">${escapeHTML(r.conductor_nombre || 'N/A')}</div>
                  <div style="font-size:0.75rem;color:var(--text-secondary);">${r.conductor_telefono || ''}</div>
                </td>
                <td style="font-size:0.85rem;">${escapeHTML(r.garaje_direccion)}</td>
                <td style="font-size:0.85rem;font-weight:600;">${escapeHTML(r.numero_espacio || '—')}</td>
                <td style="font-size:0.82rem;">${fechaInicio}</td>
                <td style="font-size:0.82rem;">${fechaFin}</td>
                <td style="font-weight:700;font-size:0.85rem;">Bs. ${Number(r.precio_total).toFixed(2)}</td>
                <td>${estadoBadge[r.estado] || r.estado}</td>
                <td>${acciones}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      `;

      tableWrapper.appendChild(table);
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
async function cambiarEstadoReserva(reservaId, nuevoEstado, btnElement) {
  btnElement.disabled = true;
  const origHTML = btnElement.innerHTML;
  btnElement.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';

  try {
    const res = await fetch(`/api/reservas/${reservaId}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      const label = nuevoEstado === 'confirmada' ? 'confirmada' : 'rechazada';
      showToast(`¡Reserva ${label} exitosamente!`);
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

// ============================================================
// Utilitarios Adicionales
// ============================================================
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// Modal Formulario Handlers
// ============================================================
function openModalFormulario() {
  const modal = document.getElementById('modalFormularioWrapper');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
}

function closeModalFormulario() {
  const modal = document.getElementById('modalFormularioWrapper');
  if (modal) {
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

// ============================================================
// Init — Al cargar la página
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initTheme();
  initFileUpload();
  initHorariosBuilder();
  initTilemap();
  cargarMisGarajes();
  cargarReservasRecibidas();
});
