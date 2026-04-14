// ============================================================
// EstAirbnb — register.js
// Lógica de la página de registro
// ============================================================

const USUARIO_KEY = 'estairbnb_user';

// Si ya está logueado, redirigir directo
if (localStorage.getItem(USUARIO_KEY)) {
  window.location.href = '/configuracion.html';
}

// ============================================================
// Toggle password
// ============================================================
document.getElementById('togglePw').addEventListener('click', () => {
  const pw   = document.getElementById('inpPassword');
  const icon = document.getElementById('eyeIcon');
  const show = pw.type === 'password';
  pw.type    = show ? 'text' : 'password';
  icon.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
});

// ============================================================
// Indicador de fortaleza de contraseña
// ============================================================
document.getElementById('inpPassword').addEventListener('input', function () {
  const v = this.value;
  let score = 0;
  if (v.length >= 6)  score++;
  if (v.length >= 10) score++;
  if (/[A-Z]/.test(v)) score++;
  if (/[0-9]/.test(v)) score++;
  if (/[^A-Za-z0-9]/.test(v)) score++;

  const fill   = document.getElementById('strengthFill');
  const label  = document.getElementById('strengthLabel');
  const colors = ['#dc3545','#fd7e14','#ffc107','#28a745','#1a7a42'];
  const labels = ['Muy débil','Débil','Aceptable','Fuerte','Muy fuerte'];
  fill.style.width      = `${(score / 5) * 100}%`;
  fill.style.background = colors[score - 1] || '#e4e6eb';
  label.textContent     = score > 0 ? labels[score - 1] : '';
});

// ============================================================
// Alertas
// ============================================================
function showAlert(msg, type = 'error') {
  const box  = document.getElementById('alertBox');
  const icon = document.getElementById('alertIcon');
  box.className = `alert-box ${type}`;
  icon.className = type === 'error'
    ? 'fa-solid fa-circle-exclamation'
    : 'fa-solid fa-circle-check';
  document.getElementById('alertMsg').textContent = msg;
}

function hideAlert() {
  document.getElementById('alertBox').className = 'alert-box';
}

function setFieldError(id, errId, show) {
  document.getElementById(id).classList.toggle('is-invalid', show);
  document.getElementById(errId).classList.toggle('show', show);
}

// ============================================================
// Submit del formulario de registro
// ============================================================
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const nombre    = document.getElementById('inpNombre').value.trim();
  const apellidos = document.getElementById('inpApellidos').value.trim();
  const email     = document.getElementById('inpEmail').value.trim();
  const telefono  = document.getElementById('inpTelefono').value.trim();
  const password  = document.getElementById('inpPassword').value;
  const confirm   = document.getElementById('inpConfirm').value;

  // Validaciones
  let valid = true;
  setFieldError('inpNombre',    'errNombre',    nombre.length < 2);    if (nombre.length    < 2) valid = false;
  setFieldError('inpApellidos', 'errApellidos', apellidos.length < 2); if (apellidos.length < 2) valid = false;
  setFieldError('inpEmail',     'errEmail',     !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) valid = false;
  setFieldError('inpPassword', 'errPassword', password.length < 6); if (password.length < 6) valid = false;
  setFieldError('inpConfirm',  'errConfirm',  password !== confirm);  if (password !== confirm)  valid = false;
  if (!valid) return;

  const btn = document.getElementById('btnRegister');
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Creando cuenta...`;

  try {
    const res  = await fetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombre, apellidos, email, password, telefono }),
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      // Guardar sesión y redirigir
      localStorage.setItem(USUARIO_KEY, JSON.stringify(data.data));
      showAlert('¡Cuenta creada! Redirigiendo...', 'success');
      setTimeout(() => { window.location.href = '/configuracion.html'; }, 900);
    } else {
      showAlert(data.message || 'Error al crear la cuenta.');
      btn.disabled = false;
      btn.innerHTML = origHTML;
    }
  } catch (err) {
    showAlert('No se pudo conectar con el servidor.');
    btn.disabled = false;
    btn.innerHTML = origHTML;
  }
});
