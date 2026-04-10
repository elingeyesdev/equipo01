// ============================================================
// EstAirbnb - Plataforma de Alquiler de Parqueos
// server.js — Servidor principal Express
// ============================================================

const express = require('express');
const path = require('path');
const sql = require('mssql/msnodesqlv8');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');

// ------------------------------------------------------------
// Multer — Subida de fotos de perfil
// ------------------------------------------------------------
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads', 'perfiles');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `perfil_${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Solo se permiten imágenes (JPG, PNG, WEBP).'), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ------------------------------------------------------------
// Configuración de SQL Server — Windows Authentication (ODBC)
// ------------------------------------------------------------
const CONNECTION_STRING =
  'Driver={ODBC Driver 17 for SQL Server};' +
  'Server=ACHO;' +
  'Database=EstAirbnbDB;' +
  'Trusted_Connection=yes;';

let pool = null;

// Obtiene el pool, reconectando si es necesario
async function getPool() {
  if (!pool) {
    pool = await sql.connect({ connectionString: CONNECTION_STRING });
  }
  return pool;
}

// ------------------------------------------------------------
// Express — App y middlewares
// ------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ============================================================
// AUTH — Registro
// POST /api/auth/register
// Body: { nombre, apellidos, email, password, telefono? }
// ============================================================
app.post('/api/auth/register', async (req, res) => {
  console.log('\n📝 [POST /api/auth/register]');
  const { nombre, apellidos, email, password, telefono } = req.body;

  // Validaciones
  if (!nombre || nombre.trim().length < 2)
    return res.status(400).json({ status: 'error', message: 'El nombre es obligatorio.' });
  if (!apellidos || apellidos.trim().length < 2)
    return res.status(400).json({ status: 'error', message: 'Los apellidos son obligatorios.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ status: 'error', message: 'El correo no es válido.' });
  if (!password || password.length < 6)
    return res.status(400).json({ status: 'error', message: 'La contraseña debe tener al menos 6 caracteres.' });

  try {
    const db = await getPool();

    // Verificar si el email ya existe
    const existing = await db.request()
      .input('email', sql.VarChar(150), email.toLowerCase().trim())
      .query('SELECT id FROM Usuarios WHERE email = @email');

    if (existing.recordset.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Ya existe una cuenta con ese correo.' });
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar usuario
    const result = await db.request()
      .input('nombre', sql.NVarChar(100), nombre.trim())
      .input('apellidos', sql.NVarChar(100), apellidos.trim())
      .input('email', sql.NVarChar(150), email.toLowerCase().trim())
      .input('password', sql.NVarChar(255), hashedPassword)
      .input('telefono', sql.NVarChar(20), telefono ? telefono.trim() : null)
      .query(`
        INSERT INTO Usuarios (nombre, apellidos, email, password, telefono)
        OUTPUT INSERTED.id
        VALUES (@nombre, @apellidos, @email, @password, @telefono)
      `);

    const newId = result.recordset[0].id;
    console.log(`✅ Usuario registrado con ID: ${newId}`);

    return res.status(201).json({
      status: 'ok',
      message: '¡Cuenta creada exitosamente!',
      data: { id: newId, nombre: nombre.trim(), apellidos: apellidos.trim(), email: email.toLowerCase().trim() }
    });

  } catch (err) {
    console.error('❌ Error en registro:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al crear la cuenta.' });
  }
});

// ============================================================
// AUTH — Inicio de sesión
// POST /api/auth/login
// Body: { email, password }
// ============================================================
app.post('/api/auth/login', async (req, res) => {
  console.log('\n🔑 [POST /api/auth/login]');
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ status: 'error', message: 'Email y contraseña son obligatorios.' });

  try {
    const db = await getPool();

    const result = await db.request()
      .input('email', sql.NVarChar(150), email.toLowerCase().trim())
      .query('SELECT id, nombre, apellidos, email, password, telefono, foto_url FROM Usuarios WHERE email = @email');

    if (result.recordset.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Correo o contraseña incorrectos.' });
    }

    const user = result.recordset[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ status: 'error', message: 'Correo o contraseña incorrectos.' });
    }

    console.log(`✅ Login exitoso: ${user.email} (ID: ${user.id})`);

    return res.json({
      status: 'ok',
      message: '¡Bienvenido!',
      data: {
        id: user.id,
        nombre: user.nombre,
        apellidos: user.apellidos,
        email: user.email,
        telefono: user.telefono,
        foto_url: user.foto_url
      }
    });

  } catch (err) {
    console.error('❌ Error en login:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al iniciar sesión.' });
  }
});

