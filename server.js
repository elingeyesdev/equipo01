// ============================================================
// EstAirbnb - Plataforma de Alquiler de Parqueos
// server.js — Servidor principal Express
// ============================================================
console.log("🔥 ESTE ES MI SERVER NUEVO 🔥");
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
// Multer — Subida de fotos de garajes (hasta 5 por publicación)
// ------------------------------------------------------------
const GARAJES_DIR = path.join(__dirname, 'public', 'uploads', 'garajes');
if (!fs.existsSync(GARAJES_DIR)) fs.mkdirSync(GARAJES_DIR, { recursive: true });

const storageGarajes = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, GARAJES_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `garaje_${Date.now()}_${Math.round(Math.random() * 1000)}${ext}`;
    cb(null, filename);
  },
});

const uploadGarajes = multer({
  storage: storageGarajes,
  fileFilter,              // Reutiliza el mismo filtro de imágenes
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ------------------------------------------------------------
// Configuración de SQL Server — Windows Authentication (ODBC)
// ------------------------------------------------------------
const CONNECTION_STRING =
  'Driver={ODBC Driver 17 for SQL Server};' +
  'Server=DESKTOP-56G7UA1\\SQLEXPRESS;' +
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
// Body: { nombre, apellidos, email, password, telefono?, rol }
// rol: 'anfitrion' | 'conductor'
// ============================================================
app.post('/api/auth/register', async (req, res) => {
  console.log('\n📝 [POST /api/auth/register]');
  const { nombre, apellidos, email, password, telefono, rol } = req.body;

  // Validaciones
  if (!nombre || nombre.trim().length < 2)
    return res.status(400).json({ status: 'error', message: 'El nombre es obligatorio.' });
  if (!apellidos || apellidos.trim().length < 2)
    return res.status(400).json({ status: 'error', message: 'Los apellidos son obligatorios.' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ status: 'error', message: 'El correo no es válido.' });
  if (!password || password.length < 6)
    return res.status(400).json({ status: 'error', message: 'La contraseña debe tener al menos 6 caracteres.' });

  // Validar rol seleccionado
  const rolesValidos = { anfitrion: 1, conductor: 2 };
  const rol_id = rolesValidos[rol];
  if (!rol_id)
    return res.status(400).json({ status: 'error', message: 'Debes seleccionar un rol válido (anfitrion o conductor).' });

  const rol_nombre = rol; // 'anfitrion' o 'conductor'

  try {
    const db = await getPool();

    // Verificar si el email ya existe
    const existing = await db.request()
      .input('email', sql.VarChar(150), email.toLowerCase().trim())
      .query('SELECT id FROM Credenciales WHERE email = @email');

    if (existing.recordset.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Ya existe una cuenta con ese correo.' });
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar Credenciales
    const result = await db.request()
      .input('email', sql.NVarChar(150), email.toLowerCase().trim())
      .input('password', sql.NVarChar(255), hashedPassword)
      .input('rol', sql.VarChar(50), rol) // 'anfitrion' o 'conductor'
      .query(`
        INSERT INTO Credenciales (email, password_hash, rol)
        OUTPUT INSERTED.id
        VALUES (@email, @password, @rol)
      `);

    const newId = result.recordset[0].id;

    // Insertar Perfil (Subtabla)
    const reqProfile = db.request()
      .input('id', sql.Int, newId)
      .input('nombre', sql.VarChar(255), nombre.trim())
      .input('apellidos', sql.VarChar(255), apellidos.trim())
      .input('telefono', sql.VarChar(20), telefono ? telefono.trim() : null);

    if (rol === 'conductor') {
      await reqProfile.query(`
        INSERT INTO UsuarioConductor (id, nombre, apellidos, telefono)
        VALUES (@id, @nombre, @apellidos, @telefono)
      `);
    } else {
      await reqProfile.query(`
        INSERT INTO UsuarioAnfitrion (id, nombre, apellidos, telefono)
        VALUES (@id, @nombre, @apellidos, @telefono)
      `);
    }

    console.log(`✅ Usuario registrado con ID: ${newId} | Rol: ${rol_nombre}`);

    return res.status(201).json({
      status: 'ok',
      message: '¡Cuenta creada exitosamente!',
      data: {
        id: newId,
        nombre: nombre.trim(),
        apellidos: apellidos.trim(),
        email: email.toLowerCase().trim(),
        rol_id,
        rol_nombre
      }
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
      .query(`
        SELECT c.id, c.email, c.password_hash AS password, c.rol AS rol_nombre,
               ISNULL(a.nombre, u.nombre) AS nombre,
               ISNULL(a.apellidos, u.apellidos) AS apellidos,
               ISNULL(a.telefono, u.telefono) AS telefono
        FROM Credenciales c
        LEFT JOIN UsuarioAnfitrion a ON c.id = a.id AND c.rol = 'anfitrion'
        LEFT JOIN UsuarioConductor u ON c.id = u.id AND c.rol = 'conductor'
        WHERE c.email = @email
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Correo o contraseña incorrectos.' });
    }

    const user = result.recordset[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ status: 'error', message: 'Correo o contraseña incorrectos.' });
    }

    console.log(`✅ Login exitoso: ${user.email} (ID: ${user.id}) | Rol: ${user.rol_nombre}`);

    // Shim para que UI funcione
    const mapped_rol_id = user.rol_nombre === 'anfitrion' ? 1 : 2;

    return res.json({
      status: 'ok',
      message: '¡Bienvenido!',
      data: {
        id: user.id,
        nombre: user.nombre || '',
        apellidos: user.apellidos || '',
        email: user.email,
        telefono: user.telefono || '',
        foto_url: null, // Ya no existe directamente en la DB actual
        rol_id: mapped_rol_id,
        rol_nombre: user.rol_nombre
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
      .query(`
        SELECT c.id, c.email, c.rol AS rol_nombre,
               ISNULL(a.nombre, u.nombre) AS nombre,
               ISNULL(a.apellidos, u.apellidos) AS apellidos,
               ISNULL(a.telefono, u.telefono) AS telefono,
               u.tipo_vehiculo_defecto,
               u.zona_preferencia
        FROM Credenciales c
        LEFT JOIN UsuarioAnfitrion a ON c.id = a.id AND c.rol = 'anfitrion'
        LEFT JOIN UsuarioConductor u ON c.id = u.id AND c.rol = 'conductor'
        WHERE c.id = @usuario_id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
    }

    const row = result.recordset[0];
    row.rol_id = row.rol_nombre === 'anfitrion' ? 1 : 2;
    row.foto_url = null;

    console.log('✅ Perfil cargado:', row);
    return res.json({ status: 'ok', data: row });

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

    // Determinar en qué tabla de perfil actualizar
    const cred = await db.request()
      .input('id', sql.Int, parseInt(usuario_id, 10))
      .query('SELECT rol FROM Credenciales WHERE id = @id');

    if (cred.recordset.length === 0)
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });

    const tabla = cred.recordset[0].rol === 'anfitrion' ? 'UsuarioAnfitrion' : 'UsuarioConductor';

    const result = await db.request()
      .input('nombre', sql.NVarChar(100), String(nombre).trim())
      .input('apellidos', sql.NVarChar(100), String(apellidos).trim())
      .input('telefono', sql.NVarChar(20), telefono ? String(telefono).trim() : null)
      .input('usuario_id', sql.Int, parseInt(usuario_id, 10))
      .query(`
        UPDATE ${tabla}
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
// PERFIL — Actualizar Preferencias (Solo Conductores)
// PUT /api/perfil/preferencias
// Body: { usuario_id, tipo_vehiculo_defecto, zona_preferencia }
// ============================================================
app.put('/api/perfil/preferencias', async (req, res) => {
  console.log('\n📩 [PUT /api/perfil/preferencias]');
  const { usuario_id, tipo_vehiculo_defecto, zona_preferencia } = req.body;

  if (!usuario_id) return res.status(400).json({ status: 'error', message: 'usuario_id requerido.' });

  try {
    const db = await getPool();

    // Check if conductor
    const cred = await db.request()
      .input('id', sql.Int, parseInt(usuario_id, 10))
      .query('SELECT rol FROM Credenciales WHERE id = @id');

    console.log("🔍 RESULTADO ROL:", cred.recordset); // 👈 AQUÍ

    if (cred.recordset.length === 0 || cred.recordset[0].rol !== 'conductor') {
      return res.status(403).json({
        status: 'error',
        message: 'Opción válida solo para conductores.'
      });
    }

    await db.request()
      .input('tipo', sql.VarChar(20), tipo_vehiculo_defecto || null)
      .input('zona', sql.NVarChar(255), zona_preferencia ? String(zona_preferencia).trim() : null)
      .input('id', sql.Int, parseInt(usuario_id, 10))
      .query(`
        UPDATE UsuarioConductor
        SET tipo_vehiculo_defecto = @tipo, zona_preferencia = @zona
        WHERE id = @id
      `);

    return res.json({ status: 'ok', message: '¡Preferencias actualizadas correctamente!' });
  } catch (err) {
    console.error('❌ Error preferencias:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al actualizar preferencias.' });
  }
});

// ============================================================
// FAVORITOS — Toggle (Añadir/Eliminar)
// POST /api/favoritos/toggle
// Body: { conductor_id, garaje_id }
// ============================================================
app.post('/api/favoritos/toggle', async (req, res) => {
  console.log('\n❤️ [POST /api/favoritos/toggle]');
  console.log("📦 BODY:", req.body); // 👈 AQUÍ MISMO

  const { conductor_id, garaje_id } = req.body;

  if (!conductor_id || !garaje_id)
    return res.status(400).json({ status: 'error', message: 'conductor_id y garaje_id requeridos.' });

  try {
    const db = await getPool();

    // Validar que sea un conductor
    const cred = await db.request().input('id', sql.Int, parseInt(conductor_id, 10)).query('SELECT rol FROM Credenciales WHERE id = @id');
    // ✅ DEBUG CLAVE
    console.log("🔍 RESULTADO ROL:", cred.recordset);

    if (cred.recordset.length === 0 || cred.recordset[0].rol !== 'conductor')
      return res.status(403).json({ status: 'error', message: 'Solo los conductores pueden guardar favoritos.' });

    // Determinar si ya existe
    const exists = await db.request()
      .input('c_id', sql.Int, parseInt(conductor_id, 10))
      .input('g_id', sql.Int, parseInt(garaje_id, 10))
      .query('SELECT * FROM Favoritos WHERE conductor_id = @c_id AND garaje_id = @g_id');

    if (exists.recordset.length > 0) {
      // Remover
      await db.request()
        .input('c_id', sql.Int, parseInt(conductor_id, 10))
        .input('g_id', sql.Int, parseInt(garaje_id, 10))
        .query('DELETE FROM Favoritos WHERE conductor_id = @c_id AND garaje_id = @g_id');

      console.log(`💔 REMOVIDO favorito | Conductor: ${conductor_id} | Garaje: ${garaje_id}`);

      return res.json({ status: 'ok', message: 'Garaje removido de favoritos.', action: 'removed' });

    } else {
      // Añadir
      await db.request()
        .input('c_id', sql.Int, parseInt(conductor_id, 10))
        .input('g_id', sql.Int, parseInt(garaje_id, 10))
        .query('INSERT INTO Favoritos (conductor_id, garaje_id) VALUES (@c_id, @g_id)');

      console.log(`❤️ AGREGADO favorito | Conductor: ${conductor_id} | Garaje: ${garaje_id}`);

      return res.json({ status: 'ok', message: 'Garaje añadido a favoritos.', action: 'added' });
    }
  } catch (err) {
    console.error('❌ Error toggle favorito:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno.' });
  }
});

// ============================================================
// FAVORITOS — Obtener mis favoritos
// GET /api/favoritos?conductor_id=X
// ============================================================
app.get('/api/favoritos', async (req, res) => {
  const conductor_id = parseInt(req.query.conductor_id, 10);
  console.log(`\n❤️ [GET /api/favoritos] Conductor: ${conductor_id}`);

  if (!conductor_id)
    return res.status(400).json({ status: 'error', message: 'conductor_id requerido.' });

  try {
    const db = await getPool();

    const result = await db.request()
      .input('c_id', sql.Int, conductor_id)
      .query(`
        SELECT 
          g.id, g.direccion, g.precio_hora, g.tipo_vehiculo,
          ISNULL(f_img.foto_url, '') AS foto_principal
        FROM Favoritos f
        JOIN Garajes g ON f.garaje_id = g.id
        OUTER APPLY (
          SELECT TOP 1 foto_url FROM FotosGaraje WHERE garaje_id = g.id ORDER BY id ASC
        ) f_img
        WHERE f.conductor_id = @c_id
        ORDER BY f.fecha_agregado DESC
      `);

    return res.json({ status: 'ok', data: result.recordset });
  } catch (err) {
    console.error('❌ Error obtener favoritos:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno.' });
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

    // Obtener hash actual del usuario desde Credenciales
    const result = await db.request()
      .input('id', sql.Int, parseInt(usuario_id, 10))
      .query('SELECT password_hash FROM Credenciales WHERE id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
    }

    const hashActual = result.recordset[0].password_hash;

    // Comparar contraseña actual con el hash
    const coincide = await bcrypt.compare(passwordActual, hashActual);
    if (!coincide) {
      console.log('❌ La contraseña actual no coincide');
      return res.status(401).json({ status: 'error', message: 'La contraseña actual es incorrecta.' });
    }

    // Hashear la nueva contraseña
    const nuevoHash = await bcrypt.hash(passwordNueva, 10);

    // Actualizar en Credenciales
    await db.request()
      .input('password', sql.NVarChar(255), nuevoHash)
      .input('id', sql.Int, parseInt(usuario_id, 10))
      .query('UPDATE Credenciales SET password_hash = @password WHERE id = @id');

    console.log('✅ Contraseña actualizada para usuario:', usuario_id);

    return res.json({ status: 'ok', message: '¡Contraseña actualizada correctamente!' });

  } catch (err) {
    console.error('❌ Error al cambiar contraseña:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al cambiar la contraseña.' });
  }
});

// ============================================================
// PRIVACIDAD — Cargar preferencias
// GET /api/perfil/privacidad?usuario_id=X
// Nota: Las columnas priv_* pueden no existir aún en la BD.
//       En ese caso devolvemos valores por defecto.
// ============================================================
app.get('/api/perfil/privacidad', async (req, res) => {
  const usuario_id = parseInt(req.query.usuario_id, 10);
  console.log(`\n🔒 [GET /api/perfil/privacidad] ID: ${usuario_id}`);

  if (!usuario_id)
    return res.status(400).json({ status: 'error', message: 'usuario_id requerido.' });

  try {
    const db = await getPool();

    // Intentar leer columnas de privacidad (pueden no existir todavía)
    try {
      const result = await db.request()
        .input('id', sql.Int, usuario_id)
        .query('SELECT priv_telefono, priv_calificaciones, priv_email FROM Usuarios WHERE id = @id');

      if (result.recordset.length === 0)
        return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });

      console.log('✅ Privacidad cargada:', result.recordset[0]);
      return res.json({ status: 'ok', data: result.recordset[0] });
    } catch (innerErr) {
      // Columnas aún no existen → devolver valores por defecto sin romper
      console.log('ℹ️  Columnas de privacidad no existen aún, devolviendo defaults.');
      return res.json({
        status: 'ok',
        data: { priv_telefono: false, priv_calificaciones: true, priv_email: false }
      });
    }
  } catch (err) {
    console.error('❌ Error al cargar privacidad:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno.' });
  }
});

// ============================================================
// PRIVACIDAD — Guardar preferencias
// PUT /api/perfil/privacidad
// Body: { usuario_id, priv_telefono, priv_calificaciones, priv_email }
// ============================================================
app.put('/api/perfil/privacidad', async (req, res) => {
  console.log('\n🔒 [PUT /api/perfil/privacidad]');
  const { usuario_id, priv_telefono, priv_calificaciones, priv_email } = req.body;

  if (!usuario_id)
    return res.status(400).json({ status: 'error', message: 'usuario_id requerido.' });

  try {
    const db = await getPool();

    try {
      await db.request()
        .input('priv_telefono', sql.Bit, priv_telefono ? 1 : 0)
        .input('priv_calificaciones', sql.Bit, priv_calificaciones ? 1 : 0)
        .input('priv_email', sql.Bit, priv_email ? 1 : 0)
        .input('id', sql.Int, parseInt(usuario_id, 10))
        .query(`
          UPDATE Usuarios
          SET priv_telefono = @priv_telefono,
              priv_calificaciones = @priv_calificaciones,
              priv_email = @priv_email
          WHERE id = @id
        `);

      console.log('✅ Privacidad actualizada para usuario:', usuario_id);
      return res.json({ status: 'ok', message: '¡Preferencias de privacidad guardadas!' });
    } catch (innerErr) {
      // Columnas aún no existen
      console.log('ℹ️  Columnas de privacidad no existen aún, operación omitida.');
      return res.json({ status: 'ok', message: '¡Preferencias guardadas! (columnas pendientes de migración)' });
    }
  } catch (err) {
    console.error('❌ Error al guardar privacidad:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al guardar la privacidad.' });
  }
});

// ============================================================
// GARAJES — Publicar nuevo espacio
// POST /api/garajes
// Body (multipart): usuario_id, direccion, descripcion,
//                   precio_hora, tipo_vehiculo, fotos[]
// ============================================================
app.post('/api/garajes', (req, res) => {
  const uploader = uploadGarajes.array('fotos', 5);

  uploader(req, res, async (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Cada imagen no puede superar los 5 MB.'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Máximo 5 fotos por garaje.'
          : err.message || 'Error al procesar las imágenes.';
      return res.status(400).json({ status: 'error', message: msg });
    }

    const { usuario_id, direccion, descripcion, precio_hora } = req.body;
    let espacios = [];
    try {
      espacios = JSON.parse(req.body.espacios || '[]');
    } catch (_) {
      espacios = [];
    }

    // Validaciones
    if (!usuario_id)
      return res.status(400).json({ status: 'error', message: 'usuario_id requerido.' });
    if (!direccion || String(direccion).trim().length < 5)
      return res.status(400).json({ status: 'error', message: 'La dirección es obligatoria (mín. 5 caracteres).' });
    if (!precio_hora || isNaN(precio_hora) || Number(precio_hora) <= 0)
      return res.status(400).json({ status: 'error', message: 'El precio por hora debe ser un número positivo.' });
    if (!espacios || espacios.length === 0)
      return res.status(400).json({ status: 'error', message: 'Debes configurar al menos 1 espacio de parqueo.' });
    if (espacios.length > 10)
      return res.status(400).json({ status: 'error', message: 'Máximo 10 espacios por garaje.' });

    // Determinar tipo_vehiculo principal (el más frecuente entre los espacios)
    const tipos = espacios.map(e => e.tipo_vehiculo).filter(Boolean);
    const tipoPrincipal = tipos.length > 0 ? tipos[0] : 'auto';

    console.log(`\n🏠 [POST /api/garajes] Usuario: ${usuario_id} | Dir: ${direccion} | Espacios: ${espacios.length}`);

    try {
      const db = await getPool();

      // ── Verificar que el usuario sea Anfitrión (rol = anfitrion) ──
      const rolCheck = await db.request()
        .input('uid', sql.Int, parseInt(usuario_id, 10))
        .query('SELECT rol FROM Credenciales WHERE id = @uid');

      if (rolCheck.recordset.length === 0) {
        if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (_) { } });
        return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
      }

      if (rolCheck.recordset[0].rol !== 'anfitrion') {
        if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (_) { } });
        return res.status(403).json({ status: 'error', message: 'Solo los anfitriones pueden publicar espacios de parqueo.' });
      }

      // ── Paso 1: Insertar el garaje ──
      const insertResult = await db.request()
        .input('anfitrion_id', sql.Int, parseInt(usuario_id, 10))
        .input('direccion', sql.NVarChar(255), String(direccion).trim())
        .input('descripcion', sql.NVarChar(500), descripcion ? String(descripcion).trim() : null)
        .input('precio_hora', sql.Decimal(10, 2), parseFloat(precio_hora))
        .input('tipo_vehiculo', sql.VarChar(20), tipoPrincipal)
        .query(`
          INSERT INTO Garajes (anfitrion_id, direccion, descripcion, precio_hora, tipo_vehiculo)
          VALUES (@anfitrion_id, @direccion, @descripcion, @precio_hora, @tipo_vehiculo);
          SELECT SCOPE_IDENTITY() AS nuevoId;
        `);

      const garajeId = insertResult.recordset[0].nuevoId;
      console.log(`   ✅ Garaje creado con ID: ${garajeId}`);

      // ── Paso 1B: Insertar Espacios definidos por el anfitrión ──
      for (const esp of espacios) {
        const tipoValido = ['auto', 'moto', 'camioneta'].includes(esp.tipo_vehiculo) ? esp.tipo_vehiculo : 'auto';
        await db.request()
          .input('garaje_id', sql.Int, garajeId)
          .input('num', sql.VarChar(10), String(esp.numero_espacio || '').substring(0, 10))
          .input('fila', sql.Int, parseInt(esp.fila, 10) || 1)
          .input('col', sql.Int, parseInt(esp.columna, 10) || 1)
          .input('tipo', sql.VarChar(20), tipoValido)
          .query("INSERT INTO Espacios (garaje_id, numero_espacio, estado, fila, columna, tipo_vehiculo) VALUES (@garaje_id, @num, 'libre', @fila, @col, @tipo)");
      }
      console.log(`   🅿️ ${espacios.length} Espacio(s) insertados.`);

      // ── Paso 2: Guardar fotos en FotosGaraje ──
      const fotosGuardadas = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const foto_url = `/uploads/garajes/${file.filename}`;
          await db.request()
            .input('garaje_id', sql.Int, garajeId)
            .input('foto_url', sql.NVarChar(255), foto_url)
            .query('INSERT INTO FotosGaraje (garaje_id, foto_url) VALUES (@garaje_id, @foto_url)');
          fotosGuardadas.push(foto_url);
        }
        console.log(`   📷 ${fotosGuardadas.length} foto(s) guardada(s).`);
      }

      return res.status(201).json({
        status: 'ok',
        message: '¡Espacio publicado exitosamente!',
        data: {
          id: garajeId,
          direccion: String(direccion).trim(),
          descripcion: descripcion ? String(descripcion).trim() : null,
          precio_hora: parseFloat(precio_hora),
          tipo_vehiculo: tipoPrincipal,
          estado_activo: true,
          fotos: fotosGuardadas
        }
      });

    } catch (dbErr) {
      console.error('❌ Error al publicar garaje:', dbErr.message);
      // Limpiar archivos subidos si la BD falló
      if (req.files) {
        req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (_) { } });
      }
      return res.status(500).json({ status: 'error', message: 'Error interno al publicar el espacio.' });
    }
  });
});

// ============================================================
// GARAJES — Listar mis espacios
// GET /api/garajes/mis-espacios?usuario_id=X
// Devuelve garajes del usuario con su foto principal (portada)
// ============================================================
app.get('/api/garajes/mis-espacios', async (req, res) => {
  const usuario_id = parseInt(req.query.usuario_id, 10);
  console.log(`\n🏠 [GET /api/garajes/mis-espacios] Usuario: ${usuario_id}`);

  if (!usuario_id)
    return res.status(400).json({ status: 'error', message: 'usuario_id requerido.' });

  try {
    const db = await getPool();

    const result = await db.request()
      .input('usuario_id', sql.Int, usuario_id)
      .query(`
        SELECT
          g.id,
          g.direccion,
          g.descripcion,
          g.precio_hora,
          g.tipo_vehiculo,
          g.estado_activo,
          g.fecha_creacion,
          fp.foto_url AS foto_principal
        FROM Garajes g
        OUTER APPLY (
          SELECT TOP 1 foto_url
          FROM FotosGaraje
          WHERE garaje_id = g.id
          ORDER BY id ASC
        ) fp
        WHERE g.anfitrion_id = @usuario_id
        ORDER BY g.fecha_creacion DESC
      `);

    console.log(`   ✅ ${result.recordset.length} garaje(s) encontrado(s).`);
    return res.json({ status: 'ok', data: result.recordset });

  } catch (err) {
    console.error('❌ Error al listar garajes:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al cargar los espacios.' });
  }
});

// ============================================================
// GARAJES — Toggle estado activo/inactivo
// PUT /api/garajes/:id/estado
// Body: { usuario_id }
// ============================================================
app.put('/api/garajes/:id/estado', async (req, res) => {
  const garaje_id = parseInt(req.params.id, 10);
  const { usuario_id } = req.body;
  console.log(`\n🔄 [PUT /api/garajes/${garaje_id}/estado] Usuario: ${usuario_id}`);

  if (!garaje_id || !usuario_id)
    return res.status(400).json({ status: 'error', message: 'garaje_id y usuario_id requeridos.' });

  try {
    const db = await getPool();

    // Verificar que el garaje pertenece al usuario
    const check = await db.request()
      .input('id', sql.Int, garaje_id)
      .input('usuario_id', sql.Int, parseInt(usuario_id, 10))
      .query('SELECT id, estado_activo FROM Garajes WHERE id = @id AND anfitrion_id = @usuario_id');

    if (check.recordset.length === 0)
      return res.status(404).json({ status: 'error', message: 'Garaje no encontrado o no te pertenece.' });

    const estadoActual = check.recordset[0].estado_activo;
    const nuevoEstado = estadoActual ? 0 : 1;

    await db.request()
      .input('nuevoEstado', sql.Bit, nuevoEstado)
      .input('id', sql.Int, garaje_id)
      .query('UPDATE Garajes SET estado_activo = @nuevoEstado WHERE id = @id');

    console.log(`   ✅ Garaje ${garaje_id}: estado_activo → ${nuevoEstado}`);

    return res.json({
      status: 'ok',
      message: nuevoEstado ? '¡Espacio activado!' : 'Espacio desactivado.',
      data: { id: garaje_id, estado_activo: !!nuevoEstado }
    });

  } catch (err) {
    console.error('❌ Error al cambiar estado:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al cambiar el estado.' });
  }
});

// ============================================================
// EXPLORAR — Listado público de garajes activos (Rol Conductor)
// GET /api/explorar
// Query: precio_min, precio_max, tipo_vehiculo
// ============================================================
app.get('/api/explorar', async (req, res) => {
  console.log('\n🔍 [GET /api/explorar]');

  let { precio_min, precio_max, tipo_vehiculo, busqueda, page, limit, fecha_entrada, fecha_salida, usuario_id } = req.query;

  const currentPage = parseInt(page, 10) || 1;
  const currentLimit = parseInt(limit, 10) || 10;
  const offset = (currentPage - 1) * currentLimit;

  // 🔥 Usuario seguro
  const usuarioId = parseInt(usuario_id, 10) || 2;

  try {
    const db = await getPool();

    // 🔥 1. OBTENER PREFERENCIAS
    const prefResult = await db.request()
      .input('id', sql.Int, usuarioId)
      .query(`
        SELECT tipo_vehiculo_defecto, zona_preferencia
        FROM UsuarioConductor
        WHERE id = @id
      `);

    const tipoPref = prefResult.recordset[0]?.tipo_vehiculo_defecto || '';
    const zonaPref = prefResult.recordset[0]?.zona_preferencia || '';

    // 🔥 2. REQUEST PRINCIPAL
    const request = db.request();

    request.input('tipoPref', sql.VarChar(20), tipoPref);
    request.input('zonaPref', sql.NVarChar(255), zonaPref);
    request.input('offset', sql.Int, offset);
    request.input('limit', sql.Int, currentLimit);
    request.input('usuarioId', sql.Int, usuarioId);

    let conditions = ['g.estado_activo = 1'];

    // 📅 DISPONIBILIDAD
    if (fecha_entrada && fecha_salida) {
      request.input('fecha_entrada', sql.DateTime, new Date(fecha_entrada));
      request.input('fecha_salida', sql.DateTime, new Date(fecha_salida));

      conditions.push(`
        NOT EXISTS (
          SELECT 1 FROM Espacios e2
          JOIN Reservas r ON r.espacio_id = e2.id
          WHERE e2.garaje_id = g.id 
            AND r.estado IN ('pendiente', 'confirmada')
            AND r.fecha_inicio < @fecha_salida 
            AND r.fecha_fin > @fecha_entrada
        )
      `);
    }

    // 🔍 BÚSQUEDA
    if (busqueda && busqueda.trim()) {
      request.input('busqueda', sql.NVarChar(255), `%${busqueda.trim()}%`);
      conditions.push('g.direccion LIKE @busqueda');
    }

    // 💰 PRECIO
    if (precio_min && !isNaN(precio_min)) {
      request.input('precio_min', sql.Decimal(10, 2), parseFloat(precio_min));
      conditions.push('g.precio_hora >= @precio_min');
    }

    if (precio_max && !isNaN(precio_max)) {
      request.input('precio_max', sql.Decimal(10, 2), parseFloat(precio_max));
      conditions.push('g.precio_hora <= @precio_max');
    }

    // 🚗 TIPO VEHÍCULO (filtro manual del usuario)
    if (tipo_vehiculo && ['auto', 'moto', 'camioneta'].includes(tipo_vehiculo)) {
      request.input('tipo_vehiculo', sql.VarChar(20), tipo_vehiculo);
      conditions.push('g.tipo_vehiculo = @tipo_vehiculo');
    }

    const whereClause = conditions.join(' AND ');

    // 🔥 QUERY FINAL CON RECOMENDACIÓN REAL
    const result = await request.query(`
      SELECT
        COUNT(*) OVER() AS total_registros,
        g.id,
        g.direccion,
        g.descripcion,
        g.precio_hora,
        g.tipo_vehiculo,
        g.fecha_creacion,
        fp.foto_url AS foto_portada,
        CAST(CASE WHEN f.garaje_id IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS es_favorito
      FROM Garajes g
      OUTER APPLY (
        SELECT TOP 1 foto_url
        FROM FotosGaraje
        WHERE garaje_id = g.id
        ORDER BY id ASC
      ) fp
      LEFT JOIN Favoritos f ON f.garaje_id = g.id AND f.conductor_id = @usuarioId
      WHERE ${whereClause}

      ORDER BY
        (
          -- 🎯 MATCH TIPO VEHÍCULO (peso alto)
          CASE 
            WHEN @tipoPref <> '' AND g.tipo_vehiculo = @tipoPref THEN 3 
            ELSE 0 
          END

          +

          -- 📍 MATCH ZONA
          CASE 
            WHEN @zonaPref <> '' AND g.direccion LIKE '%' + @zonaPref + '%' THEN 2 
            ELSE 0 
          END

          +

          -- 💰 PRECIO BAJO
          CASE 
            WHEN g.precio_hora <= 10 THEN 1 
            ELSE 0 
          END

          +

          -- 🆕 NUEVOS
          CASE 
            WHEN DATEDIFF(DAY, g.fecha_creacion, GETDATE()) < 7 THEN 1 
            ELSE 0 
          END
        ) DESC,

        g.fecha_creacion DESC

      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    const garajes = result.recordset;
    const totalRegistros = garajes.length > 0 ? garajes[0].total_registros : 0;
    const totalPaginas = Math.ceil(totalRegistros / currentLimit);

    garajes.forEach(g => delete g.total_registros);

    console.log(`   ✅ Explorar: página ${currentPage}/${totalPaginas} (${garajes.length} registros)`);

    return res.json({
      status: 'ok',
      datos: garajes,
      paginacion: {
        totalRegistros,
        totalPaginas,
        paginaActual: currentPage,
        limite: currentLimit
      }
    });

  } catch (err) {
    console.error('❌ Error en explorar:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al cargar los garajes.' });
  }
});

// ============================================================
// EXPLORAR — Detalle de un garaje con todas sus fotos
// GET /api/explorar/:id
// ============================================================
app.get('/api/explorar/:id', async (req, res) => {
  const garaje_id = parseInt(req.params.id, 10);
  console.log(`\n🔍 [GET /api/explorar/${garaje_id}]`);

  if (!garaje_id) {
    return res.status(400).json({ status: 'error', message: 'ID de garaje inválido.' });
  }

  try {
    const db = await getPool();

    // Get garage data
    const garajeResult = await db.request()
      .input('id', sql.Int, garaje_id)
      .query(`
        SELECT
          g.id,
          g.direccion,
          g.descripcion,
          g.precio_hora,
          g.tipo_vehiculo,
          g.estado_activo,
          g.fecha_creacion
        FROM Garajes g
        WHERE g.id = @id AND g.estado_activo = 1
      `);

    if (garajeResult.recordset.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Garaje no encontrado o no está disponible.' });
    }

    // Get all photos
    const fotosResult = await db.request()
      .input('garaje_id', sql.Int, garaje_id)
      .query(`
        SELECT id, foto_url
        FROM FotosGaraje
        WHERE garaje_id = @garaje_id
        ORDER BY id ASC
      `);

    const garaje = garajeResult.recordset[0];
    garaje.fotos = fotosResult.recordset;

    console.log(`   ✅ Garaje ${garaje_id} cargado con ${garaje.fotos.length} foto(s).`);
    return res.json({ status: 'ok', data: garaje });

  } catch (err) {
    console.error('❌ Error en detalle garaje:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al cargar el detalle del garaje.' });
  }
});

// ============================================================
// GARAJES — Listar Espacios de un Garaje
// GET /api/garajes/:id/espacios
// ============================================================
app.get('/api/garajes/:id/espacios', async (req, res) => {
  const garaje_id = parseInt(req.params.id, 10);
  console.log(`\n🅿️ [GET /api/garajes/${garaje_id}/espacios]`);

  if (!garaje_id) {
    return res.status(400).json({ status: 'error', message: 'ID de garaje inválido.' });
  }

  try {
    const db = await getPool();

    const result = await db.request()
      .input('garaje_id', sql.Int, garaje_id)
      .query(`
        SELECT e.id, e.numero_espacio, e.estado, e.fila, e.columna, e.tipo_vehiculo
        FROM Espacios e
        WHERE e.garaje_id = @garaje_id
        ORDER BY e.fila ASC, e.columna ASC
      `);

    console.log(`   ✅ ${result.recordset.length} espacio(s) encontrados para garaje ${garaje_id}.`);
    return res.json({ status: 'ok', data: result.recordset });

  } catch (err) {
    console.error('❌ Error al listar espacios:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al cargar los espacios.' });
  }
});

// ============================================================
// RESERVAS — Crear Reserva (Doble Booking Validation)
// POST /api/reservas
// Body: { espacio_id, conductor_id, fecha_inicio, fecha_fin }
// ============================================================
app.post('/api/reservas', async (req, res) => {
  console.log('\n📅 [POST /api/reservas]');
  const { espacio_id, conductor_id, fecha_inicio, fecha_fin } = req.body;

  if (!espacio_id || !conductor_id || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ status: 'error', message: 'Faltan datos requeridos (espacio_id, conductor_id, fecha_inicio, fecha_fin).' });
  }

  try {
    const db = await getPool();

    // 1. Validar si el espacio existe y recuperar su precio_hora (a través del Garaje padre)
    const garajeResult = await db.request()
      .input('espacio_id', sql.Int, parseInt(espacio_id, 10))
      .query(`
        SELECT g.precio_hora 
        FROM Espacios e 
        INNER JOIN Garajes g ON e.garaje_id = g.id 
        WHERE e.id = @espacio_id
      `);

    if (garajeResult.recordset.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Espacio no encontrado.' });
    }
    const precio_hora = garajeResult.recordset[0].precio_hora;

    // 2. Validación de Double-Booking (Con Buffer de 30 minutos)
    // Buscamos si existe alguna reserva para el mismo **espacio** que se solape en fechas
    // Solapamiento: Se agrega DATEADD para forzar 30 mins de limpieza o maniobra.
    // nueva_inicio < (reserva_fin + 30m) AND nueva_fin > (reserva_inicio - 30m)
    const solapamientoResult = await db.request()
      .input('espacio_id', sql.Int, parseInt(espacio_id, 10))
      .input('nueva_inicio', sql.DateTime, new Date(fecha_inicio))
      .input('nueva_fin', sql.DateTime, new Date(fecha_fin))
      .query(`
        SELECT id 
        FROM Reservas 
        WHERE espacio_id = @espacio_id 
          AND estado IN ('pendiente', 'confirmada')
          AND (@nueva_inicio < DATEADD(MINUTE, 30, fecha_fin) 
               AND @nueva_fin > DATEADD(MINUTE, -30, fecha_inicio))
      `);

    if (solapamientoResult.recordset.length > 0) {
      return res.status(400).json({ status: 'error', message: 'El espacio no está disponible. Debes dejar un margen de 30 minutos entre reservas por seguridad.' });
    }

    // 3. Calcular Diferencia de Horas y Precio Total
    const msInicio = new Date(fecha_inicio).getTime();
    const msFin = new Date(fecha_fin).getTime();
    const difMs = msFin - msInicio;

    if (difMs <= 0) {
      return res.status(400).json({ status: 'error', message: 'La fecha de salida debe ser mayor a la de entrada.' });
    }

    const difHoras = Math.ceil(difMs / (1000 * 60 * 60));
    const subtotal = difHoras * parseFloat(precio_hora);
    const tarifa_servicio = subtotal * 0.10; // 10% de tarifa
    const precio_total = subtotal + tarifa_servicio;

    // 4. Insertar la nueva Reserva
    const reservaResult = await db.request()
      .input('espacio_id', sql.Int, parseInt(espacio_id, 10))
      .input('conductor_id', sql.Int, parseInt(conductor_id, 10))
      .input('fecha_inicio', sql.DateTime, new Date(fecha_inicio))
      .input('fecha_fin', sql.DateTime, new Date(fecha_fin))
      .input('precio_total', sql.Decimal(10, 2), precio_total)
      .input('tarifa_servicio', sql.Decimal(10, 2), tarifa_servicio)
      .query(`
        INSERT INTO Reservas (espacio_id, conductor_id, fecha_inicio, fecha_fin, precio_total, tarifa_servicio, estado)
        OUTPUT INSERTED.id
        VALUES (@espacio_id, @conductor_id, @fecha_inicio, @fecha_fin, @precio_total, @tarifa_servicio, 'pendiente')
      `);

    const nuevaReservaId = reservaResult.recordset[0].id;
    console.log(`✅ Reserva ${nuevaReservaId} creada. Base: Bs. ${subtotal} | Comisión: Bs. ${tarifa_servicio} | Total: Bs. ${precio_total}`);

    return res.status(201).json({
      status: 'ok',
      message: '¡Reserva solicitada de forma exitosa!',
      data: {
        id: nuevaReservaId,
        subtotal: subtotal,
        tarifa_servicio: tarifa_servicio,
        precio_total: precio_total
      }
    });

  } catch (err) {
    console.error('❌ Error general creando reserva:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al crear reserva' });
  }
});

