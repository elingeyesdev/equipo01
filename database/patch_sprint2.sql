-- ============================================================
-- EstAirbnb — PATCH SPRINT 2
-- Ejecutar en SSMS sobre EstAirbnbDB
-- Idempotente: se puede correr varias veces sin problema
-- ============================================================

USE EstAirbnbDB;
GO

-- ── 1. estado_pago en Reservas ──────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = 'estado_pago' AND Object_ID = OBJECT_ID(N'dbo.Reservas'))
BEGIN
    ALTER TABLE Reservas ADD estado_pago VARCHAR(20) NOT NULL DEFAULT 'pendiente';
    PRINT '+ Columna estado_pago agregada a Reservas.';
END
ELSE PRINT 'i  estado_pago ya existe en Reservas.';
GO

-- ── 2. cupon_codigo + descuento_aplicado en Reservas ────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = 'cupon_codigo' AND Object_ID = OBJECT_ID(N'dbo.Reservas'))
BEGIN
    ALTER TABLE Reservas ADD cupon_codigo     VARCHAR(30)    NULL;
    ALTER TABLE Reservas ADD descuento_aplicado DECIMAL(10,2) NOT NULL DEFAULT 0;
    PRINT '+ Columnas de cupón (cupon_codigo, descuento_aplicado) agregadas a Reservas.';
END
ELSE PRINT 'i  Columnas de cupón ya existen en Reservas.';
GO

-- ── 3. UNIQUE en Resenas por reserva_id ─────────────────────
--    Un conductor solo puede reseñar una reserva una vez.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Resenas_Reserva' AND object_id = OBJECT_ID(N'dbo.Resenas'))
BEGIN
    ALTER TABLE Resenas ADD CONSTRAINT UQ_Resenas_Reserva UNIQUE (reserva_id);
    PRINT '+ UNIQUE constraint UQ_Resenas_Reserva creado en Resenas(reserva_id).';
END
ELSE PRINT 'i  UNIQUE en Resenas(reserva_id) ya existe.';
GO

-- ── 4. Tabla Cupones ─────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Cupones') AND type = 'U')
BEGIN
    CREATE TABLE Cupones (
        id                   INT IDENTITY(1,1) PRIMARY KEY,
        codigo               VARCHAR(30)       NOT NULL UNIQUE,
        descuento_porcentaje INT               NOT NULL,
        fecha_inicio         DATETIME          NOT NULL DEFAULT GETDATE(),
        fecha_fin            DATETIME          NOT NULL,
        activo               BIT               NOT NULL DEFAULT 1,
        usos_maximos         INT               NULL,        -- NULL = sin límite
        usos_actuales        INT               NOT NULL DEFAULT 0,
        CONSTRAINT CK_Cupones_Descuento CHECK (descuento_porcentaje > 0 AND descuento_porcentaje <= 100)
    );
    PRINT '+ Tabla Cupones creada.';

    -- Cupones de demo para la presentación del martes
    INSERT INTO Cupones (codigo, descuento_porcentaje, fecha_inicio, fecha_fin, activo, usos_maximos)
    VALUES
        ('BIENVENIDA2025', 10, '2025-01-01', '2027-12-31', 1, 100),
        ('VIERNES15',      15, '2025-01-01', '2027-12-31', 1,  50),
        ('DEMO50',         50, '2025-01-01', '2027-12-31', 1, NULL);

    PRINT '+ 3 cupones de demo insertados: BIENVENIDA2025 (10%), VIERNES15 (15%), DEMO50 (50%).';
END
ELSE PRINT 'i  Tabla Cupones ya existe.';
GO

-- ── 5. Índices de rendimiento (bono) ────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Garajes_EstadoActivo' AND object_id = OBJECT_ID(N'dbo.Garajes'))
    CREATE INDEX IX_Garajes_EstadoActivo ON Garajes (estado_activo, fecha_creacion DESC);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Reservas_EspacioEstado' AND object_id = OBJECT_ID(N'dbo.Reservas'))
    CREATE INDEX IX_Reservas_EspacioEstado ON Reservas (espacio_id, estado, fecha_inicio, fecha_fin);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Espacios_GarajeId' AND object_id = OBJECT_ID(N'dbo.Espacios'))
    CREATE INDEX IX_Espacios_GarajeId ON Espacios (garaje_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Favoritos_ConductorId' AND object_id = OBJECT_ID(N'dbo.Favoritos'))
    CREATE INDEX IX_Favoritos_ConductorId ON Favoritos (conductor_id);
GO

PRINT '';
PRINT '============================================================';
PRINT 'Sprint 2 patch aplicado correctamente.';
PRINT 'Nuevas tablas: Cupones';
PRINT 'Columnas nuevas en Reservas: estado_pago, cupon_codigo, descuento_aplicado';
PRINT 'Constraint nuevo en Resenas: UQ_Resenas_Reserva (reserva_id UNIQUE)';
PRINT 'Cupones demo: BIENVENIDA2025 | VIERNES15 | DEMO50';
PRINT '============================================================';
GO