// ============================================================
// PERFIL — Cargar datos
// GET /api/perfil/general?usuario_id=X
// ============================================================
app.get('/api/perfil/general', async (req, res) => {
  const usuario_id = parseInt(req.query.usuario_id, 10);
  console.log(`\n📖 [GET /api/perfil/general] ID: ${usuario_id}`);

  if (!usuario_id) {
    return res.status(400).json({ status: 'error', message: 'usuario_id requerido.' });
  }

  try {
    const db = await getPool();

    const result = await db.request()
      .input('usuario_id', sql.Int, usuario_id)
      .query('SELECT id, nombre, apellidos, telefono, email, foto_url FROM Usuarios WHERE id = @usuario_id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
    }

    console.log('✅ Perfil cargado:', result.recordset[0]);
    return res.json({ status: 'ok', data: result.recordset[0] });

  } catch (err) {
    console.error('❌ Error al cargar perfil:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al cargar el perfil.' });
  }
});

// ============================================================
// PERFIL — Actualizar
// PUT /api/perfil/general
// Body: { usuario_id, nombre, apellidos, telefono }
// ============================================================
app.put('/api/perfil/general', async (req, res) => {
  console.log('\n📩 [PUT /api/perfil/general]');
  const { usuario_id, nombre, apellidos, telefono } = req.body;
  console.log('📦 Datos:', { usuario_id, nombre, apellidos, telefono });

  if (!nombre || String(nombre).trim().length < 2)
    return res.status(400).json({ status: 'error', message: 'El nombre es obligatorio (mín. 2 caracteres).' });
  if (!apellidos || String(apellidos).trim().length < 2)
    return res.status(400).json({ status: 'error', message: 'Los apellidos son obligatorios (mín. 2 caracteres).' });

  try {
    const db = await getPool();

    const result = await db.request()
      .input('nombre', sql.NVarChar(100), String(nombre).trim())
      .input('apellidos', sql.NVarChar(100), String(apellidos).trim())
      .input('telefono', sql.NVarChar(20), telefono ? String(telefono).trim() : null)
      .input('usuario_id', sql.Int, parseInt(usuario_id, 10))
      .query(`
        UPDATE Usuarios
        SET nombre = @nombre, apellidos = @apellidos, telefono = @telefono
        WHERE id = @usuario_id
      `);

    console.log('✅ Filas afectadas:', result.rowsAffected[0]);

    if (result.rowsAffected[0] === 0)
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });

    return res.json({ status: 'ok', message: '¡Perfil actualizado correctamente!', data: { usuario_id, nombre, apellidos, telefono } });

  } catch (err) {
    console.error('❌ Error al actualizar:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al actualizar el perfil.' });
  }
});

// ============================================================
// FOTO DE PERFIL — Subir y guardar
// POST /api/perfil/upload-foto
// ============================================================
app.post('/api/perfil/upload-foto', (req, res) => {
  const uploader = upload.single('foto');

  uploader(req, res, async (err) => {
    // Error de Multer (tipo de archivo, tamaño, etc.)
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'La imagen no puede superar los 5 MB.'
        : err.message || 'Error al procesar la imagen.';
      return res.status(400).json({ status: 'error', message: msg });
    }

    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No se recibió ningún archivo.' });
    }

    const usuario_id = parseInt(req.body.usuario_id, 10);
    if (!usuario_id) {
      fs.unlinkSync(req.file.path); // Borrar archivo huérfano
      return res.status(400).json({ status: 'error', message: 'usuario_id requerido.' });
    }

    const foto_url = `/uploads/perfiles/${req.file.filename}`;
    console.log(`\n🖼️  [POST /api/perfil/upload-foto] Archivo: ${foto_url} | Usuario: ${usuario_id}`);

    try {
      const db = await getPool();

      // Obtener foto anterior para borrarla del disco
      const prev = await db.request()
        .input('id', sql.Int, usuario_id)
        .query('SELECT foto_url FROM Usuarios WHERE id = @id');

      const prevUrl = prev.recordset[0]?.foto_url;
      if (prevUrl) {
        const prevPath = path.join(__dirname, 'public', prevUrl);
        if (fs.existsSync(prevPath)) fs.unlinkSync(prevPath);
      }

      // Guardar nueva ruta en la BD
      await db.request()
        .input('foto_url', sql.NVarChar(255), foto_url)
        .input('usuario_id', sql.Int, usuario_id)
        .query('UPDATE Usuarios SET foto_url = @foto_url WHERE id = @usuario_id');

      console.log('✅ foto_url guardada en BD:', foto_url);
      return res.json({ status: 'ok', message: '¡Foto actualizada!', foto_url });

    } catch (dbErr) {
      console.error('❌ Error BD al guardar foto:', dbErr.message);
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ status: 'error', message: 'Error interno al guardar la foto.' });
    }
  });
});

