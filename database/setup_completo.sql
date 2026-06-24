-- ============================================================
-- EstAirbnb — SETUP COMPLETO DE BASE DE DATOS (v3)
-- Consolida el esquema base + TODOS los patches de sprint en
-- un solo archivo. Refleja el estado actual usado por server.js.
-- Idempotente: puedes ejecutarlo varias veces sin problema.
-- ============================================================
--
-- ANTES DE EJECUTAR:
--   1. Abre este archivo en SSMS (SQL Server Management Studio).
--   2. Si tu PC no se llama "ACHO", cambia la cadena de conexión
--      en server.js:  Server=ACHO  →  Server=<TU_NOMBRE_DE_PC>
--      Para saber tu nombre ejecuta en CMD:  hostname
--   3. Ejecuta TODO el script (Ctrl+A → F5).
--
-- DIAGRAMA DE TABLAS (esquema dbo — el que usa la app):
--   Credenciales ──┬── UsuarioAnfitrion ──── Garajes ──┬── FotosGaraje
--                  │                                    ├── Espacios ──── Reservas ──┬── Resenas
--                  │                                    ├── ComodidadesGaraje        └── (cupón / multa)
--                  │                                    ├── Resenas
--                  │                                    └── Favoritos ←──────────────┐
--                  ├── UsuarioConductor ─────────────────── Vehiculos               │
--                  │            └────────────────────────────────────────────────────┘
--                  └── Tickets (soporte)            Cupones (promociones, tabla independiente)
--
-- NOTA: El esquema académico [acad] (>100 tablas para defensa) vive
--       aparte en patch_arquitectura_100_tablas.sql. La app no lo usa.
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

-- ── 1b. Limpieza de tablas obsoletas ────────────────────────
--    "Usuarios" y "Roles" son restos de un esquema antiguo,
--    reemplazado por Credenciales + UsuarioAnfitrion/Conductor.
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Usuarios') AND type = 'U')
BEGIN
    DROP TABLE dbo.Usuarios;
    PRINT '- Tabla obsoleta [Usuarios] eliminada.';
END
GO
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Roles') AND type = 'U')
BEGIN
    DROP TABLE dbo.Roles;
    PRINT '- Tabla obsoleta [Roles] eliminada.';
END
GO

-- ── 2. Credenciales (autenticacion) ─────────────────────────
--    id | email | password_hash | rol | fecha_registro
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
--    1:1 con Credenciales (mismo id). Incluye preferencias.
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.UsuarioConductor') AND type = 'U')
BEGIN
    CREATE TABLE UsuarioConductor (
        id                    INT             PRIMARY KEY,
        nombre                NVARCHAR(255)   NOT NULL,
        apellidos             NVARCHAR(255)   NOT NULL,
        telefono              NVARCHAR(20)    NULL,
        foto_url              NVARCHAR(255)   NULL,
        priv_telefono         BIT             NOT NULL DEFAULT 0,
        priv_calificaciones   BIT             NOT NULL DEFAULT 1,
        priv_email            BIT             NOT NULL DEFAULT 0,
        -- Preferencias del conductor (Sprint 1 — Módulo 2.3)
        placa_vehiculo        NVARCHAR(20)    NULL,
        tipo_vehiculo_defecto VARCHAR(20)     NULL,
        zona_preferencia      NVARCHAR(150)   NULL,
        CONSTRAINT FK_Conductor_Credenciales
            FOREIGN KEY (id) REFERENCES Credenciales(id) ON DELETE CASCADE
    );
    PRINT '+ Tabla UsuarioConductor creada.';
END
ELSE
BEGIN
    PRINT 'i  Tabla UsuarioConductor ya existe.';
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'placa_vehiculo' AND Object_ID = Object_ID(N'dbo.UsuarioConductor'))
        ALTER TABLE UsuarioConductor ADD placa_vehiculo NVARCHAR(20) NULL;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'tipo_vehiculo_defecto' AND Object_ID = Object_ID(N'dbo.UsuarioConductor'))
        ALTER TABLE UsuarioConductor ADD tipo_vehiculo_defecto VARCHAR(20) NULL;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'zona_preferencia' AND Object_ID = Object_ID(N'dbo.UsuarioConductor'))
        ALTER TABLE UsuarioConductor ADD zona_preferencia NVARCHAR(150) NULL;
END
GO

