-- ============================================================
-- EstAirbnb — PATCH: Sprint 1 — Módulo 2.3
-- Favoritos y Preferencias del Conductor
-- ============================================================
-- INSTRUCCIONES:
--   1. Abre este archivo en SSMS
--   2. Ejecuta TODO el script (Ctrl+A → F5)
--   3. Es idempotente: puedes ejecutarlo varias veces sin problema
-- ============================================================

USE EstAirbnbDB;
GO

-- ════════════════════════════════════════════════════════════
-- PARTE 1: LIMPIEZA — Eliminar tablas obsoletas
-- ════════════════════════════════════════════════════════════
-- Las tablas "Usuarios" y "Roles" son restos de una versión
-- antigua del esquema. Fueron reemplazadas por:
--   Credenciales + UsuarioAnfitrion + UsuarioConductor
-- Tener tablas huérfanas (sin relaciones) baja la nota.
-- ════════════════════════════════════════════════════════════

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Usuarios') AND type = 'U')
BEGIN
    DROP TABLE dbo.Usuarios;
    PRINT '🗑️  Tabla obsoleta [Usuarios] eliminada.';
END
ELSE
    PRINT 'ℹ️  Tabla [Usuarios] no existe (ya limpia).';
GO

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Roles') AND type = 'U')
BEGIN
    DROP TABLE dbo.Roles;
    PRINT '🗑️  Tabla obsoleta [Roles] eliminada.';
END
ELSE
    PRINT 'ℹ️  Tabla [Roles] no existe (ya limpia).';
GO


-- ════════════════════════════════════════════════════════════
-- PARTE 2: COLUMNAS NUEVAS en UsuarioConductor
-- ════════════════════════════════════════════════════════════
-- Añadimos campos de preferencias del conductor:
--   placa_vehiculo         → matrícula del vehículo
--   tipo_vehiculo_defecto  → tipo favorito para búsquedas
--   zona_preferencia       → zona habitual (texto libre)
-- ════════════════════════════════════════════════════════════

IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'placa_vehiculo' AND Object_ID = Object_ID(N'dbo.UsuarioConductor'))
BEGIN
    ALTER TABLE UsuarioConductor ADD placa_vehiculo NVARCHAR(20) NULL;
    PRINT '✅ Columna [placa_vehiculo] agregada a UsuarioConductor.';
END
ELSE
    PRINT 'ℹ️  Columna [placa_vehiculo] ya existe.';
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'tipo_vehiculo_defecto' AND Object_ID = Object_ID(N'dbo.UsuarioConductor'))
BEGIN
    ALTER TABLE UsuarioConductor ADD tipo_vehiculo_defecto VARCHAR(20) NULL;
    PRINT '✅ Columna [tipo_vehiculo_defecto] agregada a UsuarioConductor.';
END
ELSE
    PRINT 'ℹ️  Columna [tipo_vehiculo_defecto] ya existe.';
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'zona_preferencia' AND Object_ID = Object_ID(N'dbo.UsuarioConductor'))
BEGIN
    ALTER TABLE UsuarioConductor ADD zona_preferencia NVARCHAR(150) NULL;
    PRINT '✅ Columna [zona_preferencia] agregada a UsuarioConductor.';
END
ELSE
    PRINT 'ℹ️  Columna [zona_preferencia] ya existe.';
GO


-- ════════════════════════════════════════════════════════════
-- PARTE 3: TABLA Favoritos
-- ════════════════════════════════════════════════════════════
-- Relación N:N entre Conductor y Garaje.
-- Un conductor puede marcar muchos garajes como favoritos.
-- UNIQUE(conductor_id, garaje_id) evita duplicados.
-- ════════════════════════════════════════════════════════════

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Favoritos') AND type = 'U')
BEGIN
    CREATE TABLE Favoritos (
        id              INT IDENTITY(1,1)   PRIMARY KEY,
        conductor_id    INT                 NOT NULL,
        garaje_id       INT                 NOT NULL,
        fecha_agregado  DATETIME            NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Favoritos_Conductor
            FOREIGN KEY (conductor_id) REFERENCES UsuarioConductor(id) ON DELETE CASCADE,
        CONSTRAINT FK_Favoritos_Garaje
            FOREIGN KEY (garaje_id) REFERENCES Garajes(id) ON DELETE CASCADE,
        CONSTRAINT UQ_Favoritos_Conductor_Garaje
            UNIQUE (conductor_id, garaje_id)
    );
    PRINT '✅ Tabla [Favoritos] creada con FK y UNIQUE constraint.';
END
ELSE
BEGIN
    PRINT 'ℹ️  Tabla [Favoritos] ya existe.';
    
    -- Asegurar que el UNIQUE constraint exista
    IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE name = 'UQ_Favoritos_Conductor_Garaje')
    BEGIN
        -- Limpiar duplicados antes de agregar constraint
        ;WITH cte AS (
            SELECT *, ROW_NUMBER() OVER (PARTITION BY conductor_id, garaje_id ORDER BY id) AS rn
            FROM Favoritos
        )
        DELETE FROM cte WHERE rn > 1;

        ALTER TABLE Favoritos ADD CONSTRAINT UQ_Favoritos_Conductor_Garaje UNIQUE (conductor_id, garaje_id);
        PRINT '✅ UNIQUE constraint agregado a Favoritos.';
    END
END
GO


-- ════════════════════════════════════════════════════════════
-- PARTE 4: ACTUALIZAR setup_completo.sql en documentación
-- ════════════════════════════════════════════════════════════
PRINT '';
PRINT '════════════════════════════════════════════════════════════';
PRINT ' PATCH Sprint 1 — Módulo 2.3 aplicado correctamente';
PRINT '';
PRINT ' LIMPIEZA:';
PRINT '   ✓ Tablas obsoletas [Usuarios] y [Roles] eliminadas';
PRINT '';
PRINT ' NUEVAS COLUMNAS en UsuarioConductor:';
PRINT '   ✓ placa_vehiculo        (NVARCHAR 20)';
PRINT '   ✓ tipo_vehiculo_defecto (VARCHAR 20)';
PRINT '   ✓ zona_preferencia      (NVARCHAR 150)';
PRINT '';
PRINT ' NUEVA TABLA:';
PRINT '   ✓ Favoritos (conductor_id, garaje_id, fecha_agregado)';
PRINT '     FK → UsuarioConductor + Garajes | UNIQUE constraint';
PRINT '';
PRINT ' DIAGRAMA ACTUALIZADO:';
PRINT '   Credenciales ──┬── UsuarioAnfitrion ── Garajes ──┬── FotosGaraje';
PRINT '                  │                                  ├── Espacios ── Reservas';
PRINT '                  │                                  ├── ComodidadesGaraje';
PRINT '                  │                                  ├── Resenas';
PRINT '                  │                                  └── Favoritos ←─┐';
PRINT '                  └── UsuarioConductor ──────────────────────────────┘';
PRINT '════════════════════════════════════════════════════════════';
GO