// ============================================================
// RESERVAS — Mis Reservas (Anfitrión o Conductor)
// GET /api/reservas/mis-reservas
// Query: usuario_id, rol_id
// ============================================================
app.get('/api/reservas/mis-reservas', async (req, res) => {
  console.log('\n📅 [GET /api/reservas/mis-reservas]');
  const { usuario_id, rol_id } = req.query;

  if (!usuario_id || !rol_id) {
    return res.status(400).json({ status: 'error', message: 'Faltan parámetros requeridos (usuario_id, rol_id).' });
  }

  try {
    const db = await getPool();
    let query = '';

    if (parseInt(rol_id, 10) === 2) {
      // Como CONDUCTOR: ver las reservas que yo he hecho
      query = `
        SELECT 
          r.id, r.fecha_inicio, r.fecha_fin, r.estado, r.precio_total,
          g.direccion as garaje_direccion, g.tipo_vehiculo,
          e.numero_espacio
        FROM Reservas r
        JOIN Espacios e ON r.espacio_id = e.id
        JOIN Garajes g ON e.garaje_id = g.id
        WHERE r.conductor_id = @usuario_id
        ORDER BY r.fecha_inicio DESC
      `;
    } else if (parseInt(rol_id, 10) === 1) {
      // Como ANFITRIÓN: ver las reservas que recayeron en mis garajes
      query = `
        SELECT 
          r.id, r.fecha_inicio, r.fecha_fin, r.estado, r.precio_total,
          g.direccion as garaje_direccion,
          e.numero_espacio,
          uc.nombre + ' ' + uc.apellidos as conductor_nombre, uc.telefono as conductor_telefono
        FROM Reservas r
        JOIN Espacios e ON r.espacio_id = e.id
        JOIN Garajes g ON e.garaje_id = g.id
        LEFT JOIN UsuarioConductor uc ON r.conductor_id = uc.id
        WHERE g.anfitrion_id = @usuario_id
        ORDER BY r.fecha_inicio DESC
      `;
    } else {
      return res.status(400).json({ status: 'error', message: 'Rol inválido.' });
    }

    const result = await db.request()
      .input('usuario_id', sql.Int, parseInt(usuario_id, 10))
      .query(query);

    return res.json({ status: 'ok', data: result.recordset });

  } catch (err) {
    console.error('❌ Error al obtener mis reservas:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al consultar mis reservas.' });
  }
});

