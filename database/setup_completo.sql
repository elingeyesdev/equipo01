-- ============================================================
-- EstAirbnb — SETUP COMPLETO DE BASE DE DATOS
-- Ejecutar en SSMS para crear TODO lo necesario desde cero
-- Fecha: 2026-04-16
-- ============================================================
-- Este script crea todo lo que el server.js actual necesita.
-- Es idempotente (puedes ejecutarlo varias veces sin problema).
-- ============================================================

-- ★★★ PASO 0: IMPORTANTE ★★★
-- Si tu servidor SQL NO se llama "ACHO", debes cambiar
-- la línea 66 de server.js:
--    Server=ACHO  →  Server=TU_NOMBRE_DE_PC
-- Para saber tu nombre, ejecuta en CMD: hostname
-- ============================================================

-- 1. Crear la base de datos (si no existe)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'EstAirbnbDB')
BEGIN
    CREATE DATABASE EstAirbnbDB;
    PRINT '✅ Base de datos EstAirbnbDB creada.';
END
ELSE
    PRINT 'ℹ️  EstAirbnbDB ya existe.';
GO

USE EstAirbnbDB;
GO

-- ============================================================
-- 2. Tabla Usuarios (estructura base de init.sql)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Usuarios]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Usuarios] (
        id              INT IDENTITY(1,1)   PRIMARY KEY,
        nombre          NVARCHAR(100)       NOT NULL,
        apellidos       NVARCHAR(100)       NOT NULL,
        telefono        NVARCHAR(20)        NULL,
        email           NVARCHAR(150)       NOT NULL UNIQUE,
        password        NVARCHAR(255)       NOT NULL,
        fecha_registro  DATETIME            NOT NULL DEFAULT GETDATE()
    );
    PRINT '✅ Tabla Usuarios creada.';
END
ELSE
    PRINT 'ℹ️  Tabla Usuarios ya existe.';
GO

-- ============================================================
-- 3. Columna foto_url en Usuarios
--    (Usada por: POST /api/perfil/upload-foto, GET /api/auth/login)
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Usuarios]') AND name = 'foto_url'
)
BEGIN
    ALTER TABLE [dbo].[Usuarios] ADD foto_url NVARCHAR(255) NULL;
    PRINT '✅ Columna foto_url agregada a Usuarios.';
END
ELSE
    PRINT 'ℹ️  Columna foto_url ya existe.';
GO

-- ============================================================
-- 4. Tabla Roles (catálogo de roles)
--    (Usada por: LOGIN, REGISTER, GET perfil - JOIN con Roles)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Roles]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Roles] (
        id      INT IDENTITY(1,1)   PRIMARY KEY,
        nombre  VARCHAR(50)         NOT NULL UNIQUE
    );
    PRINT '✅ Tabla Roles creada.';
END
ELSE
    PRINT 'ℹ️  Tabla Roles ya existe.';
GO

-- Insertar roles base
IF NOT EXISTS (SELECT 1 FROM [dbo].[Roles] WHERE nombre = 'anfitrion')
    INSERT INTO [dbo].[Roles] (nombre) VALUES ('anfitrion');

IF NOT EXISTS (SELECT 1 FROM [dbo].[Roles] WHERE nombre = 'conductor')
    INSERT INTO [dbo].[Roles] (nombre) VALUES ('conductor');

PRINT '✅ Roles insertados: anfitrion (1), conductor (2).';
GO

-- ============================================================
-- 5. Columna rol_id en Usuarios (FK → Roles)
--    (Usada por: REGISTER, LOGIN, GET perfil, POST garajes)
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Usuarios]') AND name = 'rol_id'
)
BEGIN
    ALTER TABLE [dbo].[Usuarios] ADD rol_id INT NULL;

    -- Asignar conductor (2) a usuarios existentes sin rol
    UPDATE [dbo].[Usuarios] SET rol_id = 2 WHERE rol_id IS NULL;

    -- Crear la FK
    ALTER TABLE [dbo].[Usuarios]
        ADD CONSTRAINT FK_Usuarios_Roles
        FOREIGN KEY (rol_id) REFERENCES [dbo].[Roles](id);

    PRINT '✅ Columna rol_id agregada a Usuarios (FK → Roles).';
END
ELSE
    PRINT 'ℹ️  Columna rol_id ya existe.';
GO

