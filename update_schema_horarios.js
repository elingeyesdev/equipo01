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

    const colName = 'horarios_flexibles';
    const exists = await pool.request().query(`
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.Garajes') AND name = '${colName}'
    `);

    if (exists.recordset.length === 0) {
      await pool.request().query(`
        ALTER TABLE Garajes ADD ${colName} NVARCHAR(MAX) NULL
      `);
      console.log(`✅ Columna Garajes.${colName} agregada.`);
    } else {
      console.log(`ℹ️  Columna Garajes.${colName} ya existe.`);
    }

    console.log('\n🎉 ¡Esquema actualizado para horarios flexibles!');

  } catch (err) {
    console.error('❌ Error en actualización:', err.message);
  } finally {
    if (pool) await pool.close();
  }
}

run();