// ============================================================
// RESERVAS — Cambiar estado
// PUT /api/reservas/:id/estado
// Body: { estado }
// ============================================================
app.put('/api/reservas/:id/estado', async (req, res) => {
  const reserva_id = parseInt(req.params.id, 10);
  const { estado } = req.body;
  console.log(`\n🔄 [PUT /api/reservas/${reserva_id}/estado] -> ${estado}`);

  if (!reserva_id || !estado) {
    return res.status(400).json({ status: 'error', message: 'reserva_id y estado son requeridos.' });
  }

  const validEstados = ['pendiente', 'confirmada', 'rechazada', 'finalizada'];
  if (!validEstados.includes(estado)) {
    return res.status(400).json({ status: 'error', message: 'Estado inválido.' });
  }

  try {
    const db = await getPool();

    const check = await db.request()
      .input('reserva_id', sql.Int, reserva_id)
      .query('SELECT id FROM Reservas WHERE id = @reserva_id');

    if (check.recordset.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Reserva no encontrada.' });
    }

    await db.request()
      .input('estado', sql.VarChar(20), estado)
      .input('reserva_id', sql.Int, reserva_id)
      .query('UPDATE Reservas SET estado = @estado WHERE id = @reserva_id');

    console.log(`✅ Estado de reserva ${reserva_id} cambiado a ${estado}`);

    return res.json({ status: 'ok', message: `Reserva ${estado} correctamente.` });

  } catch (err) {
    console.error('❌ Error al cambiar estado de reserva:', err.message);
    return res.status(500).json({ status: 'error', message: 'Error interno al cambiar el estado.' });
  }
});

