-- ============================================================
-- EstAirbnb — patch_sprint3.sql
-- Brechas críticas + Cupones + estado_pago
-- Ejecutar en SSMS sobre la base de datos EstAirbnbDB
-- Idempotente: seguro de ejecutar múltiples veces
-- ============================================================

USE EstAirbnbDB;
GO

-- ============================================================
-- 1. estado_pago en tabla Reservas
--    Brecha crítica: el endpoint /api/reservas/:id/confirmar-pago
--    ya escribe esta columna pero puede no existir en la BD.
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reservas') AND name = 'estado_pago')
  ALTER TABLE Reservas ADD estado_pago VARCHAR(20) NOT NULL DEFAULT 'pendiente';

-- ============================================================
-- 2. UNIQUE reserva_id en tabla Resenas
--    Brecha crítica: previene que un conductor reseñe dos veces
--    la misma reserva (ya manejado en código, faltaba la BD).
-- ============================================================
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('Resenas') AND name = 'UQ_Resenas_Reserva'
)
  ALTER TABLE Resenas ADD CONSTRAINT UQ_Resenas_Reserva UNIQUE (reserva_id);

-- ============================================================
-- 3. Tabla Cupones (módulo 3.4 Promociones y Descuentos)
--    Columnas compatibles con server.js: codigo, descuento_porcentaje,
--    usos_maximos, usos_actuales, fecha_inicio, fecha_fin, activo
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Cupones')
BEGIN
  CREATE TABLE Cupones (
    id                   INT IDENTITY(1,1) PRIMARY KEY,
    codigo               VARCHAR(30)       NOT NULL UNIQUE,
    descuento_porcentaje INT               NOT NULL CHECK (descuento_porcentaje BETWEEN 1 AND 100),
    descripcion          NVARCHAR(200)     NULL,
    usos_maximos         INT               NULL,        -- NULL = ilimitado
    usos_actuales        INT               NOT NULL DEFAULT 0,
    fecha_inicio         DATETIME          NOT NULL DEFAULT GETDATE(),
    fecha_fin            DATETIME          NOT NULL,
    activo               BIT               NOT NULL DEFAULT 1,
    creado_en            DATETIME          NOT NULL DEFAULT GETDATE()
  );
  PRINT '+ Tabla Cupones creada.';
END
ELSE
  PRINT 'i  Tabla Cupones ya existe.';

-- Cupones de prueba (solo si la tabla quedó vacía)
IF NOT EXISTS (SELECT 1 FROM Cupones)
BEGIN
  INSERT INTO Cupones (codigo, descuento_porcentaje, descripcion, usos_maximos, fecha_inicio, fecha_fin)
  VALUES
    ('BIENVENIDO10', 10, 'Descuento de bienvenida — primera reserva', 100,
      GETDATE(), DATEADD(MONTH, 6, GETDATE())),
    ('PROMO20',      20, 'Promoción especial — tiempo limitado',        50,
      GETDATE(), DATEADD(MONTH, 3, GETDATE())),
    ('DEMO50',       50, 'Cupón de demostración para el demo',          10,
      GETDATE(), DATEADD(MONTH, 1, GETDATE()));
  PRINT '+ 3 cupones de prueba insertados.';
END

-- ============================================================
-- 4. Favoritos — asegurar que la tabla existe
--    (puede no existir en instancias limpias)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Favoritos')
BEGIN
  CREATE TABLE Favoritos (
    conductor_id   INT      NOT NULL,
    garaje_id      INT      NOT NULL,
    fecha_agregado DATETIME NOT NULL DEFAULT GETDATE(),
    PRIMARY KEY (conductor_id, garaje_id),
    FOREIGN KEY (conductor_id) REFERENCES Credenciales(id) ON DELETE CASCADE,
    FOREIGN KEY (garaje_id)    REFERENCES Garajes(id)      ON DELETE CASCADE
  );
  PRINT '+ Tabla Favoritos creada.';
END
ELSE
  PRINT 'i  Tabla Favoritos ya existe.';

PRINT '✅ patch_sprint3.sql aplicado correctamente.'
GO
