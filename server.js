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
  'Server=DESKTOP-56G7UA1\\SQLEXPRESS;;' +
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
      .query('SELECT id FROM Usuarios WHERE email = @email');

    if (existing.recordset.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Ya existe una cuenta con ese correo.' });
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar usuario con el rol elegido
    const result = await db.request()
      .input('nombre', sql.NVarChar(100), nombre.trim())
      .input('apellidos', sql.NVarChar(100), apellidos.trim())
      .input('email', sql.NVarChar(150), email.toLowerCase().trim())
      .input('password', sql.NVarChar(255), hashedPassword)
      .input('telefono', sql.NVarChar(20), telefono ? telefono.trim() : null)
      .input('rol_id', sql.Int, rol_id)
      .query(`
        INSERT INTO Usuarios (nombre, apellidos, email, password, telefono, rol_id)
        OUTPUT INSERTED.id
        VALUES (@nombre, @apellidos, @email, @password, @telefono, @rol_id)
      `);

    const newId = result.recordset[0].id;
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
        SELECT u.id, u.nombre, u.apellidos, u.email, u.password,
               u.telefono, u.foto_url, u.rol_id,
               ISNULL(r.nombre, 'conductor') AS rol_nombre
        FROM Usuarios u
        LEFT JOIN Roles r ON u.rol_id = r.id
        WHERE u.email = @email
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

    return res.json({
      status: 'ok',
      message: '¡Bienvenido!',
      data: {
        id: user.id,
        nombre: user.nombre,
        apellidos: user.apellidos,
        email: user.email,
        telefono: user.telefono,
        foto_url: user.foto_url,
        rol_id: user.rol_id,
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
        SELECT u.id, u.nombre, u.apellidos, u.telefono, u.email, u.foto_url,
               u.rol_id, ISNULL(r.nombre, 'conductor') AS rol_nombre
        FROM Usuarios u
        LEFT JOIN Roles r ON u.rol_id = r.id
        WHERE u.id = @usuario_id
      `);

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

    const { usuario_id, direccion, descripcion, precio_hora, tipo_vehiculo } = req.body;

    // Validaciones
    if (!usuario_id)
      return res.status(400).json({ status: 'error', message: 'usuario_id requerido.' });
    if (!direccion || String(direccion).trim().length < 5)
      return res.status(400).json({ status: 'error', message: 'La dirección es obligatoria (mín. 5 caracteres).' });
    if (!precio_hora || isNaN(precio_hora) || Number(precio_hora) <= 0)
      return res.status(400).json({ status: 'error', message: 'El precio por hora debe ser un número positivo.' });
    if (!tipo_vehiculo || !['auto', 'moto', 'camioneta'].includes(tipo_vehiculo))
      return res.status(400).json({ status: 'error', message: 'Tipo de vehículo inválido (auto, moto o camioneta).' });

    console.log(`\n🏠 [POST /api/garajes] Usuario: ${usuario_id} | Dir: ${direccion}`);

    try {
      const db = await getPool();

      // ── Verificar que el usuario sea Anfitrión (rol_id = 1) ──
      const rolCheck = await db.request()
        .input('uid', sql.Int, parseInt(usuario_id, 10))
        .query('SELECT rol_id FROM Usuarios WHERE id = @uid');

      if (rolCheck.recordset.length === 0) {
        if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (_) { } });
        return res.status(404).json({ status: 'error', message: 'Usuario no encontrado.' });
      }

      if (rolCheck.recordset[0].rol_id !== 1) {
        if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch (_) { } });
        return res.status(403).json({ status: 'error', message: 'Solo los anfitriones pueden publicar espacios de parqueo.' });
      }

      // ── Paso 1: Insertar el garaje y obtener su ID ──
      const insertResult = await db.request()
        .input('usuario_id', sql.Int, parseInt(usuario_id, 10))
        .input('direccion', sql.NVarChar(255), String(direccion).trim())
        .input('descripcion', sql.NVarChar(500), descripcion ? String(descripcion).trim() : null)
        .input('precio_hora', sql.Decimal(10, 2), parseFloat(precio_hora))
        .input('tipo_vehiculo', sql.VarChar(20), tipo_vehiculo)
        .query(`
          INSERT INTO Garajes (usuario_id, direccion, descripcion, precio_hora, tipo_vehiculo)
          VALUES (@usuario_id, @direccion, @descripcion, @precio_hora, @tipo_vehiculo);
          SELECT SCOPE_IDENTITY() AS nuevoId;
        `);

      const garajeId = insertResult.recordset[0].nuevoId;
      console.log(`   ✅ Garaje creado con ID: ${garajeId}`);

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
          tipo_vehiculo,
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
        WHERE g.usuario_id = @usuario_id
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
      .query('SELECT id, estado_activo FROM Garajes WHERE id = @id AND usuario_id = @usuario_id');

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
  const { precio_min, precio_max, tipo_vehiculo } = req.query;

  try {
    const db = await getPool();
    const request = db.request();

    // Build dynamic WHERE clause
    let conditions = ['g.estado_activo = 1'];

    if (precio_min && !isNaN(precio_min)) {
      request.input('precio_min', sql.Decimal(10, 2), parseFloat(precio_min));
      conditions.push('g.precio_hora >= @precio_min');
    }

    if (precio_max && !isNaN(precio_max)) {
      request.input('precio_max', sql.Decimal(10, 2), parseFloat(precio_max));
      conditions.push('g.precio_hora <= @precio_max');
    }

    if (tipo_vehiculo && ['auto', 'moto', 'camioneta'].includes(tipo_vehiculo)) {
      request.input('tipo_vehiculo', sql.VarChar(20), tipo_vehiculo);
      conditions.push('g.tipo_vehiculo = @tipo_vehiculo');
    }

    const whereClause = conditions.join(' AND ');

    const result = await request.query(`
      SELECT
        g.id,
        g.direccion,
        g.descripcion,
        g.precio_hora,
        g.tipo_vehiculo,
        g.fecha_creacion,
        fp.foto_url AS foto_portada
      FROM Garajes g
      OUTER APPLY (
        SELECT TOP 1 foto_url
        FROM FotosGaraje
        WHERE garaje_id = g.id
        ORDER BY id ASC
      ) fp
      WHERE ${whereClause}
      ORDER BY g.fecha_creacion DESC
    `);

    console.log(`   ✅ ${result.recordset.length} garaje(s) activo(s) encontrado(s).`);
    return res.json({ status: 'ok', data: result.recordset });

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
      console.log(`🚗  Registro:   http://localhost:${PORT}/register.html`);
      console.log(`🚗  Garajes:    http://localhost:${PORT}/mis-garajes.html`);
      console.log(`🚗  Explorar:   http://localhost:${PORT}/explorar.html`);
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
