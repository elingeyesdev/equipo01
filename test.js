const express = require('express');
const sql = require('mssql/msnodesqlv8');

const app = express();
app.use(express.json());

const dbConfig = {
  connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=ACHO;Database=EstAirbnbDB;Trusted_Connection=yes;'
};

let pool;

app.put('/api/perfil/general', async (req, res) => {
  try {
    const { usuario_id, nombre, apellidos, telefono } = req.body;
    if (!pool) {
      pool = await sql.connect(dbConfig);
    }
    const result = await pool.request()
      .input('id', sql.Int, usuario_id)
      .input('nombre', sql.VarChar(100), nombre)
      .input('apellidos', sql.VarChar(100), apellidos)
      .input('telefono', sql.VarChar(20), telefono || null)
      .query(`
        UPDATE Usuarios 
        SET nombre = @nombre, 
            apellidos = @apellidos, 
            telefono = @telefono 
        WHERE id = @id
      `);
    res.json({ status: 'ok' });
  } catch (error) {
    console.error("ERROR CAUGHT", error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.listen(3001, () => console.log('Listening on 3001'));
