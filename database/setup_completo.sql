-- ============================================================
-- EstAirbnb — SETUP COMPLETO DE BASE DE DATOS (v2)
-- Compatible con server.js actual
-- Idempotente: puedes ejecutarlo varias veces sin problema
-- ============================================================
--
-- ANTES DE EJECUTAR:
--   1. Abre este archivo en SSMS (SQL Server Management Studio)
--   2. Si tu PC no se llama "ACHO", cambia la linea 66 de server.js:
--        Server=ACHO  →  Server=<TU_NOMBRE_DE_PC>
--      Para saber tu nombre ejecuta en CMD:  hostname
--   3. Ejecuta TODO el script (Ctrl+A → F5)
--
-- DIAGRAMA DE TABLAS:
--   Credenciales ──┬── UsuarioAnfitrion ──── Garajes ──┬── FotosGaraje
--                  │                                    ├── Espacios ──── Reservas
--                  │                                    └── ComodidadesGaraje
--                  └── UsuarioConductor ────────────────────── Reservas
-- ============================================================

-- ── 1. Base de datos ────────────────────────────────────────
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'EstAirbnbDB')
BEGIN
    CREATE DATABASE EstAirbnbDB;
    PRINT '+ Base de datos EstAirbnbDB creada.';
END
ELSE
    PRINT 'i  EstAirbnbDB ya existe.';
GO

USE EstAirbnbDB;
GO

-- ── 2. Credenciales (autenticacion) ─────────────────────────
--    Reemplaza la antigua tabla Usuarios para auth.
--    Columnas: id | email | password_hash | rol | fecha_registro
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Credenciales') AND type = 'U')
BEGIN
    CREATE TABLE Credenciales (
        id              INT IDENTITY(1,1)   PRIMARY KEY,
        email           NVARCHAR(150)       NOT NULL UNIQUE,
        password_hash   NVARCHAR(255)       NOT NULL,
        rol             VARCHAR(50)         NOT NULL,
        fecha_registro  DATETIME            NOT NULL DEFAULT GETDATE(),
        CONSTRAINT CK_Credenciales_Rol CHECK (rol IN ('anfitrion', 'conductor'))
    );
    PRINT '+ Tabla Credenciales creada.';
END
ELSE
    PRINT 'i  Tabla Credenciales ya existe.';
GO

-- ── 3. UsuarioAnfitrion (perfil de anfitriones) ─────────────
--    1:1 con Credenciales (mismo id).
--    Columnas: id | nombre | apellidos | telefono | foto_url | priv_*
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.UsuarioAnfitrion') AND type = 'U')
BEGIN
    CREATE TABLE UsuarioAnfitrion (
        id                  INT             PRIMARY KEY,
        nombre              NVARCHAR(255)   NOT NULL,
        apellidos           NVARCHAR(255)   NOT NULL,
        telefono            NVARCHAR(20)    NULL,
        foto_url            NVARCHAR(255)   NULL,
        es_verificado       BIT             NOT NULL DEFAULT 0,
        priv_telefono       BIT             NOT NULL DEFAULT 0,
        priv_calificaciones BIT             NOT NULL DEFAULT 1,
        priv_email          BIT             NOT NULL DEFAULT 0,
        CONSTRAINT FK_Anfitrion_Credenciales
            FOREIGN KEY (id) REFERENCES Credenciales(id) ON DELETE CASCADE
    );
    PRINT '+ Tabla UsuarioAnfitrion creada.';
END
ELSE
BEGIN
    PRINT 'i  Tabla UsuarioAnfitrion ya existe.';
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'es_verificado' AND Object_ID = Object_ID(N'dbo.UsuarioAnfitrion'))
    BEGIN
        ALTER TABLE UsuarioAnfitrion ADD es_verificado BIT NOT NULL DEFAULT 0;
        PRINT '+ Columna es_verificado agregada a UsuarioAnfitrion.';
    END
END
GO

-- ── 4. UsuarioConductor (perfil de conductores) ─────────────
--    1:1 con Credenciales (mismo id).
--    Columnas: id | nombre | apellidos | telefono | foto_url | priv_*
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.UsuarioConductor') AND type = 'U')
BEGIN
    CREATE TABLE UsuarioConductor (
        id                  INT             PRIMARY KEY,
        nombre              NVARCHAR(255)   NOT NULL,
        apellidos           NVARCHAR(255)   NOT NULL,
        telefono            NVARCHAR(20)    NULL,
        foto_url            NVARCHAR(255)   NULL,
        priv_telefono       BIT             NOT NULL DEFAULT 0,
        priv_calificaciones BIT             NOT NULL DEFAULT 1,
        priv_email          BIT             NOT NULL DEFAULT 0,
        CONSTRAINT FK_Conductor_Credenciales
            FOREIGN KEY (id) REFERENCES Credenciales(id) ON DELETE CASCADE
    );
    PRINT '+ Tabla UsuarioConductor creada.';
END
ELSE
    PRINT 'i  Tabla UsuarioConductor ya existe.';
GO

