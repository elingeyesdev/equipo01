USE EstAirbnbDB;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.Reservas')
    AND name = 'motivo_rechazo'
)
BEGIN
  ALTER TABLE Reservas
    ADD motivo_rechazo NVARCHAR(500) NULL;
END
GO

/*
  La validacion de ubicacion duplicada entre anfitriones se resuelve
  desde server.js para no exponer datos sensibles del garaje existente.
*/
