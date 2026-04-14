// ============================================================
// EstAirbnb — login.js
// Lógica de la página de inicio de sesión
// ============================================================

const USUARIO_KEY = 'estairbnb_user';

// Si ya está logueado, redirigir directo
if (localStorage.getItem(USUARIO_KEY)) {
  window.location.href = '/configuracion.html';
}

// ============================================================
// Toggle mostrar/ocultar contraseña
// ============================================================
document.getElementById('togglePw').addEventListener('click', () => {
  const inp  = document.getElementById('inpPassword');
  const icon = document.getElementById('eyeIcon');
  const show = inp.type === 'password';
  inp.type   = show ? 'text' : 'password';
  icon.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
});

// ============================================================
// Alertas
// ============================================================
function showAlert(msg, type = 'error') {
  const box = document.getElementById('alertBox');
  box.className = `alert-box ${type}`;
  document.getElementById('alertMsg').textContent = msg;
}

function hideAlert() {
  document.getElementById('alertBox').className = 'alert-box';
}

// ============================================================
// Submit del formulario de login
// ============================================================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const email    = document.getElementById('inpEmail').value.trim();
  const password = document.getElementById('inpPassword').value;

  // Validación
  let valid = true;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('errEmail').classList.add('show');
    document.getElementById('inpEmail').classList.add('is-invalid');
    valid = false;
  } else {
    document.getElementById('errEmail').classList.remove('show');
    document.getElementById('inpEmail').classList.remove('is-invalid');
  }
  if (!password) {
    document.getElementById('errPassword').classList.add('show');
    document.getElementById('inpPassword').classList.add('is-invalid');
    valid = false;
  } else {
    document.getElementById('errPassword').classList.remove('show');
    document.getElementById('inpPassword').classList.remove('is-invalid');
  }
  if (!valid) return;

  const btn = document.getElementById('btnLogin');
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Verificando...`;

  try {
    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      // Guardar sesión en localStorage
      localStorage.setItem(USUARIO_KEY, JSON.stringify(data.data));
      showAlert('¡Bienvenido! Redirigiendo...', 'success');
      setTimeout(() => { window.location.href = '/configuracion.html'; }, 800);
    } else {
      showAlert(data.message || 'Error al iniciar sesión.');
      btn.disabled = false;
      btn.innerHTML = origHTML;
    }
  } catch (err) {
    showAlert('No se pudo conectar con el servidor.');
    btn.disabled = false;
    btn.innerHTML = origHTML;
  }
});
