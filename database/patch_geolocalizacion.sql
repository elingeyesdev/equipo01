-- ============================================================
-- EstAirbnb - Patch Geolocalizacion de Garajes
-- Agrega coordenadas exactas para ubicar el garaje en mapa
-- y reutilizarlas en navegacion interna del conductor.
-- ============================================================

PRINT '=== PATCH GEOLOCALIZACION GARJES ===';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Garajes') AND name = 'latitud')
BEGIN
    ALTER TABLE Garajes ADD latitud DECIMAL(10,7) NULL;
    PRINT '+ Columna latitud agregada a Garajes.';
END
ELSE
    PRINT 'i  Columna latitud ya existe.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Garajes') AND name = 'longitud')
BEGIN
    ALTER TABLE Garajes ADD longitud DECIMAL(10,7) NULL;
    PRINT '+ Columna longitud agregada a Garajes.';
END
ELSE
    PRINT 'i  Columna longitud ya existe.';
GO

PRINT 'Patch completado: Garajes ahora puede guardar coordenadas exactas.';
GO