-- ── 5. Garajes (espacios de parqueo publicados) ──────────────
--    Propietario: anfitrion_id → UsuarioAnfitrion.id
--    Incluye horarios, seguridad, geolocalización, layout 2D y
--    programa de fidelidad.
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Garajes') AND type = 'U')
BEGIN
    CREATE TABLE Garajes (
        id                  INT IDENTITY(1,1)   PRIMARY KEY,
        anfitrion_id        INT                 NOT NULL,
        direccion           NVARCHAR(255)       NOT NULL,
        latitud             DECIMAL(10,7)       NULL,
        longitud            DECIMAL(10,7)       NULL,
        descripcion         NVARCHAR(500)       NULL,
        precio_hora         DECIMAL(10,2)       NOT NULL,
        tipo_vehiculo       VARCHAR(20)         NOT NULL DEFAULT 'auto',
        estado_activo       BIT                 NOT NULL DEFAULT 1,
        fecha_creacion      DATETIME            NOT NULL DEFAULT GETDATE(),

        -- Confianza y detalle
        dimensiones          VARCHAR(100)       NULL,
        reglas_casa          NVARCHAR(MAX)      NULL,
        politica_cancelacion NVARCHAR(MAX)      NULL,

        -- Horarios fijos (fallback si horarios_flexibles es NULL)
        hora_apertura       VARCHAR(5)          NOT NULL DEFAULT '08:00',
        hora_cierre         VARCHAR(5)          NOT NULL DEFAULT '22:00',
        dias_operativos     VARCHAR(50)         NOT NULL DEFAULT 'L-D',

        -- Horarios flexibles (JSON)
        horarios_flexibles  NVARCHAR(MAX)       NULL,

        -- Seguridad y acceso
        instrucciones_acceso NVARCHAR(MAX)      NULL,
        nivel_seguridad     VARCHAR(50)         NOT NULL DEFAULT 'Estándar',
        metodo_acceso       VARCHAR(50)         NOT NULL DEFAULT 'Manual',

        -- Layout 2D dibujado por el anfitrion (JSON)
        layout_mapa         NVARCHAR(MAX)       NULL,

        -- Programa de fidelidad (Sprint 2b)
        fidelidad_activo        BIT             NOT NULL DEFAULT 0,
        fidelidad_visitas       INT             NOT NULL DEFAULT 10,
        fidelidad_descuento_pct INT             NOT NULL DEFAULT 10,
        fidelidad_dias_validez  INT             NULL,   -- NULL = sin vencimiento

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
        ALTER TABLE Garajes ADD dimensiones VARCHAR(100) NULL, reglas_casa NVARCHAR(MAX) NULL, politica_cancelacion NVARCHAR(MAX) NULL;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'latitud' AND Object_ID = Object_ID(N'dbo.Garajes'))
        ALTER TABLE Garajes ADD latitud DECIMAL(10,7) NULL;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'longitud' AND Object_ID = Object_ID(N'dbo.Garajes'))
        ALTER TABLE Garajes ADD longitud DECIMAL(10,7) NULL;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'fidelidad_activo' AND Object_ID = Object_ID(N'dbo.Garajes'))
        ALTER TABLE Garajes ADD fidelidad_activo BIT NOT NULL DEFAULT 0;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'fidelidad_visitas' AND Object_ID = Object_ID(N'dbo.Garajes'))
        ALTER TABLE Garajes ADD fidelidad_visitas INT NOT NULL DEFAULT 10;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'fidelidad_descuento_pct' AND Object_ID = Object_ID(N'dbo.Garajes'))
        ALTER TABLE Garajes ADD fidelidad_descuento_pct INT NOT NULL DEFAULT 10;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'fidelidad_dias_validez' AND Object_ID = Object_ID(N'dbo.Garajes'))
        ALTER TABLE Garajes ADD fidelidad_dias_validez INT NULL;
END
GO

-- ── 6. FotosGaraje (portada y galeria, hasta 5 por garaje) ───
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

-- ── 7. Espacios (spots individuales en grilla 2D) ────────────
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
--    espacio_id → Espacios.id | conductor_id → UsuarioConductor.id
--    Incluye pago, cupón, rechazo y control de overstay/multa.
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

        -- Pago y cupón (Sprint 2/3)
        estado_pago        VARCHAR(20)      NOT NULL DEFAULT 'pendiente',
        cupon_codigo       VARCHAR(30)      NULL,
        descuento_aplicado DECIMAL(10,2)    NOT NULL DEFAULT 0,

        -- Rechazo (Sprint 4)
        motivo_rechazo     NVARCHAR(500)    NULL,

        -- Overstay / multa (Sprint 2b)
        hora_entrada_real  DATETIME         NULL,
        hora_salida_real   DATETIME         NULL,
        multa_exceso       DECIMAL(10,2)    NOT NULL DEFAULT 0,

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
BEGIN
    PRINT 'i  Tabla Reservas ya existe.';
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'estado_pago' AND Object_ID = Object_ID(N'dbo.Reservas'))
        ALTER TABLE Reservas ADD estado_pago VARCHAR(20) NOT NULL DEFAULT 'pendiente';
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'cupon_codigo' AND Object_ID = Object_ID(N'dbo.Reservas'))
        ALTER TABLE Reservas ADD cupon_codigo VARCHAR(30) NULL, descuento_aplicado DECIMAL(10,2) NOT NULL DEFAULT 0;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'motivo_rechazo' AND Object_ID = Object_ID(N'dbo.Reservas'))
        ALTER TABLE Reservas ADD motivo_rechazo NVARCHAR(500) NULL;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'hora_entrada_real' AND Object_ID = Object_ID(N'dbo.Reservas'))
        ALTER TABLE Reservas ADD hora_entrada_real DATETIME NULL;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'hora_salida_real' AND Object_ID = Object_ID(N'dbo.Reservas'))
        ALTER TABLE Reservas ADD hora_salida_real DATETIME NULL;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'multa_exceso' AND Object_ID = Object_ID(N'dbo.Reservas'))
        ALTER TABLE Reservas ADD multa_exceso DECIMAL(10,2) NOT NULL DEFAULT 0;
