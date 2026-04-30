// ============================================================
// EstAirbnb — Migración: Módulo de Publicación de Garajes
// Agrega columnas de horarios y tabla de comodidades
// Ejecutar UNA VEZ: node migrate_modulo_garajes.js
// ============================================================

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
    console.log('✅ Conectado a SQL Server.\n');

    // ──────────────────────────────────────────────────────────
    // 1. Agregar columnas de horario a Garajes (si no existen)
    // ──────────────────────────────────────────────────────────
    const colsToAdd = [
      { name: 'hora_apertura',  type: 'TIME',          default: "'08:00'" },
      { name: 'hora_cierre',    type: 'TIME',          default: "'22:00'" },
      { name: 'dias_operativos', type: 'VARCHAR(50)',   default: "'L-D'"  },
    ];

    for (const col of colsToAdd) {
      const exists = await pool.request().query(`
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.Garajes') AND name = '${col.name}'
      `);

      if (exists.recordset.length === 0) {
        await pool.request().query(`
          ALTER TABLE Garajes ADD ${col.name} ${col.type} NOT NULL DEFAULT ${col.default}
        `);
        console.log(`✅ Columna Garajes.${col.name} agregada.`);
      } else {
        console.log(`ℹ️  Columna Garajes.${col.name} ya existe.`);
      }
    }

    // ──────────────────────────────────────────────────────────
    // 2. Crear tabla ComodidadesGaraje (si no existe)
    // ──────────────────────────────────────────────────────────
    const tableExists = await pool.request().query(`
      SELECT 1 FROM sys.objects
      WHERE object_id = OBJECT_ID('dbo.ComodidadesGaraje') AND type = 'U'
    `);

    if (tableExists.recordset.length === 0) {
      await pool.request().query(`
        CREATE TABLE ComodidadesGaraje (
          id         INT IDENTITY(1,1) PRIMARY KEY,
          garaje_id  INT          NOT NULL,
          clave      VARCHAR(50)  NOT NULL,
          CONSTRAINT FK_Comodidades_Garajes FOREIGN KEY (garaje_id)
            REFERENCES Garajes(id) ON DELETE CASCADE
        )
      `);
      console.log('✅ Tabla ComodidadesGaraje creada.');
    } else {
      console.log('ℹ️  Tabla ComodidadesGaraje ya existe.');
    }

    // ──────────────────────────────────────────────────────────
    // 3. Actualizar constraint de Espacios.estado si es necesario
    //    para aceptar 'mantenimiento'
    // ──────────────────────────────────────────────────────────
    try {
      // Intentar borrar el constraint existente y recrearlo
      await pool.request().query(`
        IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Espacios_Estado')
          ALTER TABLE Espacios DROP CONSTRAINT CK_Espacios_Estado
      `);
      await pool.request().query(`
        ALTER TABLE Espacios ADD CONSTRAINT CK_Espacios_Estado
          CHECK (estado IN ('libre', 'ocupado', 'mantenimiento'))
      `);
      console.log('✅ Constraint CK_Espacios_Estado actualizado (incluye mantenimiento).');
    } catch (e) {
      console.log('ℹ️  Constraint CK_Espacios_Estado ya está bien o no necesita cambio.');
    }

    console.log('\n🎉 ¡Migración completada exitosamente!');

  } catch (err) {
    console.error('❌ Error en migración:', err.message);
  } finally {
    if (pool) await pool.close();
  }
}

run();
