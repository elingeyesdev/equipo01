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

// Visual builder elements
const inpFilas        = document.getElementById('inpFilas');
const inpColumnas     = document.getElementById('inpColumnas');
const btnGenerarMapa  = document.getElementById('btnGenerarMapa');
const cantidadNumero  = document.getElementById('cantidadNumero');
const mapaBuilder     = document.getElementById('mapaBuilder');
const tipoLeyenda     = document.getElementById('tipoLeyenda');

// Horario elements
const inpHoraApertura   = document.getElementById('inpHoraApertura');
const inpHoraCierre     = document.getElementById('inpHoraCierre');
const inpDiasOperativos = document.getElementById('inpDiasOperativos');

let espaciosConfigurados = []; // Array de { numero_espacio, tipo_vehiculo, fila, columna }

// se aumento los parqueos con techo para lo que actualizamos en el repositorio
// Vehicle type cycle
const TIPOS = ['auto', 'moto', 'camioneta', 'techado'];
const TIPO_CONFIG = {
  auto:      { icon: 'fa-car',          emoji: '🚗', label: 'Auto',    color: '#3b82f6' },
  moto:      { icon: 'fa-motorcycle',   emoji: '🏍️', label: 'Moto',    color: '#f59e0b' },
  camioneta: { icon: 'fa-truck-pickup', emoji: '🚙', label: 'SUV',     color: '#8b5cf6' },
  techado:   { icon: 'fa-warehouse',    emoji: '🛖', label: 'Techado', color: '#10b981' }
};

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
  const themeIcon = document.getElementById('themeIcon');
  const saved = localStorage.getItem('estairbnb_theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
    if (themeIcon) themeIcon.textContent = 'light_mode';
  }

  const btnThemeToggle = document.getElementById('btnThemeToggle');
  if (btnThemeToggle) {
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
// Visual Espacio Builder — +/- & tap-to-cycle
// ============================================================
function initEspacioBuilder() {
  btnGenerarMapa.addEventListener('click', () => {
    const filas = Math.min(Math.max(parseInt(inpFilas.value, 10) || 1, 1), 10);
    const columnas = Math.min(Math.max(parseInt(inpColumnas.value, 10) || 1, 1), 10);

    if (filas * columnas > 100) {
      showToast('Máximo 100 espacios por garaje (10x10).', 'error');
      return;
    }

    // Regenerar todo el array de espacios
    espaciosConfigurados = [];
    const letras = 'ABCDEFGHIJ';

    for (let f = 1; f <= filas; f++) {
      for (let c = 1; c <= columnas; c++) {
        const letra = letras[f - 1] || 'X';
        // Alternar entre los diferentes tipos para que haya variedad de techados, SUV, etc.
        const idx = (f + c) % TIPOS.length;
        espaciosConfigurados.push({
          numero_espacio: `${letra}${c}`,
          tipo_vehiculo: TIPOS[idx],
          fila: f,
          columna: c
        });
      }
    }

    renderMapaBuilder();
    showToast(`Mapa de ${filas}×${columnas} generado (${espaciosConfigurados.length} espacios).`);
  });
}

// addEspacioVisual is no longer used — spaces are generated via the matrix

function cycleType(index) {
  const esp = espaciosConfigurados[index];
  const currentIdx = TIPOS.indexOf(esp.tipo_vehiculo);
  esp.tipo_vehiculo = TIPOS[(currentIdx + 1) % TIPOS.length];
  renderMapaBuilder();
}

function renderMapaBuilder() {
  mapaBuilder.innerHTML = '';
  cantidadNumero.textContent = espaciosConfigurados.length;

  // Show/hide legend
  tipoLeyenda.style.display = espaciosConfigurados.length > 0 ? 'block' : 'none';

  // Determine columns from data
  const maxCol = espaciosConfigurados.length > 0
    ? Math.max(...espaciosConfigurados.map(e => e.columna))
    : 5;
  mapaBuilder.style.gridTemplateColumns = `repeat(${maxCol}, 1fr)`;

  espaciosConfigurados.forEach((esp, idx) => {
    const conf = TIPO_CONFIG[esp.tipo_vehiculo];
    const card = document.createElement('div');
    card.className = 'builder-slot';
    card.style.setProperty('--slot-color', conf.color);
    card.title = `Toca para cambiar tipo (ahora: ${conf.label})`;
    card.innerHTML = `
      <div class="builder-slot-icon">
        <i class="fa-solid ${conf.icon}"></i>
      </div>
      <div class="builder-slot-name">${esp.numero_espacio}</div>
      <div class="builder-slot-type">${conf.label}</div>
    `;
    card.addEventListener('click', () => cycleType(idx));

    // Entrance animation
    card.style.animation = `fadeInScale 0.25s ease ${idx * 0.04}s both`;

    mapaBuilder.appendChild(card);
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
  if (espaciosConfigurados.length === 0) {
    showToast('Debes agregar al menos un espacio de parqueo.', 'error');
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
  formData.append('hora_apertura', inpHoraApertura.value || '08:00');
  formData.append('hora_cierre', inpHoraCierre.value || '22:00');
  formData.append('dias_operativos', inpDiasOperativos.value || 'L-D');
  formData.append('espacios', JSON.stringify(espaciosConfigurados));
  formData.append('comodidades', JSON.stringify(comodidades));

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
      renderMapaBuilder();

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

            const acciones = r.estado === 'pendiente'
              ? `<div class="reserva-acciones">
                   <button class="btn-reserva confirmar" onclick="cambiarEstadoReserva(${r.id}, 'confirmada', this)" title="Confirmar">
                     <i class="fa-solid fa-check"></i> Confirmar
                   </button>
                   <button class="btn-reserva rechazar" onclick="cambiarEstadoReserva(${r.id}, 'rechazada', this)" title="Rechazar">
                     <i class="fa-solid fa-xmark"></i> Rechazar
                   </button>
                 </div>`
              : '<span style="font-size:0.78rem;color:var(--text-secondary);">—</span>';

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
  initEspacioBuilder();
  renderMapaBuilder(); // render initial state (0 spaces)
  cargarMisGarajes();
  cargarReservasRecibidas();
});