// ============================================================
// RESERVAS — Verificar Existente
// GET /api/reservas/verificar-existente
// ============================================================
app.get('/api/reservas/verificar-existente', async (req, res) => {
  const { usuario_id, garaje_id } = req.query;
  if (!usuario_id || !garaje_id) {
    return res.status(400).json({ status: 'error', message: 'Faltan parámetros.' });
  }

  try {
    const db = await getPool();
    const result = await db.request()
      .input('usuario_id', sql.Int, parseInt(usuario_id, 10))
      .input('garaje_id', sql.Int, parseInt(garaje_id, 10))
      .query(`
        SELECT r.id 
        FROM Reservas r
        JOIN Espacios e ON r.espacio_id = e.id
        WHERE r.conductor_id = @usuario_id 
          AND e.garaje_id = @garaje_id 
          AND r.estado IN ('pendiente', 'confirmada')
      `);

    return res.json({ status: 'ok', existe: result.recordset.length > 0 });
  } catch (err) {
    console.error('❌ Error al verificar reserva existente:', err.message);
    return res.status(500).json({ status: 'error' });
  }
});

// ============================================================
// RESERVAS — Contar Pendientes (Anfitrión)
// GET /api/reservas/pendientes-count
// ============================================================
app.get('/api/reservas/pendientes-count', async (req, res) => {
  const { usuario_id } = req.query;
  if (!usuario_id) return res.status(400).json({ status: 'error' });

  try {
    const db = await getPool();
    const result = await db.request()
      .input('usuario_id', sql.Int, parseInt(usuario_id, 10))
      .query(`
        SELECT COUNT(r.id) AS cuenta
        FROM Reservas r
        JOIN Espacios e ON r.espacio_id = e.id
        JOIN Garajes g ON e.garaje_id = g.id
        WHERE g.anfitrion_id = @usuario_id AND r.estado = 'pendiente'
      `);

    return res.json({ status: 'ok', count: result.recordset[0].cuenta || 0 });
  } catch (err) {
    console.error('❌ Error al contar reservas pendientes:', err.message);
    return res.status(500).json({ status: 'error' });
  }
});

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
      console.log(`🚗  Login:      http://localhost:${PORT}/login.html`);
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
