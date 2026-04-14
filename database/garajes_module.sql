-- ============================================================
-- EstAirbnb — Módulo de Gestión de Garajes
-- Sprint 0 · garajes_module.sql
-- Ejecutar en SSMS después de init.sql
-- ============================================================

USE EstAirbnbDB;
GO

-- ============================================================
-- 1. Tabla de Roles (catálogo)
--    Separa la lógica de rol fuera de Usuarios
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Roles]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Roles] (
        id      INT IDENTITY(1,1)   PRIMARY KEY,
        nombre  VARCHAR(50)         NOT NULL UNIQUE
    );

    PRINT '✅ Tabla Roles creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'ℹ️  La tabla Roles ya existe.';
END
GO

-- Insertar los dos roles base (idempotente)
IF NOT EXISTS (SELECT 1 FROM [dbo].[Roles] WHERE nombre = 'anfitrion')
BEGIN
    INSERT INTO [dbo].[Roles] (nombre) VALUES ('anfitrion');
    PRINT '✅ Rol "anfitrion" insertado (id = 1).';
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[Roles] WHERE nombre = 'conductor')
BEGIN
    INSERT INTO [dbo].[Roles] (nombre) VALUES ('conductor');
    PRINT '✅ Rol "conductor" insertado (id = 2).';
END
GO

-- ============================================================
-- 2. Agregar columna rol_id a Usuarios (One-to-Many)
--    Regla de negocio: un usuario solo puede tener UN rol
--    (anfitrión o conductor, mutuamente excluyentes)
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Usuarios]')
      AND name = 'rol_id'
)
BEGIN
    -- Agregar la columna (permite NULL temporalmente para el ALTER)
    ALTER TABLE [dbo].[Usuarios]
        ADD rol_id INT NULL;

    -- Asignar rol "conductor" (id = 2) a todos los usuarios existentes
    UPDATE [dbo].[Usuarios]
        SET rol_id = 2
        WHERE rol_id IS NULL;

    -- Ahora crear la FK
    ALTER TABLE [dbo].[Usuarios]
        ADD CONSTRAINT FK_Usuarios_Roles
        FOREIGN KEY (rol_id) REFERENCES [dbo].[Roles](id);

    PRINT '✅ Columna rol_id agregada a Usuarios (FK → Roles).';
    PRINT '   Usuarios existentes asignados como "conductor" por defecto.';
END
ELSE
BEGIN
    PRINT 'ℹ️  La columna rol_id ya existe en Usuarios.';
END
GO

-- ============================================================
-- 3. Tabla Garajes
--    Espacios de parqueo publicados por anfitriones
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Garajes]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Garajes] (
        id              INT IDENTITY(1,1)   PRIMARY KEY,
        usuario_id      INT                 NOT NULL,
        direccion       NVARCHAR(255)       NOT NULL,
        descripcion     NVARCHAR(500)       NULL,
        precio_hora     DECIMAL(10,2)       NOT NULL,
        tipo_vehiculo   VARCHAR(20)         NOT NULL,  -- 'auto', 'moto', 'camioneta'
        estado_activo   BIT                 NOT NULL DEFAULT 1,
        fecha_creacion  DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_Garajes_Usuarios
            FOREIGN KEY (usuario_id) REFERENCES [dbo].[Usuarios](id),

        CONSTRAINT CK_Garajes_TipoVehiculo
            CHECK (tipo_vehiculo IN ('auto', 'moto', 'camioneta'))
    );

    PRINT '✅ Tabla Garajes creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'ℹ️  La tabla Garajes ya existe.';
END
GO

-- ============================================================
-- 4. Tabla FotosGaraje
--    Fotos asociadas a cada garaje (máx. 5 por lógica de app)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[FotosGaraje]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[FotosGaraje] (
        id          INT IDENTITY(1,1)   PRIMARY KEY,
        garaje_id   INT                 NOT NULL,
        foto_url    NVARCHAR(255)       NOT NULL,

        CONSTRAINT FK_FotosGaraje_Garajes
            FOREIGN KEY (garaje_id) REFERENCES [dbo].[Garajes](id)
            ON DELETE CASCADE
    );

    PRINT '✅ Tabla FotosGaraje creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'ℹ️  La tabla FotosGaraje ya existe.';
END
GO

-- ============================================================
PRINT '';
PRINT '🚗 Módulo de Garajes listo. Resumen de tablas:';
PRINT '   • Roles           (catálogo: anfitrion / conductor)';
PRINT '   • Usuarios.rol_id (FK → Roles, un solo rol por usuario)';
PRINT '   • Garajes         (espacios publicados por anfitriones)';
PRINT '   • FotosGaraje     (fotos asociadas a cada garaje)';
GO
