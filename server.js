// ============================================================
// EstAirbnb - Plataforma de Alquiler de Parqueos
// server.js — Servidor principal Express
// ============================================================

const express = require('express');
const path    = require('path');
const sql     = require('mssql');

// ------------------------------------------------------------
// Configuración de SQL Server (entorno local Windows)
// ------------------------------------------------------------
const dbConfig = {
  user:     'sa',                     // Usuario de SQL Server
  password: 'TuPassword123',          // Contraseña del usuario
  server:   'localhost',              // Host (puede ser 'localhost\\SQLEXPRESS')
  database: 'EstAirbnbDB',           // Nombre de la base de datos
  port:     1433,                     // Puerto por defecto de SQL Server
  options: {
    encrypt:            false,        // false para conexiones locales
    trustServerCertificate: true,     // Confiar en certificado local
  },
  pool: {
    max:  10,                         // Máximo de conexiones en el pool
    min:  0,
    idleTimeoutMillis: 30000,
  },
};

// ------------------------------------------------------------
// Función para conectar a la base de datos
// (Se invocará cuando se necesite; no bloquea el arranque)
// ------------------------------------------------------------
async function connectDB() {
  try {
    const pool = await sql.connect(dbConfig);
    console.log('✅ Conexión a SQL Server establecida correctamente');
    return pool;
  } catch (err) {
    console.error('❌ Error al conectar a SQL Server:', err.message);
    throw err;
  }
}

// ------------------------------------------------------------
// Inicialización de Express
// ------------------------------------------------------------
const app  = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON y formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la carpeta "public"
app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------
// Rutas de ejemplo (API)
// ------------------------------------------------------------
app.get('/api/status', (req, res) => {
  res.json({
    status:  'ok',
    message: 'EstAirbnb API funcionando correctamente',
    timestamp: new Date().toISOString(),
  });
});

// ------------------------------------------------------------
// Arrancar el servidor
// ------------------------------------------------------------
app.listen(PORT, () => {
  console.log('');
  console.log('🚗 ══════════════════════════════════════════════');
  console.log(`🚗  EstAirbnb Server corriendo en puerto ${PORT}`);
  console.log(`🚗  http://localhost:${PORT}`);
  console.log(`🚗  http://localhost:${PORT}/configuracion.html`);
  console.log('🚗 ══════════════════════════════════════════════');
  console.log('');
});

module.exports = { app, connectDB };
