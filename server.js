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
// ENDPOINTS - Módulo de Espacios de Parqueo
// ============================================

// POST /api/espacios — Publicar un nuevo espacio de parqueo
app.post('/api/espacios', async (req, res) => {
  try {
    const { usuario_id, direccion, capacidad, precio_por_hora } = req.body;

    // Validaciones básicas
    if (!usuario_id || !direccion || !precio_por_hora) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Los campos usuario_id, dirección y precio por hora son obligatorios.'
      });
    }

    if (capacidad && (!Number.isInteger(Number(capacidad)) || Number(capacidad) < 1)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La capacidad debe ser un número entero mayor a 0.'
      });
    }

    if (isNaN(precio_por_hora) || Number(precio_por_hora) <= 0) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El precio por hora debe ser un número mayor a 0.'
      });
    }

    // Verificar que el usuario existe y es anfitrión
    const usuario = await pool.query('SELECT id, rol FROM usuarios WHERE id = $1', [usuario_id]);
    if (usuario.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'El usuario no existe.'
      });
    }

    if (usuario.rows[0].rol !== 'anfitrion') {
      return res.status(403).json({
        ok: false,
        mensaje: 'Solo los usuarios con rol "anfitrión" pueden publicar espacios.'
      });
    }

    const resultado = await pool.query(
      `INSERT INTO espacios (usuario_id, direccion, capacidad, precio_por_hora)
       VALUES ($1, $2, $3, $4)
       RETURNING id, usuario_id, direccion, capacidad, precio_por_hora, creado_en`,
      [usuario_id, direccion, capacidad || 1, precio_por_hora]
    );

    res.status(201).json({
      ok: true,
      mensaje: 'Espacio de parqueo publicado exitosamente.',
      espacio: resultado.rows[0]
    });

  } catch (error) {
    console.error('Error al publicar espacio:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor.'
    });
  }
});

// GET /api/espacios — Listar todos los espacios disponibles
app.get('/api/espacios', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT
         e.id,
         e.direccion,
         e.capacidad,
         e.precio_por_hora,
         e.creado_en,
         e.usuario_id,
         u.nombre AS anfitrion_nombre,
         u.correo AS anfitrion_correo
       FROM espacios e
       INNER JOIN usuarios u ON e.usuario_id = u.id
       ORDER BY e.creado_en DESC`
    );

    res.json({
      ok: true,
      total: resultado.rows.length,
      espacios: resultado.rows
    });

  } catch (error) {
    console.error('Error al listar espacios:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor.'
    });
  }
});

// GET /api/espacios/usuario/:usuario_id — Listar espacios de un anfitrión específico
app.get('/api/espacios/usuario/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;

    // Verificar si el usuario existe y es anfitrión
    const usuario = await pool.query('SELECT id, rol FROM usuarios WHERE id = $1', [usuario_id]);
    if (usuario.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'El usuario no existe.'
      });
    }

    if (usuario.rows[0].rol !== 'anfitrion') {
      return res.status(403).json({
        ok: false,
        mensaje: 'El usuario no es un anfitrión.'
      });
    }

    const resultado = await pool.query(
      `SELECT
         id,
         direccion,
         capacidad,
         precio_por_hora,
         creado_en,
         usuario_id
       FROM espacios
       WHERE usuario_id = $1
       ORDER BY creado_en DESC`,
      [usuario_id]
    );

    res.json({
      ok: true,
      total: resultado.rows.length,
      espacios: resultado.rows
    });

  } catch (error) {
    console.error('Error al listar espacios por usuario:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor.'
    });
  }
});

// ============================================
// ENDPOINTS - Módulo de Vehículos (Activos)
// ============================================

// POST /api/vehiculos — Registrar un vehículo
app.post('/api/vehiculos', async (req, res) => {
  try {
    const { usuario_id, placa, marca, modelo } = req.body;

    if (!usuario_id || !placa || !marca || !modelo) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Los campos usuario_id, placa, marca y modelo son obligatorios.'
      });
    }

    // Validación de seguridad para Sprint 0 (Asegurar que el usuario existe y es conductor)
    const usuario = await pool.query('SELECT id, rol FROM usuarios WHERE id = $1', [usuario_id]);
    if (usuario.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'El usuario no existe.'
      });
    }

    if (usuario.rows[0].rol !== 'conductor') {
      return res.status(403).json({
        ok: false,
        mensaje: 'Solo los conductores pueden registrar vehículos.'
      });
    }

    const resultado = await pool.query(
      `INSERT INTO vehiculos (usuario_id, placa, marca, modelo)
       VALUES ($1, $2, $3, $4)
       RETURNING id, usuario_id, placa, marca, modelo`,
      [usuario_id, placa, marca, modelo]
    );

    res.status(201).json({
      ok: true,
      mensaje: 'Vehículo registrado exitosamente.',
      vehiculo: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al registrar vehículo:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor.'
    });
  }
});

// PUT /api/vehiculos/:id — Editar datos de un vehículo
app.put('/api/vehiculos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { placa, marca, modelo } = req.body;

    if (!placa || !marca || !modelo) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Los campos placa, marca y modelo son obligatorios.'
      });
    }

    const resultado = await pool.query(
      `UPDATE vehiculos 
       SET placa = $1, marca = $2, modelo = $3
       WHERE id = $4
       RETURNING id, usuario_id, placa, marca, modelo`,
      [placa, marca, modelo, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Vehículo no encontrado.'
      });
    }

    res.json({
      ok: true,
      mensaje: 'Vehículo actualizado exitosamente.',
      vehiculo: resultado.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar vehículo:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor.'
    });
  }
});

// DELETE /api/vehiculos/:id — Eliminar un vehículo
app.delete('/api/vehiculos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query('DELETE FROM vehiculos WHERE id = $1 RETURNING id', [id]);

    if (resultado.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Vehículo no encontrado.'
      });
    }

    res.json({
      ok: true,
      mensaje: 'Vehículo eliminado exitosamente.'
    });
  } catch (error) {
    console.error('Error al eliminar vehículo:', error);
    res.status(500).json({
      ok: false,
      mensaje: 'Error interno del servidor.'
    });
  }
});

// GET /api/vehiculos/usuario/:usuario_id — Listar vehículos de un usuario
app.get('/api/vehiculos/usuario/:usuario_id', async (req, res) => {
  try {
    const { usuario_id } = req.params;

    const resultado = await pool.query(
      `SELECT id, usuario_id, placa, marca, modelo 
       FROM vehiculos 
       WHERE usuario_id = $1 
       ORDER BY id ASC`,
      [usuario_id]
    );

    res.json({
      ok: true,
      total: resultado.rows.length,
      vehiculos: resultado.rows
    });
  } catch (error) {
    console.error('Error al listar vehículos:', error);
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
