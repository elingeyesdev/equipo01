const sql = require('mssql/msnodesqlv8');

const CONNECTION_STRING =
  'Driver={ODBC Driver 17 for SQL Server};' +
  'Server=ACHO;' + // Using the server name from server.js
  'Database=EstAirbnbDB;' +
  'Trusted_Connection=yes;';

async function run() {
  let pool;
  try {
    pool = await sql.connect({ connectionString: CONNECTION_STRING });
    console.log('✅ Conectado a SQL Server.\n');

    const colsToAdd = [
      { name: 'instrucciones_acceso', type: 'NVARCHAR(MAX)', default: "NULL" },
      { name: 'nivel_seguridad', type: 'VARCHAR(50)', default: "'Estándar'" },
      { name: 'metodo_acceso', type: 'VARCHAR(50)', default: "'Manual'" },
    ];

    for (const col of colsToAdd) {
      const exists = await pool.request().query(`
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.Garajes') AND name = '${col.name}'
      `);

      if (exists.recordset.length === 0) {
        await pool.request().query(`
          ALTER TABLE Garajes ADD ${col.name} ${col.type} ${col.default === "NULL" ? "NULL" : "NOT NULL DEFAULT " + col.default}
        `);
        console.log(`✅ Columna Garajes.${col.name} agregada.`);
      } else {
        console.log(`ℹ️  Columna Garajes.${col.name} ya existe.`);
      }
    }

    console.log('\n🎉 ¡Esquema actualizado para funciones de la vida real!');

  } catch (err) {
    console.error('❌ Error en actualización:', err.message);
  } finally {
    if (pool) await pool.close();
  }
}

run();
