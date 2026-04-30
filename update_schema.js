const sql = require('mssql/msnodesqlv8');

const CONNECTION_STRING =
  'Driver={ODBC Driver 17 for SQL Server};' +
  'Server=LAPTOP-R2MC9IND\\SQLEXPRESS;' +
  'Database=EstAirbnbDB;' +
  'Trusted_Connection=yes;';

async function run() {
  let pool;
  try {
    pool = await sql.connect({ connectionString: CONNECTION_STRING });
    console.log('Conectado a SQL Server.');

    // 1. Dropping existing tables in correct dependency order
    console.log('Borrando tablas antiguas si existen...');
    const dropQueries = [
      "IF OBJECT_ID('dbo.Reservas', 'U') IS NOT NULL DROP TABLE dbo.Reservas;",
      "IF OBJECT_ID('dbo.Espacios', 'U') IS NOT NULL DROP TABLE dbo.Espacios;",
      "IF OBJECT_ID('dbo.FotosGaraje', 'U') IS NOT NULL DROP TABLE dbo.FotosGaraje;",
      "IF OBJECT_ID('dbo.Garajes', 'U') IS NOT NULL DROP TABLE dbo.Garajes;",
      "IF OBJECT_ID('dbo.UsuarioAnfitrion', 'U') IS NOT NULL DROP TABLE dbo.UsuarioAnfitrion;",
      "IF OBJECT_ID('dbo.UsuarioConductor', 'U') IS NOT NULL DROP TABLE dbo.UsuarioConductor;",
      "IF OBJECT_ID('dbo.Credenciales', 'U') IS NOT NULL DROP TABLE dbo.Credenciales;",
      // Old schema tables
      "IF OBJECT_ID('dbo.Usuarios', 'U') IS NOT NULL BEGIN ALTER TABLE dbo.Usuarios DROP CONSTRAINT IF EXISTS FK_Usuarios_Roles; DROP TABLE dbo.Usuarios; END",
      "IF OBJECT_ID('dbo.Roles', 'U') IS NOT NULL DROP TABLE dbo.Roles;"
    ];

    for (const q of dropQueries) {
      await pool.request().query(q);
    }
    console.log('Tablas antiguas borradas.');

    // 2. Creating new tables
    console.log('Creando nueva estructura de tablas...');
    
    await pool.request().query(`
      CREATE TABLE Credenciales (
          id INT IDENTITY(1,1) PRIMARY KEY,
          email NVARCHAR(150) NOT NULL UNIQUE,
          password_hash NVARCHAR(255) NOT NULL,
          rol VARCHAR(50) NOT NULL,
          fecha_registro DATETIME NOT NULL DEFAULT GETDATE()
      );
    `);
    console.log('✅ Tabla Credenciales creada.');

    await pool.request().query(`
      CREATE TABLE UsuarioAnfitrion (
          id INT PRIMARY KEY,
          nombre NVARCHAR(255) NOT NULL,
          apellidos NVARCHAR(255) NOT NULL,
          telefono NVARCHAR(20) NULL,
          foto_url NVARCHAR(255) NULL,
          priv_telefono BIT NOT NULL DEFAULT 0,
          priv_calificaciones BIT NOT NULL DEFAULT 1,
          priv_email BIT NOT NULL DEFAULT 0,
          CONSTRAINT FK_Anfitrion_Credenciales FOREIGN KEY (id) REFERENCES Credenciales(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Tabla UsuarioAnfitrion creada.');

    await pool.request().query(`
      CREATE TABLE UsuarioConductor (
          id INT PRIMARY KEY,
          nombre NVARCHAR(255) NOT NULL,
          apellidos NVARCHAR(255) NOT NULL,
          telefono NVARCHAR(20) NULL,
          foto_url NVARCHAR(255) NULL,
          priv_telefono BIT NOT NULL DEFAULT 0,
          priv_calificaciones BIT NOT NULL DEFAULT 1,
          priv_email BIT NOT NULL DEFAULT 0,
          CONSTRAINT FK_Conductor_Credenciales FOREIGN KEY (id) REFERENCES Credenciales(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Tabla UsuarioConductor creada.');

    await pool.request().query(`
      CREATE TABLE Garajes (
          id INT IDENTITY(1,1) PRIMARY KEY,
          anfitrion_id INT NOT NULL,
          direccion NVARCHAR(255) NOT NULL,
          descripcion NVARCHAR(500) NULL,
          precio_hora DECIMAL(10,2) NOT NULL,
          tipo_vehiculo VARCHAR(20) NOT NULL,
          estado_activo BIT NOT NULL DEFAULT 1,
          fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),
          CONSTRAINT FK_Garajes_Anfitrion FOREIGN KEY (anfitrion_id) REFERENCES UsuarioAnfitrion(id),
          CONSTRAINT CK_Garajes_TipoVehiculo CHECK (tipo_vehiculo IN ('auto', 'moto', 'camioneta'))
      );
    `);
    console.log('✅ Tabla Garajes creada.');

    await pool.request().query(`
      CREATE TABLE FotosGaraje (
          id INT IDENTITY(1,1) PRIMARY KEY,
          garaje_id INT NOT NULL,
          foto_url NVARCHAR(255) NOT NULL,
          CONSTRAINT FK_FotosGaraje_Garajes FOREIGN KEY (garaje_id) REFERENCES Garajes(id) ON DELETE CASCADE
      );
    `);
    console.log('✅ Tabla FotosGaraje creada.');

    await pool.request().query(`
      CREATE TABLE Espacios (
          id INT IDENTITY(1,1) PRIMARY KEY,
          garaje_id INT NOT NULL,
          numero_espacio VARCHAR(10) NOT NULL,
          estado VARCHAR(20) NOT NULL DEFAULT 'libre',
          fila INT NOT NULL DEFAULT 1,
          columna INT NOT NULL DEFAULT 1,
          tipo_vehiculo VARCHAR(20) NOT NULL DEFAULT 'auto',
          CONSTRAINT FK_Espacios_Garajes FOREIGN KEY (garaje_id) REFERENCES Garajes(id) ON DELETE CASCADE,
          CONSTRAINT CK_Espacios_Estado CHECK (estado IN ('libre', 'ocupado', 'mantenimiento'))
      );
    `);
    console.log('✅ Tabla Espacios creada.');

    await pool.request().query(`
      CREATE TABLE Reservas (
          id INT IDENTITY(1,1) PRIMARY KEY,
          espacio_id INT NOT NULL,
          conductor_id INT NOT NULL,
          fecha_inicio DATETIME NOT NULL,
          fecha_fin DATETIME NOT NULL,
          precio_total DECIMAL(10,2) NOT NULL,
          tarifa_servicio DECIMAL(10,2) NOT NULL DEFAULT 0,
          estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
          fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),
          CONSTRAINT FK_Reservas_Espacio FOREIGN KEY (espacio_id) REFERENCES Espacios(id),
          CONSTRAINT FK_Reservas_Conductor FOREIGN KEY (conductor_id) REFERENCES UsuarioConductor(id),
          CONSTRAINT CK_Reservas_Estado CHECK (estado IN ('pendiente', 'confirmada', 'rechazada', 'finalizada', 'cancelada'))
      );
    `);
    console.log('✅ Tabla Reservas creada.');

    console.log('🎉 ¡Base de datos actualizada correctamente a la nueva estructura!');
  } catch (err) {
    console.error('❌ Error al actualizar la base de datos:', err);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

run();