-- ============================================================
-- 6. Columnas de privacidad en Usuarios
--    (Usada por: GET/PUT /api/perfil/privacidad)
--    NOTA: El server.js maneja el caso donde no existan con
--    try/catch, pero es mejor tenerlas creadas.
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Usuarios]') AND name = 'priv_telefono'
)
BEGIN
    ALTER TABLE [dbo].[Usuarios] ADD priv_telefono BIT NOT NULL DEFAULT 0;
    PRINT '✅ Columna priv_telefono agregada.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Usuarios]') AND name = 'priv_calificaciones'
)
BEGIN
    ALTER TABLE [dbo].[Usuarios] ADD priv_calificaciones BIT NOT NULL DEFAULT 1;
    PRINT '✅ Columna priv_calificaciones agregada.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Usuarios]') AND name = 'priv_email'
)
BEGIN
    ALTER TABLE [dbo].[Usuarios] ADD priv_email BIT NOT NULL DEFAULT 0;
    PRINT '✅ Columna priv_email agregada.';
END
GO

-- ============================================================
-- 7. Tabla Garajes
--    (Usada por: POST/GET/PUT /api/garajes/*, GET /api/explorar)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Garajes]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Garajes] (
        id              INT IDENTITY(1,1)   PRIMARY KEY,
        usuario_id      INT                 NOT NULL,
        direccion       NVARCHAR(255)       NOT NULL,
        descripcion     NVARCHAR(500)       NULL,
        precio_hora     DECIMAL(10,2)       NOT NULL,
        tipo_vehiculo   VARCHAR(20)         NOT NULL,
        estado_activo   BIT                 NOT NULL DEFAULT 1,
        fecha_creacion  DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_Garajes_Usuarios
            FOREIGN KEY (usuario_id) REFERENCES [dbo].[Usuarios](id),

        CONSTRAINT CK_Garajes_TipoVehiculo
            CHECK (tipo_vehiculo IN ('auto', 'moto', 'camioneta'))
    );
    PRINT '✅ Tabla Garajes creada.';
END
ELSE
    PRINT 'ℹ️  Tabla Garajes ya existe.';
GO

-- ============================================================
-- 8. Tabla FotosGaraje
--    (Usada por: POST /api/garajes, GET mis-espacios, explorar)
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
    PRINT '✅ Tabla FotosGaraje creada.';
END
ELSE
    PRINT 'ℹ️  Tabla FotosGaraje ya existe.';
GO

-- ============================================================
-- 9. Tabla Reservas  ← NUEVA (agregada por tu compañero)
--    (Usada por: POST/GET/PUT /api/reservas/*)
-- ============================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Reservas]') AND type = 'U')
BEGIN
    CREATE TABLE [dbo].[Reservas] (
        id              INT IDENTITY(1,1)   PRIMARY KEY,
        garaje_id       INT                 NOT NULL,
        usuario_id      INT                 NOT NULL,
        fecha_inicio    DATETIME            NOT NULL,
        fecha_fin       DATETIME            NOT NULL,
        precio_total    DECIMAL(10,2)       NOT NULL,
        estado          VARCHAR(20)         NOT NULL DEFAULT 'pendiente',
        fecha_creacion  DATETIME            NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_Reservas_Garajes
            FOREIGN KEY (garaje_id) REFERENCES [dbo].[Garajes](id),

        CONSTRAINT FK_Reservas_Usuarios
            FOREIGN KEY (usuario_id) REFERENCES [dbo].[Usuarios](id),

        CONSTRAINT CK_Reservas_Estado
            CHECK (estado IN ('pendiente', 'confirmada', 'rechazada', 'finalizada'))
    );
    PRINT '✅ Tabla Reservas creada.';
END
ELSE
    PRINT 'ℹ️  Tabla Reservas ya existe.';
GO

-- ============================================================
-- RESUMEN FINAL
-- ============================================================
PRINT '';
PRINT '══════════════════════════════════════════════════════';
PRINT '🚗 EstAirbnb — Base de datos lista. Resumen:';
PRINT '';
PRINT '  TABLAS:';
PRINT '    ✅ Usuarios    (con foto_url, rol_id, priv_*)';
PRINT '    ✅ Roles       (anfitrion=1, conductor=2)';
PRINT '    ✅ Garajes     (espacios de parqueo)';
PRINT '    ✅ FotosGaraje (fotos de cada garaje)';
PRINT '    ✅ Reservas    (reservas de conductores)';
PRINT '';
PRINT '  RECUERDA: Si tu PC no se llama "ACHO",';
PRINT '  cambia Server=ACHO en la linea 66 de server.js';
PRINT '══════════════════════════════════════════════════════';
GO
