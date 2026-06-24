// EstAirbnb — Notificaciones para el conductor.
// Avisa cuando el anfitrión ACEPTA (confirma) una reserva.
// No requiere cambios en el backend: consulta /api/reservas/mis-reservas
// periódicamente y detecta las reservas que pasaron a "confirmada".
(function () {
  const user = JSON.parse(localStorage.getItem('estairbnb_user') || 'null');
  if (!user || !user.id || user.rol_id === 1) return; // solo conductor logueado

  const SEEN_KEY = 'estairbnb_seen_confirmadas';
  const INIT_KEY = 'estairbnb_notif_init';
  const INTERVALO = 45000; // 45 s

  // Pedir permiso de notificaciones del sistema (con un gesto, para que el navegador no lo bloquee)
  if ('Notification' in window && Notification.permission === 'default') {
    const pedir = () => { try { Notification.requestPermission(); } catch (_) {} window.removeEventListener('pointerdown', pedir); };
    window.addEventListener('pointerdown', pedir, { once: true });
  }

  const getSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch (_) { return new Set(); } };
  const saveSeen = (s) => localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));

  function toast(titulo, detalle) {
    let el = document.getElementById('estNotifToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'estNotifToast';
      el.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%) translateY(20px);z-index:99999;max-width:92%;background:#0A2A43;color:#fff;padding:12px 15px;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.32);display:flex;align-items:flex-start;gap:10px;opacity:0;transition:opacity .25s ease,transform .25s ease;pointer-events:none;font-family:Inter,system-ui,sans-serif;';
      el.innerHTML = '<span class="material-symbols-outlined" style="color:#2dd4bf;font-size:22px;flex-shrink:0">notifications_active</span><span><b class="ent-t" style="display:block;font-size:.88rem"></b><span class="ent-d" style="font-size:.8rem;opacity:.85"></span></span>';
      document.body.appendChild(el);
    }
    el.querySelector('.ent-t').textContent = titulo;
    el.querySelector('.ent-d').textContent = detalle || '';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.opacity = '1'; el.style.transform = 'translateX(-50%) translateY(0)';
    }));
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(-50%) translateY(20px)'; }, 5500);
  }

  function notificar(titulo, cuerpo) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const opts = { body: cuerpo, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'est-reserva', renotify: true };
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification(titulo, opts)).catch(() => { try { new Notification(titulo, opts); } catch (_) {} });
      } else { try { new Notification(titulo, opts); } catch (_) {} }
    }
    toast(titulo, cuerpo); // aviso dentro de la app siempre
  }

  async function revisar() {
    try {
      const res = await fetch(`/api/reservas/mis-reservas?usuario_id=${user.id}&rol_id=2`);
      const json = await res.json();
      if (!json || json.status !== 'ok' || !Array.isArray(json.data)) return;

      const confirmadas = json.data.filter(r => r.estado === 'confirmada');
      const seen = getSeen();

      // Primera ejecución: tomar las confirmadas actuales como "ya vistas" (sin avisar)
      if (!localStorage.getItem(INIT_KEY)) {
        confirmadas.forEach(r => seen.add(r.id));
        saveSeen(seen);
        localStorage.setItem(INIT_KEY, '1');
        return;
      }

      let nuevas = 0;
      confirmadas.forEach(r => {
        if (!seen.has(r.id)) {
          seen.add(r.id); nuevas++;
          const lugar = (r.garaje_direccion || '').split(',')[0] || 'tu garaje';
          notificar('¡Reserva aceptada!', `El anfitrión confirmó tu reserva en ${lugar}.`);
        }
      });
      if (nuevas) saveSeen(seen);
    } catch (_) { /* sin conexión */ }
  }

  revisar();
  setInterval(revisar, INTERVALO);
})();
