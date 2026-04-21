const sql = require('mssql/msnodesqlv8');

const CONNECTION_STRING =
  'Driver={ODBC Driver 17 for SQL Server};' +
  'Server=DESKTOP-56G7UA1\\SQLEXPRESS;' +
  'Database=EstAirbnbDB;' +
  'Trusted_Connection=yes;';

async function runMigration() {
  try {
    console.log('Conectando a SQL Server...');
    const pool = await sql.connect({ connectionString: CONNECTION_STRING });

    console.log('Aplicando migraciones a la base de datos...');

    // 1. Añadir campos de preferencias a UsuarioConductor (si no existen)
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[UsuarioConductor]') 
        AND name = 'tipo_vehiculo_defecto'
      )
      BEGIN
        ALTER TABLE [dbo].[UsuarioConductor] ADD tipo_vehiculo_defecto VARCHAR(20) NULL;
        PRINT '✅ Columna tipo_vehiculo_defecto agregada a UsuarioConductor.';
      END
      ELSE
        PRINT 'ℹ️ Columna tipo_vehiculo_defecto ya existe.';
    `);

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'[dbo].[UsuarioConductor]') 
        AND name = 'zona_preferencia'
      )
      BEGIN
        ALTER TABLE [dbo].[UsuarioConductor] ADD zona_preferencia NVARCHAR(255) NULL;
        PRINT '✅ Columna zona_preferencia agregada a UsuarioConductor.';
      END
      ELSE
        PRINT 'ℹ️ Columna zona_preferencia ya existe.';
    `);

    // 2. Crear tabla Favoritos (si no existe)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Favoritos]') AND type = 'U')
      BEGIN
        CREATE TABLE [dbo].[Favoritos] (
          conductor_id   INT NOT NULL,
          garaje_id      INT NOT NULL,
          fecha_agregado DATETIME NOT NULL DEFAULT GETDATE(),
          
          CONSTRAINT PK_Favoritos PRIMARY KEY (conductor_id, garaje_id),
          CONSTRAINT FK_Favoritos_Conductor FOREIGN KEY (conductor_id) REFERENCES [dbo].[UsuarioConductor](id) ON DELETE CASCADE,
          CONSTRAINT FK_Favoritos_Garaje FOREIGN KEY (garaje_id) REFERENCES [dbo].[Garajes](id) ON DELETE CASCADE
        );
        PRINT '✅ Tabla Favoritos creada.';
      END
      ELSE
        PRINT 'ℹ️ Tabla Favoritos ya existe.';
    `);

    console.log('✅ Migración completada existosamente.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración:', err);
    process.exit(1);
  }
}

runMigration();