-- ── 5. Garajes (espacios de parqueo publicados) ──────────────
--    Propietario: anfitrion_id → UsuarioAnfitrion.id
--    Incluye horarios (fijos y flexibles), seguridad y layout 2D.
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Garajes') AND type = 'U')
BEGIN
    CREATE TABLE Garajes (
        id                  INT IDENTITY(1,1)   PRIMARY KEY,
        anfitrion_id        INT                 NOT NULL,
        direccion           NVARCHAR(255)       NOT NULL,
        descripcion         NVARCHAR(500)       NULL,
        precio_hora         DECIMAL(10,2)       NOT NULL,
        tipo_vehiculo       VARCHAR(20)         NOT NULL DEFAULT 'auto',
        estado_activo       BIT                 NOT NULL DEFAULT 1,
        fecha_creacion      DATETIME            NOT NULL DEFAULT GETDATE(),

        -- Campos de Confianza y Detalle
        dimensiones         VARCHAR(100)        NULL,
        reglas_casa         NVARCHAR(MAX)       NULL,
        politica_cancelacion NVARCHAR(MAX)      NULL,

        -- Horarios fijos (fallback si horarios_flexibles es NULL)
        hora_apertura       VARCHAR(5)          NOT NULL DEFAULT '08:00',
        hora_cierre         VARCHAR(5)          NOT NULL DEFAULT '22:00',
        dias_operativos     VARCHAR(50)         NOT NULL DEFAULT 'L-D',

        -- Horarios flexibles (JSON: [{dias:[0,1,...], inicio:"HH:MM", fin:"HH:MM"}])
        horarios_flexibles  NVARCHAR(MAX)       NULL,

        -- Caracteristicas de seguridad y acceso
        instrucciones_acceso NVARCHAR(MAX)      NULL,
        nivel_seguridad     VARCHAR(50)         NOT NULL DEFAULT 'Estándar',
        metodo_acceso       VARCHAR(50)         NOT NULL DEFAULT 'Manual',

        -- Layout 2D dibujado por el anfitrion (JSON)
        layout_mapa         NVARCHAR(MAX)       NULL,

        CONSTRAINT FK_Garajes_Anfitrion
            FOREIGN KEY (anfitrion_id) REFERENCES UsuarioAnfitrion(id),
        CONSTRAINT CK_Garajes_TipoVehiculo
            CHECK (tipo_vehiculo IN ('auto', 'moto', 'camioneta')),
        CONSTRAINT CK_Garajes_NivelSeguridad
            CHECK (nivel_seguridad IN ('Básico', 'Estándar', 'Premium')),
        CONSTRAINT CK_Garajes_MetodoAcceso
            CHECK (metodo_acceso IN ('Manual', 'Código', 'QR'))
    );
    PRINT '+ Tabla Garajes creada.';
END
ELSE
BEGIN
    PRINT 'i  Tabla Garajes ya existe.';
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'dimensiones' AND Object_ID = Object_ID(N'dbo.Garajes'))
    BEGIN
        ALTER TABLE Garajes ADD 
            dimensiones VARCHAR(100) NULL,
            reglas_casa NVARCHAR(MAX) NULL,
            politica_cancelacion NVARCHAR(MAX) NULL;
        PRINT '+ Columnas de confianza agregadas a Garajes.';
    END
END
GO

-- ── 6. FotosGaraje (fotos de portada y galeria) ─────────────
--    Hasta 5 fotos por garaje (limite en server.js).
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.FotosGaraje') AND type = 'U')
BEGIN
    CREATE TABLE FotosGaraje (
        id          INT IDENTITY(1,1)   PRIMARY KEY,
        garaje_id   INT                 NOT NULL,
        foto_url    NVARCHAR(255)       NOT NULL,
        CONSTRAINT FK_FotosGaraje_Garajes
            FOREIGN KEY (garaje_id) REFERENCES Garajes(id) ON DELETE CASCADE
    );
    PRINT '+ Tabla FotosGaraje creada.';
END
ELSE
    PRINT 'i  Tabla FotosGaraje ya existe.';
GO

-- ── 7. Espacios (spots individuales dentro de un garaje) ─────
--    Posicion en la grilla 2D: fila × columna.
--    Estados: libre | ocupado | mantenimiento
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Espacios') AND type = 'U')
BEGIN
    CREATE TABLE Espacios (
        id              INT IDENTITY(1,1)   PRIMARY KEY,
        garaje_id       INT                 NOT NULL,
        numero_espacio  VARCHAR(10)         NOT NULL,
        estado          VARCHAR(20)         NOT NULL DEFAULT 'libre',
        fila            INT                 NOT NULL DEFAULT 1,
        columna         INT                 NOT NULL DEFAULT 1,
        tipo_vehiculo   VARCHAR(20)         NOT NULL DEFAULT 'auto',
        CONSTRAINT FK_Espacios_Garajes
            FOREIGN KEY (garaje_id) REFERENCES Garajes(id) ON DELETE CASCADE,
        CONSTRAINT CK_Espacios_Estado
            CHECK (estado IN ('libre', 'ocupado', 'mantenimiento')),
        CONSTRAINT CK_Espacios_TipoVehiculo
            CHECK (tipo_vehiculo IN ('auto', 'moto', 'camioneta', 'techado'))
    );
    PRINT '+ Tabla Espacios creada.';