END
GO

-- ── 10. Resenas (calificaciones 1-5 por reserva) ─────────────
--    UNIQUE(reserva_id): una reseña por reserva.
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
            CHECK (calificacion >= 1 AND calificacion <= 5),
        CONSTRAINT UQ_Resenas_Reserva UNIQUE (reserva_id)
    );
    PRINT '+ Tabla Resenas creada.';
END
ELSE
BEGIN
    PRINT 'i  Tabla Resenas ya existe.';
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_Resenas_Reserva' AND object_id = OBJECT_ID(N'dbo.Resenas'))
    BEGIN
        ALTER TABLE Resenas ADD CONSTRAINT UQ_Resenas_Reserva UNIQUE (reserva_id);
        PRINT '+ UNIQUE UQ_Resenas_Reserva agregado.';
    END
END
GO

-- ── 11. Favoritos (N:N conductor ↔ garaje) ──────────────────
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
    PRINT '+ Tabla Favoritos creada.';
END
ELSE
    PRINT 'i  Tabla Favoritos ya existe.';
GO

-- ── 12. Cupones (promociones y descuentos) ───────────────────
--    Soporta descuento por % o monto fijo, límite de usos y
--    restricción de primera reserva.
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Cupones') AND type = 'U')
BEGIN
    CREATE TABLE Cupones (
        id                   INT IDENTITY(1,1) PRIMARY KEY,
        codigo               VARCHAR(30)      NOT NULL UNIQUE,
        tipo_descuento       VARCHAR(15)      NOT NULL DEFAULT 'porcentaje',
        descuento_porcentaje INT              NOT NULL DEFAULT 0,
        monto_fijo           DECIMAL(10,2)    NULL,
        descripcion          NVARCHAR(200)    NULL,
        usos_maximos         INT              NULL,        -- NULL = ilimitado
        usos_actuales        INT              NOT NULL DEFAULT 0,
        solo_primera_reserva BIT              NOT NULL DEFAULT 0,
        fecha_inicio         DATETIME         NOT NULL DEFAULT GETDATE(),
        fecha_fin            DATETIME         NOT NULL,
        activo               BIT              NOT NULL DEFAULT 1,
        creado_en            DATETIME         NOT NULL DEFAULT GETDATE()
    );
    PRINT '+ Tabla Cupones creada.';

    -- Cupones demo (solo en creación inicial)
    INSERT INTO Cupones (codigo, tipo_descuento, descuento_porcentaje, descripcion, usos_maximos, fecha_inicio, fecha_fin)
    VALUES
        ('BIENVENIDA2025', 'porcentaje', 10, 'Descuento de bienvenida', 100, GETDATE(), DATEADD(MONTH, 12, GETDATE())),
        ('VIERNES15',      'porcentaje', 15, 'Promoción de fin de semana', 50, GETDATE(), DATEADD(MONTH, 6, GETDATE())),
        ('DEMO50',         'porcentaje', 50, 'Cupón de demostración', NULL, GETDATE(), DATEADD(MONTH, 3, GETDATE()));
    PRINT '+ 3 cupones demo insertados: BIENVENIDA2025 (10%), VIERNES15 (15%), DEMO50 (50%).';
END
ELSE
BEGIN
    PRINT 'i  Tabla Cupones ya existe.';
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'tipo_descuento' AND Object_ID = Object_ID(N'dbo.Cupones'))
        ALTER TABLE Cupones ADD tipo_descuento VARCHAR(15) NOT NULL DEFAULT 'porcentaje';
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'monto_fijo' AND Object_ID = Object_ID(N'dbo.Cupones'))
        ALTER TABLE Cupones ADD monto_fijo DECIMAL(10,2) NULL;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'solo_primera_reserva' AND Object_ID = Object_ID(N'dbo.Cupones'))
        ALTER TABLE Cupones ADD solo_primera_reserva BIT NOT NULL DEFAULT 0;
    IF NOT EXISTS(SELECT * FROM sys.columns WHERE Name = N'descripcion' AND Object_ID = Object_ID(N'dbo.Cupones'))
        ALTER TABLE Cupones ADD descripcion NVARCHAR(200) NULL;
