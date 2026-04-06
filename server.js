const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

// ============================================
// Configuración
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde /public
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// Conexión a PostgreSQL
// ============================================
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5433,
  database: process.env.DB_NAME || 'parqueo_airbin',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'root',
});

// Verificar conexión al iniciar
pool.query('SELECT NOW()')
  .then(() => console.log('✅ Conexión a PostgreSQL exitosa'))
  .catch(err => console.error('❌ Error al conectar a PostgreSQL:', err.message));

// ============================================
// ENDPOINTS - Módulo de Identidad
// ============================================

// POST /api/usuarios — Registrar un nuevo usuario
app.post('/api/usuarios', async (req, res) => {
  try {
    const { nombre, correo, contrasena, rol } = req.body;

    // Validaciones básicas
    if (!nombre || !correo || !contrasena) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Los campos nombre, correo y contraseña son obligatorios.'
      });
    }

    // Verificar si el correo ya existe
    const existe = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [correo]);
    if (existe.rows.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe un usuario registrado con ese correo.'
      });
    }

    // TODO: Aquí iría la encriptación de la contraseña.
    // Ejemplo con bcrypt:
    //   const bcrypt = require('bcrypt');
    //   const salt = await bcrypt.genSalt(10);
    //   const contrasenaHash = await bcrypt.hash(contrasena, salt);
    // Luego usar contrasenaHash en lugar de contrasena en el INSERT.
    const contrasenaFinal = contrasena; // ← Reemplazar por contrasenaHash cuando se implemente bcrypt

    const resultado = await pool.query(
      `INSERT INTO usuarios (nombre, correo, contrasena, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nombre, correo, rol, creado_en`,
      [nombre, correo, contrasenaFinal, rol || 'conductor']
    );

    res.status(201).json({
      ok: true,
      mensaje: 'Usuario registrado exitosamente.',
      usuario: resultado.rows[0]
    });

  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor.'
    });
  }
});

// POST /api/login — Inicio de sesión básico
app.post('/api/login', async (req, res) => {
  try {
    const { correo, contrasena } = req.body;

    // Validaciones básicas
    if (!correo || !contrasena) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Correo y contraseña son obligatorios.'
      });
    }

    // Buscar usuario por correo
    const resultado = await pool.query(
      'SELECT id, nombre, correo, contrasena, rol FROM usuarios WHERE correo = $1',
      [correo]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Credenciales inválidas.'
      });
    }

    const usuario = resultado.rows[0];

    // TODO: Aquí iría la comparación con hash.
    // Ejemplo con bcrypt:
    //   const bcrypt = require('bcrypt');
    //   const coincide = await bcrypt.compare(contrasena, usuario.contrasena);
    //   if (!coincide) { return res.status(401)... }
    // Comparación temporal sin encriptación:
    if (contrasena !== usuario.contrasena) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Credenciales inválidas.'
      });
    }

    // No devolver la contraseña en la respuesta
    const { contrasena: _, ...datosUsuario } = usuario;

    res.json({
      ok: true,
      mensaje: 'Inicio de sesión exitoso.',
      usuario: datosUsuario
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor.'
    });
  }
});

// ============================================
// Iniciar servidor
// ============================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
