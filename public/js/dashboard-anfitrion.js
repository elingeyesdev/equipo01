// ============================================================
// EstAirbnb — dashboard-anfitrion.js
// Panel de inicio del Anfitrión: KPIs, ocupación, alertas y
// reservas recientes. Solo lectura — no toca rutas existentes.
// ============================================================

const USUARIO_KEY = 'estairbnb_user';

// ── Sesión / rol ─────────────────────────────────────────────
const currentUser = JSON.parse(localStorage.getItem(USUARIO_KEY) || 'null');
if (!currentUser || !currentUser.id) {
  window.location.href = '/login.html';
}
if (currentUser && currentUser.rol_id !== 1) {
  // Los conductores no tienen este panel
  window.location.href = '/explorar.html';
}

// ── Helpers ──────────────────────────────────────────────────
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmtBs(n) {
  const num = Number(n) || 0;
  return 'Bs. ' + num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtFecha(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d)) return '—';
  return d.toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function iniciales(nombre) {
  const parts = String(nombre || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

// ── Navbar ───────────────────────────────────────────────────
function initNavbar() {
  const nameEl = document.getElementById('navUserName');
  const initialsEl = document.getElementById('navInitials');
  const avatarEl = document.getElementById('userAvatar');
  if (currentUser.nombre) {
    if (nameEl) nameEl.textContent = currentUser.nombre;
    const ini = (currentUser.nombre[0] || '') + (currentUser.apellidos?.[0] || '');
    if (initialsEl) initialsEl.textContent = ini.toUpperCase();
  }
  if (currentUser.foto_url && avatarEl) {
    avatarEl.style.backgroundImage = `url('${currentUser.foto_url}')`;
    if (initialsEl) initialsEl.style.display = 'none';
  }
  const greet = document.getElementById('dshUserName');
  if (greet && currentUser.nombre) greet.textContent = currentUser.nombre;
}

// ── Tema (mismo patrón que mis-garajes) ──────────────────────
function initTheme() {
  const themeIcon = document.getElementById('themeIcon');
  const saved = localStorage.getItem('estairbnb_theme');
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
    if (themeIcon) themeIcon.textContent = 'light_mode';
  }
  const btn = document.getElementById('btnThemeToggle');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
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

// ── Logout ───────────────────────────────────────────────────
function initLogout() {
  const btn = document.getElementById('btnLogout');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem(USUARIO_KEY);
      window.location.href = '/login.html';
    });
  }
}

// ── Toast ────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const toastEl = document.getElementById('toastNotification');
  if (!toastEl) return;
  toastEl.className = `toast toast-${type}`;
  const icon = document.querySelector('#toastBody i');
  if (icon) icon.className = type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation';
  const msgEl = document.getElementById('toastMessage');
  if (msgEl) msgEl.textContent = msg;
  new bootstrap.Toast(toastEl, { delay: 3500 }).show();
}

// ── Carga de datos ───────────────────────────────────────────
async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    const json = await res.json();
    return (json && json.status === 'ok') ? json : null;
  } catch (_) {
    return null;
  }
}

async function loadDashboard() {
  const loading = document.getElementById('dshLoading');
  const content = document.getElementById('dshContent');
  const errBox = document.getElementById('dshError');

  try {
    const [gJson, rJson] = await Promise.all([
      fetchJSON(`/api/garajes/mis-espacios?usuario_id=${currentUser.id}`),
      fetchJSON(`/api/reservas/mis-reservas?usuario_id=${currentUser.id}&rol_id=1`)
    ]);

    if (!gJson) throw new Error('garajes');

    const garajes = Array.isArray(gJson.data) ? gJson.data : [];
    const reservas = (rJson && Array.isArray(rJson.data)) ? rJson.data : [];

    // Espacios por garaje (en paralelo) para conteo de ocupación
    let espacios = [];
    if (garajes.length) {
      const lotes = await Promise.all(
        garajes.map(g =>
          fetchJSON(`/api/garajes/${g.id}/espacios-admin?usuario_id=${currentUser.id}`)
            .then(j => (j && j.data && Array.isArray(j.data.espacios)) ? j.data.espacios : [])
        )
      );
      espacios = lotes.flat();
    }

    renderDashboard(garajes, reservas, espacios);

    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'block';
  } catch (_) {
    if (loading) loading.style.display = 'none';
    if (errBox) errBox.classList.remove('d-none');
  }
}

