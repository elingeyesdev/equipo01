// ============================================================
// EstAirbnb — detalle.js
// Lógica para la Vista de Detalle de un Garaje
// ============================================================

(function () {
  'use strict';

  // ─── Session Check ───
  const USUARIO_KEY = 'estairbnb_user';
  const currentUser = JSON.parse(localStorage.getItem(USUARIO_KEY) || 'null');

  // Si no está logueado, redirigir a login
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }

  // Si es Anfitrión (rol_id = 1), no puede ver Detalle
  if (currentUser.rol_id === 1) {
    window.location.href = '/mis-garajes.html';
    return;
  }

  // ─── DOM References ───
  const loadingDetalle   = document.getElementById('loadingDetalle');
  const errorDetalle     = document.getElementById('errorDetalle');
  const detalleContent   = document.getElementById('detalleContent');
  const carouselSection  = document.getElementById('carouselSection');
  const breadcrumbTitle  = document.getElementById('breadcrumbTitle');

  const garajeTitulo     = document.getElementById('garajeTitulo');
  const garajeDireccion  = document.getElementById('garajeDireccion');
  const garajePrecio     = document.getElementById('garajePrecio');
  const garajeTipo       = document.getElementById('garajeTipo');
  const tipoIcon         = document.getElementById('tipoIcon');
  const garajeDescripcion = document.getElementById('garajeDescripcion');
  const descripcionContainer = document.getElementById('descripcionContainer');
  
  // Reserva elements
  const fechaEntrada     = document.getElementById('fechaEntrada');
  const fechaSalida      = document.getElementById('fechaSalida');
  const resumenPrecio    = document.getElementById('resumenPrecio');
  const textoHoras       = document.getElementById('textoHoras');
  const textoTotal       = document.getElementById('textoTotal');
  const btnReserva       = document.getElementById('btnReserva');
  const reservaAlert     = document.getElementById('reservaAlert');

  // Modal elements
  const modalCheckout       = document.getElementById('modalCheckout');
  const modalEntrada        = document.getElementById('modalEntrada');
  const modalSalida         = document.getElementById('modalSalida');
  const modalHoras          = document.getElementById('modalHoras');
  const modalSubtotal       = document.getElementById('modalSubtotal');
  const modalTarifa         = document.getElementById('modalTarifa');
  const modalTotal          = document.getElementById('modalTotal');
  const checkAcepto         = document.getElementById('checkAcepto');
  const btnConfirmarReserva = document.getElementById('btnConfirmarReserva');

  let garajeCargado = null; // Guardar toda la data de garaje

  const btnThemeToggle   = document.getElementById('btnThemeToggle');
  const themeIcon        = document.getElementById('themeIcon');

  // ─── Vehicle type config ───
  const TIPO_CONFIG = {
    auto:      { label: '🚗 Auto',          icon: 'fa-car' },
    moto:      { label: '🏍️ Moto',          icon: 'fa-motorcycle' },
    camioneta: { label: '🚙 Camioneta / SUV', icon: 'fa-truck-pickup' }
  };

  // ─── Theme Toggle ───
  function initTheme() {
    const saved = localStorage.getItem('estairbnb_theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeIcon.classList.replace('fa-moon', 'fa-sun');
    }
  }

  btnThemeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      themeIcon.classList.replace('fa-sun', 'fa-moon');
      localStorage.setItem('estairbnb_theme', 'light');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeIcon.classList.replace('fa-moon', 'fa-sun');
      localStorage.setItem('estairbnb_theme', 'dark');
    }
  });

  // ─── Get ID from URL ───
  function getGarajeId() {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get('id'), 10);
  }

  // ─── Build Bootstrap 5 Carousel ───
  function renderCarousel(fotos) {
    if (!fotos || fotos.length === 0) {
      carouselSection.innerHTML = `
        <div class="carousel-placeholder">
          <i class="fa-solid fa-image"></i>
          <span>Este espacio no tiene fotos</span>
        </div>`;
      return;
    }

    const indicators = fotos.map((_, i) => `
      <button type="button" data-bs-target="#garajeCarousel" data-bs-slide-to="${i}"
              class="${i === 0 ? 'active' : ''}" aria-label="Foto ${i + 1}"
              ${i === 0 ? 'aria-current="true"' : ''}></button>
    `).join('');

    const items = fotos.map((foto, i) => `
      <div class="carousel-item ${i === 0 ? 'active' : ''}">
        <img src="${foto.foto_url}" alt="Foto ${i + 1} del parqueo" loading="lazy">
      </div>
    `).join('');

    const showControls = fotos.length > 1;

    carouselSection.innerHTML = `
      <div id="garajeCarousel" class="carousel slide" data-bs-ride="carousel" data-bs-interval="5000">
        ${showControls ? `<div class="carousel-indicators">${indicators}</div>` : ''}
        <div class="carousel-inner">
          ${items}
        </div>
        ${showControls ? `
        <button class="carousel-control-prev" type="button" data-bs-target="#garajeCarousel" data-bs-slide="prev">
          <span class="carousel-control-prev-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Anterior</span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#garajeCarousel" data-bs-slide="next">
          <span class="carousel-control-next-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Siguiente</span>
        </button>
        ` : ''}
      </div>
    `;
  }

  // ─── Render Garaje Info ───
  function renderInfo(garaje) {
    // Title and address
    garajeTitulo.textContent = garaje.direccion;
    garajeDireccion.textContent = garaje.direccion;
    breadcrumbTitle.textContent = garaje.direccion;

    // Update page title
    document.title = `${garaje.direccion} · EstAirbnb`;

    // Price
    const precio = parseFloat(garaje.precio_hora).toFixed(2);
    garajePrecio.innerHTML = `Bs. ${precio} <small>/ hora</small>`;

    // Vehicle type
    const config = TIPO_CONFIG[garaje.tipo_vehiculo] || { label: garaje.tipo_vehiculo, icon: 'fa-car' };
    garajeTipo.textContent = config.label;
    tipoIcon.className = `fa-solid ${config.icon}`;

    // Description
    if (garaje.descripcion && garaje.descripcion.trim()) {
      garajeDescripcion.textContent = garaje.descripcion;
      descripcionContainer.style.display = 'flex';
    } else {
      descripcionContainer.style.display = 'none';
    }
  }

  // ─── Fetch Garaje Detail ───
  async function cargarDetalle() {
    const id = getGarajeId();

    if (!id) {
      showError();
      return;
    }

    try {
      const response = await fetch(`/api/explorar/${id}`);
      const json = await response.json();

      loadingDetalle.style.display = 'none';

      if (json.status !== 'ok' || !json.data) {
        showError();
        return;
      }

      const garaje = json.data;
      garajeCargado = garaje; // Almacenar en la variable global

      // Render sections
      renderCarousel(garaje.fotos);
      renderInfo(garaje);

      // Show content
      detalleContent.style.display = 'grid';

      // Verificar si ya tiene una reserva aquí
      await verificarReservaExistente();

    } catch (err) {
      console.error('Error al cargar detalle:', err);
      showError();
    }
  }

  function showError() {
    loadingDetalle.style.display = 'none';
    errorDetalle.style.display = 'block';
    detalleContent.style.display = 'none';
  }

  // ─── Lógica de Precios en Vivo ───
  function calcularPrecio() {
    reservaAlert.style.display = 'none';
    if (!fechaEntrada.value || !fechaSalida.value || !garajeCargado) {
      resumenPrecio.style.setProperty('display', 'none', 'important');
      btnReserva.disabled = true;
      return;
    }

    const start = new Date(fechaEntrada.value).getTime();
    const end = new Date(fechaSalida.value).getTime();

    if (end <= start) {
      resumenPrecio.style.setProperty('display', 'none', 'important');
      btnReserva.disabled = true;
      return;
    }

    const difMs = end - start;
    const difHoras = Math.ceil(difMs / (1000 * 60 * 60));
    const total = difHoras * parseFloat(garajeCargado.precio_hora);

    textoHoras.textContent = `${difHoras} hora${difHoras > 1 ? 's' : ''} x Bs. ${parseFloat(garajeCargado.precio_hora).toFixed(2)}`;
    textoTotal.textContent = `Bs. ${total.toFixed(2)}`;
    
    resumenPrecio.style.setProperty('display', 'flex', 'important');
    btnReserva.disabled = false;
  }

  fechaEntrada.addEventListener('change', calcularPrecio);
  fechaSalida.addEventListener('change', calcularPrecio);

  // ─── Verificar si ya tiene reserva ───
  async function verificarReservaExistente() {
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
    // Ocultar formulario de reservas e inyectar el aviso
    const reservaCard = document.querySelector('.reserva-card');
    if(reservaCard) {
      reservaCard.innerHTML = `
        <div class="text-center p-3 animate-fade-in">
          <h5 class="text-success mb-3" style="font-weight: 700;"><i class="fa-solid fa-circle-check fa-lg text-success mb-2"></i><br>¡Ya tienes una reserva para este lugar!</h5>
          <p class="text-muted" style="font-size:0.9rem;">Revisa tu panel de gestión de reservas para conocer más detalles y el estado actual de tu solicitud.</p>
          <a href="/mis-reservas.html" class="btn btn-primary w-100 mt-2" style="font-weight: 600;"><i class="fa-solid fa-calendar-days"></i> Ir a mis reservas</a>
        </div>
      `;
    }
  }

  // ─── Interceptar Botón para abrir el Checkout ───
  btnReserva.addEventListener('click', () => {
    if (!garajeCargado || !fechaEntrada.value || !fechaSalida.value) return;

    const start = new Date(fechaEntrada.value);
    const end = new Date(fechaSalida.value);

    if (end <= start) {
      alert('Las fechas seleccionadas son inválidas.');
      return;
    }

    const difMs = end.getTime() - start.getTime();
    const difHoras = Math.ceil(difMs / (1000 * 60 * 60));
    
    // Cálculo de Costos Oficiales
    const subtotal = difHoras * parseFloat(garajeCargado.precio_hora);
    const tarifa_servicio = subtotal * 0.10; // 10%
    const total = subtotal + tarifa_servicio;

    // Pintar Modal
    // Usamos split('T') para mostrarlo más amigable o simplemente toLocaleString
    modalEntrada.textContent = start.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    modalSalida.textContent = end.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    
    modalHoras.textContent = difHoras;
    modalSubtotal.textContent = `Bs. ${subtotal.toFixed(2)}`;
    modalTarifa.textContent = `Bs. ${tarifa_servicio.toFixed(2)}`;
    modalTotal.textContent = `Bs. ${total.toFixed(2)}`;

    // Resetear Controles del Modal
    checkAcepto.checked = false;
    btnConfirmarReserva.disabled = true;

    // Abrir Modal
    const modalIns = new bootstrap.Modal(modalCheckout);
    modalIns.show();
  });

  // ─── Checkbox Aceptación ───
  checkAcepto.addEventListener('change', (e) => {
    btnConfirmarReserva.disabled = !e.target.checked;
  });

  // ─── Confirmar y Llamar a la API ───
  btnConfirmarReserva.addEventListener('click', async () => {
    if (!garajeCargado || !fechaEntrada.value || !fechaSalida.value) return;

    const originalText = btnConfirmarReserva.innerHTML;
    btnConfirmarReserva.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Confirmando...';
    btnConfirmarReserva.disabled = true;

    try {
      const response = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garaje_id: garajeCargado.id,
          usuario_id: currentUser.id,
          fecha_inicio: fechaEntrada.value,
          fecha_fin: fechaSalida.value
        })
      });

      const json = await response.json();

      if (response.ok && json.status === 'ok') {
        const modalIns = bootstrap.Modal.getInstance(modalCheckout);
        modalIns.hide();
        
        // Simular éxito y cambio de UI como el verificarReservaExistente
        mostrarUIReservaExistente();
        alert('Reserva solicitada exitosamente. El anfitrión será notificado.');
      } else {
        // Error como double-booking
        alert(json.message || 'Error al procesar la reserva.');
        btnConfirmarReserva.innerHTML = originalText;
        btnConfirmarReserva.disabled = false;
      }

    } catch (err) {
      console.error(err);
      alert('Error de red al procesar tu solicitud.');
      btnConfirmarReserva.innerHTML = originalText;
      btnConfirmarReserva.disabled = false;
    }
  });

  // ─── Init ───
  initTheme();
  cargarDetalle();

})();