END
ELSE
    PRINT 'i  Tabla Espacios ya existe.';
GO

-- ── 8. ComodidadesGaraje (amenidades por garaje) ────────────
--    Cada fila es una clave de comodidad (ej. 'camaras', 'techado').
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.ComodidadesGaraje') AND type = 'U')
BEGIN
    CREATE TABLE ComodidadesGaraje (
        id          INT IDENTITY(1,1)   PRIMARY KEY,
        garaje_id   INT                 NOT NULL,
        clave       VARCHAR(50)         NOT NULL,
        CONSTRAINT FK_Comodidades_Garajes
            FOREIGN KEY (garaje_id) REFERENCES Garajes(id) ON DELETE CASCADE
    );
    PRINT '+ Tabla ComodidadesGaraje creada.';
END
ELSE
    PRINT 'i  Tabla ComodidadesGaraje ya existe.';
GO

-- ── 9. Reservas ──────────────────────────────────────────────
--    espacio_id  → Espacios.id
--    conductor_id → UsuarioConductor.id
--    Buffer de 30 minutos entre reservas validado en server.js.
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Reservas') AND type = 'U')
BEGIN
    CREATE TABLE Reservas (
        id              INT IDENTITY(1,1)   PRIMARY KEY,
        espacio_id      INT                 NOT NULL,
        conductor_id    INT                 NOT NULL,
        fecha_inicio    DATETIME            NOT NULL,
        fecha_fin       DATETIME            NOT NULL,
        precio_total    DECIMAL(10,2)       NOT NULL,
        tarifa_servicio DECIMAL(10,2)       NOT NULL DEFAULT 0,
        estado          VARCHAR(20)         NOT NULL DEFAULT 'pendiente',
        fecha_creacion  DATETIME            NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Reservas_Espacio
            FOREIGN KEY (espacio_id) REFERENCES Espacios(id),
        CONSTRAINT FK_Reservas_Conductor
            FOREIGN KEY (conductor_id) REFERENCES UsuarioConductor(id),
        CONSTRAINT CK_Reservas_Estado
            CHECK (estado IN ('pendiente', 'confirmada', 'rechazada', 'finalizada', 'cancelada'))
    );
    PRINT '+ Tabla Reservas creada.';
END
ELSE
    PRINT 'i  Tabla Reservas ya existe.';
GO

-- ── 10. Resenas (calificaciones de conductores) ──────────────
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Resenas') AND type = 'U')
BEGIN
    CREATE TABLE Resenas (
        id              INT IDENTITY(1,1)   PRIMARY KEY,
        garaje_id       INT                 NOT NULL,
        conductor_id    INT                 NOT NULL,
        reserva_id      INT                 NOT NULL,
        calificacion    INT                 NOT NULL,
        comentario      NVARCHAR(MAX)       NULL,
        fecha_creacion  DATETIME            NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Resenas_Garaje
            FOREIGN KEY (garaje_id) REFERENCES Garajes(id) ON DELETE CASCADE,
        CONSTRAINT FK_Resenas_Conductor
            FOREIGN KEY (conductor_id) REFERENCES UsuarioConductor(id),
        CONSTRAINT FK_Resenas_Reserva
            FOREIGN KEY (reserva_id) REFERENCES Reservas(id),
        CONSTRAINT CK_Resenas_Calificacion
            CHECK (calificacion >= 1 AND calificacion <= 5)
    );
    PRINT '+ Tabla Resenas creada.';
END
ELSE
    PRINT 'i  Tabla Resenas ya existe.';
GO

-- ============================================================
-- RESUMEN
-- ============================================================
PRINT '';
PRINT '============================================================';
PRINT 'EstAirbnb — Base de datos lista. Tablas creadas/verificadas:';
PRINT '';
PRINT '  Credenciales       (autenticacion: email + password_hash + rol)';
PRINT '  UsuarioAnfitrion   (perfil de anfitriones, 1:1 con Credenciales)';
PRINT '  UsuarioConductor   (perfil de conductores, 1:1 con Credenciales)';
PRINT '  Garajes            (espacios publicados por anfitriones)';
PRINT '  FotosGaraje        (galeria de fotos por garaje)';
PRINT '  Espacios           (spots individuales en grilla 2D)';
PRINT '  ComodidadesGaraje  (amenidades: camaras, techado, etc.)';
PRINT '  Reservas           (reservas de conductores con tarifa 10%)';
PRINT '  Resenas            (calificaciones de conductores 1-5 estrellas)';
PRINT '';
PRINT '  RECUERDA: cambia Server=ACHO en server.js (linea 66)';
PRINT '  si tu PC tiene otro nombre  →  ejecuta: hostname';
PRINT '============================================================';
GO