// ── Render ───────────────────────────────────────────────────
function renderDashboard(garajes, reservas, espacios) {
  // --- Garajes
  const total = garajes.length;
  const activos = garajes.filter(g => g.estado_activo).length;
  const inactivos = total - activos;
  const sinFotos = garajes.filter(g => !g.foto_principal).length;

  // --- Espacios
  const espTotal = espacios.length;
  const espLibre = espacios.filter(e => e.estado === 'libre').length;
  const espOcup = espacios.filter(e => e.estado === 'ocupado').length;
  const espMant = espacios.filter(e => e.estado === 'mantenimiento').length;

  // --- Reservas
  const pendientes = reservas.filter(r => r.estado === 'pendiente').length;
  const activas = reservas.filter(r => r.estado === 'confirmada').length;
  const finalizadas = reservas.filter(r => r.estado === 'finalizada');
  const ingresos = finalizadas.reduce(
    (acc, r) => acc + (Number(r.precio_total) || 0) + (Number(r.multa_exceso) || 0), 0
  );

  // --- KPIs
  setText('kpiGarajes', total);
  setText('kpiGarajesSub', `${activos} activos · ${inactivos} inactivos`, true);
  setText('kpiLibres', espLibre);
  setText('kpiLibresSub', espTotal ? `de ${espTotal} espacios` : 'sin espacios aún');
  setText('kpiPendientes', pendientes);
  setText('kpiPendientesSub', activas ? `${activas} reserva(s) activa(s)` : 'por revisar');
  setText('kpiIngresos', fmtBs(ingresos));
  setText('kpiIngresosSub', `${finalizadas.length} reserva(s) finalizada(s)`);

  const cardPend = document.getElementById('kpiCardPendientes');
  if (cardPend) cardPend.classList.toggle('is-urgent', pendientes > 0);

  // --- Ocupación
  setText('occTotal', espTotal);
  setText('occLibres', espLibre);
  setText('occOcupados', espOcup);
  setText('occMant', espMant);
  const pct = (n) => espTotal ? `${(n / espTotal * 100).toFixed(1)}%` : '0%';
  setWidth('occSegLibre', pct(espLibre));
  setWidth('occSegOcupado', pct(espOcup));
  setWidth('occSegMant', pct(espMant));

  // --- Alertas
  renderAlertas({ total, inactivos, sinFotos, pendientes, espMant });

  // --- Reservas recientes
  renderRecientes(reservas);
}

function setText(id, val, asHTML = false) {
  const el = document.getElementById(id);
  if (!el) return;
  if (asHTML) el.innerHTML = val;
  else el.textContent = val;
}
function setWidth(id, w) {
  const el = document.getElementById(id);
  if (el) el.style.width = w;
}

function renderAlertas({ total, inactivos, sinFotos, pendientes, espMant }) {
  const cont = document.getElementById('dshAlerts');
  if (!cont) return;

  const alertas = [];
  if (total === 0) {
    alertas.push({ tipo: 'teal', icon: 'add_home_work', txt: 'Aún no has publicado ningún garaje. Empieza para recibir reservas.', href: '/mis-garajes.html?publicar=1', cta: 'Publicar' });
  }
  if (pendientes > 0) {
    alertas.push({ tipo: 'amber', icon: 'hourglass_top', txt: `Tienes <b>${pendientes}</b> reserva(s) por revisar.`, href: '/mis-garajes.html?tab=reservas', cta: 'Revisar' });
  }
  if (sinFotos > 0) {
    alertas.push({ tipo: 'amber', icon: 'image', txt: `<b>${sinFotos}</b> garaje(s) sin fotos. Las fotos aumentan las reservas.`, href: '/mis-garajes.html', cta: 'Agregar' });
  }
  if (espMant > 0) {
    alertas.push({ tipo: 'slate', icon: 'build', txt: `<b>${espMant}</b> espacio(s) en mantenimiento.`, href: '/mis-garajes.html', cta: 'Ver' });
  }
  if (inactivos > 0) {
    alertas.push({ tipo: 'slate', icon: 'visibility_off', txt: `<b>${inactivos}</b> garaje(s) inactivo(s) no aparecen en búsquedas.`, href: '/mis-garajes.html', cta: 'Activar' });
  }

  if (alertas.length === 0) {
    cont.innerHTML = `
      <div class="dsh-allok">
        <span class="material-symbols-outlined">task_alt</span>
        <span class="dsh-allok-txt">Todo en orden. No hay nada pendiente por ahora.</span>
      </div>`;
    return;
  }

  // Nota: el texto de cada alerta es estático (sin datos del usuario), seguro para innerHTML.
  cont.innerHTML = alertas.map(a => `
    <a href="${a.href}" class="dsh-alert dsh-alert--${a.tipo}">
      <span class="dsh-alert-ico"><span class="material-symbols-outlined">${a.icon}</span></span>
      <span class="dsh-alert-txt">${a.txt}</span>
      <span class="dsh-alert-cta">${a.cta}</span>
      <span class="material-symbols-outlined chev">chevron_right</span>
    </a>`).join('');
}

function renderRecientes(reservas) {
  const cont = document.getElementById('dshRecent');
  if (!cont) return;

  if (!reservas.length) {
    cont.innerHTML = `
      <div class="text-center text-muted py-3" style="font-size:.85rem;">
        <span class="material-symbols-outlined" style="font-size:2rem;color:#cbd5e1;display:block;margin-bottom:6px;">event_busy</span>
        Aún no recibes reservas. Cuando un conductor reserve, aparecerá aquí.
      </div>`;
    return;
  }

  const recientes = reservas.slice(0, 5);
  cont.innerHTML = recientes.map(r => {
    const nombre = escapeHTML(r.conductor_nombre || 'Conductor');
    const dir = escapeHTML((r.garaje_direccion || '').split(',')[0] || 'Garaje');
    const espacio = escapeHTML(r.numero_espacio || '—');
    const estado = String(r.estado || 'pendiente').toLowerCase();
    return `
      <div class="dsh-rsv">
        <span class="dsh-rsv-avatar">${escapeHTML(iniciales(r.conductor_nombre))}</span>
        <div class="dsh-rsv-main">
          <div class="dsh-rsv-name">${nombre}</div>
          <div class="dsh-rsv-meta">
            <span class="material-symbols-outlined">warehouse</span> ${dir}
            &nbsp;·&nbsp; Esp. ${espacio}
            &nbsp;·&nbsp; ${escapeHTML(fmtFecha(r.fecha_inicio))}
          </div>
        </div>
        <span class="rsv-badge rsv-badge--${escapeHTML(estado)}">${escapeHTML(estado)}</span>
      </div>`;
  }).join('');
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initTheme();
  initLogout();
  loadDashboard();
});
