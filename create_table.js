const sql = require('mssql/msnodesqlv8');

const CONNECTION_STRING =
  'Driver={ODBC Driver 17 for SQL Server};' +
  'Server=DESKTOP-56G7UA1\\SQLEXPRESS;' +
  'Database=EstAirbnbDB;' +
  'Trusted_Connection=yes;';

async function createReservasTable() {
  try {
    console.log('Conectando a SQL Server...');
    const pool = await sql.connect({ connectionString: CONNECTION_STRING });

    // Check if table exists
    const checkResult = await pool.request().query(`
      SELECT * 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'dbo' 
      AND TABLE_NAME = 'Reservas'
    `);
    
    if (checkResult.recordset.length > 0) {
      console.log('La tabla Reservas ya existe.');
    } else {
      console.log('Creando tabla Reservas...');
      await pool.request().query(`
        CREATE TABLE Reservas (
            id INT IDENTITY(1,1) PRIMARY KEY,
            garaje_id INT NOT NULL,
            usuario_id INT NOT NULL,
            fecha_inicio DATETIME NOT NULL,
            fecha_fin DATETIME NOT NULL,
            precio_total DECIMAL(10,2) NOT NULL,
            estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'rechazada', 'finalizada')),
            fecha_creacion DATETIME DEFAULT GETDATE(),
            CONSTRAINT FK_Reservas_Garaje FOREIGN KEY (garaje_id) REFERENCES Garajes(id),
            CONSTRAINT FK_Reservas_Usuario FOREIGN KEY (usuario_id) REFERENCES Usuarios(id)
        );
      `);
      console.log('Tabla Reservas creada exitosamente.');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

createReservasTable();