// ============================================================
// SEGURIDAD — Cambio de contraseña
// PUT /api/perfil/seguridad/password
// Body: { usuario_id, passwordActual, passwordNueva }
// ============================================================
app.put('/api/perfil/seguridad/password', async (req, res) => {
  console.log('\n🔐 [PUT /api/perfil/seguridad/password]');
  const { usuario_id, passwordActual, passwordNueva } = req.body;

  if (!usuario_id)
    return res.status(400).json({ status: 'error', message: 'usuario_id requerido.' });
  if (!passwordActual)
    return res.status(400).json({ status: 'error', message: 'La contraseña actual es obligatoria.' });
  if (!passwordNueva || passwordNueva.length < 6)
    return res.status(400).json({ status: 'error', message: 'La nueva contraseña debe tener al menos 6 caracteres.' });

  try {
    const db = await getPool();

    // Obtener hash actual del usuario
    const result = await db.request()
      .input('id', sql.Int, parseInt(usuario_id, 10))
      .query('SELECT password FROM Usuarios WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
    }

    const hashActual = result.recordset[0].password;

    // Comparar contraseña actual con el hash
    const coincide = await bcrypt.compare(passwordActual, hashActual);
    if (!coincide) {
      console.log('❌ La contraseña actual no coincide');
      return res.status(401).json({ status: 'error', message: 'La contraseña actual es incorrecta.' });
    }

    // Hashear la nueva contraseña
    const nuevoHash = await bcrypt.hash(passwordNueva, 10);

    // Actualizar en la BD
    await db.request()
      .input('password', sql.NVarChar(255), nuevoHash)
      .input('id', sql.Int, parseInt(usuario_id, 10))
      .query('UPDATE Usuarios SET password = @password WHERE id = @id');

    console.log('✅ Contraseña actualizada para usuario:', usuario_id);

    return res.json({ status: 'ok', message: '¡Contraseña actualizada correctamente!' });

  } catch (err) {
    console.error('❌ Error al cambiar contraseña:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al cambiar la contraseña.' });
  }
});

// ============================================================
// Status
// ============================================================
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'EstAirbnb API funcionando', timestamp: new Date().toISOString() });
});

// ============================================================
// Arranque
// ============================================================
async function startServer() {
  try {
    console.log('⏳ Conectando a SQL Server (Windows Auth)...');
    pool = await sql.connect({ connectionString: CONNECTION_STRING });
    console.log('✅ Conexión establecida correctamente.');

    app.listen(PORT, () => {
      console.log('');
      console.log('🚗 ══════════════════════════════════════════════');
      console.log(`🚗  EstAirbnb :: puerto ${PORT}`);
      console.log(`🚗  Login:    http://localhost:${PORT}/login.html`);
      console.log(`🚗  Registro: http://localhost:${PORT}/register.html`);
      console.log('🚗 ══════════════════════════════════════════════');
      console.log('');
    });

  } catch (err) {
    console.error('❌ No se pudo conectar a SQL Server:', err.message);
    process.exit(1);
  }
}

startServer();

// Ancla: evita que Node.js muera en Windows
setInterval(() => { }, 1000 * 60 * 60);