END
GO

-- ── 13. Vehiculos (garaje del conductor — Módulo 1.3) ───────
--    Un conductor registra varios vehículos; uno principal.
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Vehiculos') AND type = 'U')
BEGIN
    CREATE TABLE Vehiculos (
        id           INT IDENTITY(1,1) PRIMARY KEY,
        conductor_id INT           NOT NULL,
        placa        NVARCHAR(20)  NOT NULL,
        marca        NVARCHAR(50)  NOT NULL,
        modelo       NVARCHAR(50)  NOT NULL,
        color        NVARCHAR(30)  NULL,
        tipo         VARCHAR(20)   NOT NULL DEFAULT 'auto',
        es_principal BIT           NOT NULL DEFAULT 0,
        fecha_reg    DATETIME      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Vehiculos_Conductor
            FOREIGN KEY (conductor_id) REFERENCES Credenciales(id) ON DELETE CASCADE,
        CONSTRAINT CK_Vehiculos_Tipo
            CHECK (tipo IN ('auto', 'moto', 'camioneta'))
    );
    PRINT '+ Tabla Vehiculos creada.';
END
ELSE
    PRINT 'i  Tabla Vehiculos ya existe.';
GO

-- ── 14. Tickets (soporte y disputas — Módulo 4.2) ───────────
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Tickets') AND type = 'U')
BEGIN
    CREATE TABLE Tickets (
        id               INT IDENTITY(1,1) PRIMARY KEY,
        usuario_id       INT            NOT NULL,
        categoria        VARCHAR(30)    NOT NULL DEFAULT 'consulta',
        asunto           NVARCHAR(200)  NOT NULL,
        descripcion      NVARCHAR(MAX)  NOT NULL,
        estado           VARCHAR(20)    NOT NULL DEFAULT 'abierto',
        reserva_id       INT            NULL,
        fecha_creacion   DATETIME       NOT NULL DEFAULT GETDATE(),
        fecha_resolucion DATETIME       NULL,
        respuesta        NVARCHAR(MAX)  NULL,
        CONSTRAINT FK_Tickets_Usuario
            FOREIGN KEY (usuario_id) REFERENCES Credenciales(id),
        CONSTRAINT FK_Tickets_Reserva
            FOREIGN KEY (reserva_id) REFERENCES Reservas(id),
        CONSTRAINT CK_Tickets_Estado
            CHECK (estado IN ('abierto', 'en_revision', 'resuelto', 'cerrado')),
        CONSTRAINT CK_Tickets_Categoria
            CHECK (categoria IN ('consulta', 'disputa', 'reembolso', 'problema_acceso', 'otro'))
    );
    PRINT '+ Tabla Tickets creada.';
END
ELSE
    PRINT 'i  Tabla Tickets ya existe.';
GO

-- ── 15. Índices de rendimiento ───────────────────────────────
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

-- ============================================================
-- RESUMEN
-- ============================================================
PRINT '';
PRINT '============================================================';
PRINT 'EstAirbnb — Base de datos lista. Tablas (esquema dbo):';
PRINT '';
PRINT '  Credenciales       (auth: email + password_hash + rol)';
PRINT '  UsuarioAnfitrion   (perfil anfitrion, 1:1 Credenciales)';
PRINT '  UsuarioConductor   (perfil conductor + preferencias)';
PRINT '  Garajes            (publicaciones + horarios/seguridad/fidelidad)';
PRINT '  FotosGaraje        (galeria por garaje)';
PRINT '  Espacios           (spots en grilla 2D)';
PRINT '  ComodidadesGaraje  (amenidades)';
PRINT '  Reservas           (+ pago, cupon, rechazo, overstay/multa)';
PRINT '  Resenas            (calificaciones 1-5, UNIQUE por reserva)';
PRINT '  Favoritos          (N:N conductor-garaje)';
PRINT '  Cupones            (% o monto fijo, demo: BIENVENIDA2025/VIERNES15/DEMO50)';
PRINT '  Vehiculos          (vehiculos del conductor)';
PRINT '  Tickets            (soporte y disputas)';
PRINT '';
PRINT '  + 4 indices de rendimiento';
PRINT '';
PRINT '  RECUERDA: ajusta Server=ACHO en server.js si tu PC tiene';
PRINT '  otro nombre  →  ejecuta en CMD: hostname';
PRINT '============================================================';
GO
