// ============================================================
// EstAirbnb — mis-favoritos.js
// Lógica para la página de Favoritos del Conductor
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

  // Solo conductores pueden ver favoritos
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

  // ─── Vehicle Labels ───
  const TIPO_LABELS = {
    auto: '🚗 Auto',
    moto: '🏍️ Moto',
    camioneta: '🚙 Camioneta'
  };

  // ─── Load Favorites ───
  async function cargarFavoritos() {
    loadingFavs.style.display = 'flex';
    emptyFavs.style.display = 'none';
    favsGrid.innerHTML = '';
    favCounter.style.display = 'none';

    try {
      const resp = await fetch(`/api/favoritos?conductor_id=${currentUser.id}`);
      const json = await resp.json();

      loadingFavs.style.display = 'none';

      if (json.status !== 'ok' || !json.data || json.data.length === 0) {
        emptyFavs.style.display = 'flex';
        return;
      }

      const favoritos = json.data;

      // Counter
      favTotal.textContent = favoritos.length;
      favCounter.style.display = 'inline-flex';

      // Render
      favoritos.forEach((fav, index) => {
        const card = crearTarjetaFavorito(fav, index);
        favsGrid.appendChild(card);
      });

    } catch (err) {
      console.error('Error al cargar favoritos:', err);
      loadingFavs.style.display = 'none';
      emptyFavs.style.display = 'flex';
    }
  }

  // ─── Create Favorite Card ───
  function crearTarjetaFavorito(fav, index) {
    const card = document.createElement('div');
    card.className = 'fav-card';
    card.dataset.garajeId = fav.garaje_id;
    card.style.animationDelay = `${0.05 * (index % 6)}s`;

    // Image
    let imagenHTML;
    if (fav.foto_portada) {
      imagenHTML = `<img src="${fav.foto_portada}" alt="Foto de ${fav.direccion}" loading="lazy">`;
    } else {
      imagenHTML = `
        <div class="fav-card-placeholder">
          <i class="fa-solid fa-image"></i>
          <span>Sin foto</span>
        </div>`;
    }

    const tipoLabel = TIPO_LABELS[fav.tipo_vehiculo] || fav.tipo_vehiculo;
    const precio = parseFloat(fav.precio_hora).toFixed(2);
    const hostName = [fav.anfitrion_nombre, fav.anfitrion_apellidos].filter(Boolean).join(' ') || 'Anfitrión';
    const isInactive = !fav.estado_activo;

    // Fecha formateada
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
          ${fechaAgg ? `<span style="margin-left:auto; font-size:0.68rem; color:#a0a0a0;">Guardado ${fechaAgg}</span>` : ''}
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
            ? '<span style="color:#ba1a1a; font-size:0.78rem; font-weight:600;">Inactivo</span>'
            : `<a href="/detalle-garaje.html?id=${fav.garaje_id}" class="fav-card-action">
                Reservar <i class="fa-solid fa-arrow-right"></i>
              </a>`
          }
        </div>
      </div>
    `;

    // Attach remove handler
    const removeBtn = card.querySelector('.fav-card-remove');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleRemoveFavorite(fav.garaje_id, card);
    });

    return card;
  }

  // ─── Remove Favorite ───
  async function handleRemoveFavorite(garajeId, cardEl) {
    // Animate out
    cardEl.classList.add('removing');

    try {
      const resp = await fetch('/api/favoritos/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conductor_id: currentUser.id, garaje_id: garajeId })
      });
      const json = await resp.json();

      if (json.status === 'ok' && !json.favorito) {
        // Wait for animation to finish, then remove
        setTimeout(() => {
          cardEl.remove();

          // Update counter
          const remaining = favsGrid.querySelectorAll('.fav-card').length;
          if (remaining === 0) {
            favCounter.style.display = 'none';
            emptyFavs.style.display = 'flex';
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
  cargarFavoritos();

})();
