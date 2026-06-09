-- ============================================================
-- EstAirbnb - Patch academico para escalar modelo (>100 tablas)
-- Objetivo:
-- 1) NO romper el codigo funcional existente.
-- 2) Mantener tablas actuales en dbo sin cambios destructivos.
-- 3) Agregar normalizacion adicional en esquema acad.
-- 4) Llegar a una cantidad de tablas de nivel "enterprise" para defensa.
-- ============================================================

USE EstAirbnbDB;
GO

PRINT '=== PATCH ARQUITECTURA 100+ TABLAS (NO DESTRUCTIVO) ===';
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'acad')
BEGIN
    EXEC('CREATE SCHEMA acad');
    PRINT '+ Esquema [acad] creado.';
END
ELSE
    PRINT 'i  Esquema [acad] ya existe.';
GO

/* ============================================================
   A) TABLAS SATELITE NORMALIZADAS (alineadas al EDT/logica)
   - Todas cuelgan de tablas dbo existentes.
   - No sustituyen tablas actuales; solo extienden modelo.
============================================================ */

IF OBJECT_ID(N'acad.GarajeDetalle', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeDetalle (
        garaje_id            INT PRIMARY KEY,
        capacidad_total      INT NULL,
        altura_max_m         DECIMAL(5,2) NULL,
        ancho_promedio_m     DECIMAL(5,2) NULL,
        largo_promedio_m     DECIMAL(5,2) NULL,
        tiene_cctv           BIT NOT NULL DEFAULT 0,
        tiene_iluminacion    BIT NOT NULL DEFAULT 0,
        observaciones        NVARCHAR(400) NULL,
        fecha_creacion       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        fecha_actualizacion  DATETIME2 NULL,
        CONSTRAINT FK_acad_GarajeDetalle_Garajes
            FOREIGN KEY (garaje_id) REFERENCES dbo.Garajes(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeUbicacion', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeUbicacion (
        id                   INT IDENTITY(1,1) PRIMARY KEY,
        garaje_id            INT NOT NULL,
        direccion_formateada NVARCHAR(255) NOT NULL,
        referencia           NVARCHAR(255) NULL,
        latitud              DECIMAL(10,7) NOT NULL,
        longitud             DECIMAL(10,7) NOT NULL,
        fuente_geocodigo     VARCHAR(50) NULL,
        precision_metros     INT NULL,
        es_principal         BIT NOT NULL DEFAULT 1,
        fecha_creacion       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_GarajeUbicacion_Garajes
            FOREIGN KEY (garaje_id) REFERENCES dbo.Garajes(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajePolitica', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajePolitica (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        garaje_id       INT NOT NULL,
        tipo_politica   VARCHAR(40) NOT NULL,
        titulo          NVARCHAR(150) NOT NULL,
        contenido       NVARCHAR(MAX) NOT NULL,
        prioridad       INT NOT NULL DEFAULT 1,
        activo          BIT NOT NULL DEFAULT 1,
        fecha_creacion  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_GarajePolitica_Garajes
            FOREIGN KEY (garaje_id) REFERENCES dbo.Garajes(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeAcceso', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeAcceso (
        garaje_id                 INT PRIMARY KEY,
        metodo_acceso             VARCHAR(50) NOT NULL,
        codigo_acceso_hash        NVARCHAR(255) NULL,
        qr_token                  NVARCHAR(255) NULL,
        ventana_ingreso_minutos   INT NOT NULL DEFAULT 15,
        requiere_confirmacion     BIT NOT NULL DEFAULT 0,
        instrucciones_publicas    NVARCHAR(500) NULL,
        instrucciones_privadas    NVARCHAR(500) NULL,
        fecha_creacion            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        fecha_actualizacion       DATETIME2 NULL,
        CONSTRAINT FK_acad_GarajeAcceso_Garajes
            FOREIGN KEY (garaje_id) REFERENCES dbo.Garajes(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeSeguridad', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeSeguridad (
        garaje_id                 INT PRIMARY KEY,
        nivel_seguridad           VARCHAR(50) NOT NULL,
        guardia_presencial        BIT NOT NULL DEFAULT 0,
        camaras_24h               BIT NOT NULL DEFAULT 0,
        sensor_movimiento         BIT NOT NULL DEFAULT 0,
        alarma_sonora             BIT NOT NULL DEFAULT 0,
        salida_emergencia         BIT NOT NULL DEFAULT 0,
        telefono_emergencia       NVARCHAR(20) NULL,
        fecha_creacion            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_GarajeSeguridad_Garajes
            FOREIGN KEY (garaje_id) REFERENCES dbo.Garajes(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeCapacidad', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeCapacidad (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        garaje_id           INT NOT NULL,
        tipo_vehiculo       VARCHAR(30) NOT NULL,
        cupos_totales       INT NOT NULL,
        cupos_operativos    INT NOT NULL,
        cupos_reservados    INT NOT NULL DEFAULT 0,
        fecha_corte         DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_GarajeCapacidad_Garajes
            FOREIGN KEY (garaje_id) REFERENCES dbo.Garajes(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeHorarioCabecera', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeHorarioCabecera (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        garaje_id           INT NOT NULL,
        nombre              NVARCHAR(120) NOT NULL,
        tipo_horario        VARCHAR(30) NOT NULL DEFAULT 'regular',
        vigente_desde       DATE NULL,
        vigente_hasta       DATE NULL,
        activo              BIT NOT NULL DEFAULT 1,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_GarajeHorarioCabecera_Garajes
            FOREIGN KEY (garaje_id) REFERENCES dbo.Garajes(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeHorarioDia', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeHorarioDia (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        horario_id          INT NOT NULL,
        dia_semana          TINYINT NOT NULL,
        hora_apertura       TIME NOT NULL,
        hora_cierre         TIME NOT NULL,
        es_24h              BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_acad_GarajeHorarioDia_Horario
            FOREIGN KEY (horario_id) REFERENCES acad.GarajeHorarioCabecera(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeTarifa', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeTarifa (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        garaje_id           INT NOT NULL,
        nombre_tarifa       NVARCHAR(120) NOT NULL,
        moneda              CHAR(3) NOT NULL DEFAULT 'BOB',
        precio_hora         DECIMAL(10,2) NOT NULL,
        precio_minimo       DECIMAL(10,2) NULL,
        activa              BIT NOT NULL DEFAULT 1,
        vigente_desde       DATETIME2 NULL,
        vigente_hasta       DATETIME2 NULL,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_GarajeTarifa_Garajes
            FOREIGN KEY (garaje_id) REFERENCES dbo.Garajes(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeTarifaEspecial', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeTarifaEspecial (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        tarifa_id           INT NOT NULL,
        nombre              NVARCHAR(120) NOT NULL,
        dia_semana          TINYINT NULL,
        hora_inicio         TIME NULL,
        hora_fin            TIME NULL,
        porcentaje_ajuste   DECIMAL(6,2) NOT NULL DEFAULT 0,
        monto_fijo_ajuste   DECIMAL(10,2) NOT NULL DEFAULT 0,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_GarajeTarifaEspecial_Tarifa
            FOREIGN KEY (tarifa_id) REFERENCES acad.GarajeTarifa(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeImagenMeta', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeImagenMeta (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        foto_garaje_id      INT NOT NULL,
        ancho_px            INT NULL,
        alto_px             INT NULL,
        peso_bytes          BIGINT NULL,
        hash_sha256         VARCHAR(64) NULL,
        formato             VARCHAR(20) NULL,
        es_portada          BIT NOT NULL DEFAULT 0,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_GarajeImagenMeta_Fotos
            FOREIGN KEY (foto_garaje_id) REFERENCES dbo.FotosGaraje(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeEstadoHistorial', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeEstadoHistorial (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        garaje_id           INT NOT NULL,
        estado_anterior     VARCHAR(30) NULL,
        estado_nuevo        VARCHAR(30) NOT NULL,
        motivo              NVARCHAR(200) NULL,
        cambiado_por        INT NULL,
        fecha_cambio        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_GarajeEstadoHistorial_Garaje
            FOREIGN KEY (garaje_id) REFERENCES dbo.Garajes(id) ON DELETE CASCADE,
        CONSTRAINT FK_acad_GarajeEstadoHistorial_Cred
            FOREIGN KEY (cambiado_por) REFERENCES dbo.Credenciales(id)
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeDocumento', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeDocumento (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        garaje_id           INT NOT NULL,
        tipo_documento      VARCHAR(40) NOT NULL,
        numero_documento    NVARCHAR(80) NULL,
        archivo_url         NVARCHAR(255) NULL,
        validado            BIT NOT NULL DEFAULT 0,
        fecha_expiracion    DATE NULL,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_GarajeDocumento_Garaje
            FOREIGN KEY (garaje_id) REFERENCES dbo.Garajes(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeServicio', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeServicio (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        garaje_id           INT NOT NULL,
        nombre_servicio     NVARCHAR(120) NOT NULL,
        descripcion         NVARCHAR(255) NULL,
        precio_extra        DECIMAL(10,2) NULL,
        activo              BIT NOT NULL DEFAULT 1,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_GarajeServicio_Garaje
            FOREIGN KEY (garaje_id) REFERENCES dbo.Garajes(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeServicioHorario', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeServicioHorario (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        servicio_id         INT NOT NULL,
        dia_semana          TINYINT NOT NULL,
        hora_inicio         TIME NOT NULL,
        hora_fin            TIME NOT NULL,
        CONSTRAINT FK_acad_GarajeServicioHorario_Servicio
            FOREIGN KEY (servicio_id) REFERENCES acad.GarajeServicio(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.GarajeMantenimiento', N'U') IS NULL
BEGIN
    CREATE TABLE acad.GarajeMantenimiento (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        garaje_id           INT NOT NULL,
        anfitrion_id        INT NOT NULL,
        tipo_mantenimiento  VARCHAR(40) NOT NULL,
        estado              VARCHAR(30) NOT NULL DEFAULT 'programado',
        fecha_inicio        DATETIME2 NOT NULL,
        fecha_fin           DATETIME2 NULL,
        costo_estimado      DECIMAL(10,2) NULL,
        observaciones       NVARCHAR(255) NULL,
        CONSTRAINT FK_acad_GarajeMantenimiento_Garaje
            FOREIGN KEY (garaje_id) REFERENCES dbo.Garajes(id) ON DELETE CASCADE,
        CONSTRAINT FK_acad_GarajeMantenimiento_Anfitrion
            FOREIGN KEY (anfitrion_id) REFERENCES dbo.UsuarioAnfitrion(id)
    );
END;
GO

IF OBJECT_ID(N'acad.ConductorPreferencia', N'U') IS NULL
BEGIN
    CREATE TABLE acad.ConductorPreferencia (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        conductor_id        INT NOT NULL,
        clave               VARCHAR(60) NOT NULL,
        valor               NVARCHAR(255) NOT NULL,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_ConductorPreferencia_Conductor
            FOREIGN KEY (conductor_id) REFERENCES dbo.UsuarioConductor(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.ConductorVehiculo', N'U') IS NULL
BEGIN
    CREATE TABLE acad.ConductorVehiculo (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        conductor_id        INT NOT NULL,
        placa               NVARCHAR(20) NOT NULL,
        marca               NVARCHAR(60) NULL,
        modelo              NVARCHAR(60) NULL,
        tipo_vehiculo       VARCHAR(20) NOT NULL DEFAULT 'auto',
        color               NVARCHAR(30) NULL,
        activo              BIT NOT NULL DEFAULT 1,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_acad_ConductorVehiculo UNIQUE (conductor_id, placa),
        CONSTRAINT FK_acad_ConductorVehiculo_Conductor
            FOREIGN KEY (conductor_id) REFERENCES dbo.UsuarioConductor(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.ConductorActividad', N'U') IS NULL
BEGIN
    CREATE TABLE acad.ConductorActividad (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        conductor_id        INT NOT NULL,
        tipo_evento         VARCHAR(40) NOT NULL,
        descripcion         NVARCHAR(255) NULL,
        ip_origen           VARCHAR(45) NULL,
        user_agent          NVARCHAR(255) NULL,
        fecha_evento        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_ConductorActividad_Conductor
            FOREIGN KEY (conductor_id) REFERENCES dbo.UsuarioConductor(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.ReservaEstadoHistorial', N'U') IS NULL
BEGIN
    CREATE TABLE acad.ReservaEstadoHistorial (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        reserva_id          INT NOT NULL,
        estado_anterior     VARCHAR(30) NULL,
        estado_nuevo        VARCHAR(30) NOT NULL,
        actor_id            INT NULL,
        comentario          NVARCHAR(255) NULL,
        fecha_evento        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_ReservaEstadoHistorial_Reserva
            FOREIGN KEY (reserva_id) REFERENCES dbo.Reservas(id) ON DELETE CASCADE,
        CONSTRAINT FK_acad_ReservaEstadoHistorial_Actor
            FOREIGN KEY (actor_id) REFERENCES dbo.Credenciales(id)
    );
END;
GO

IF OBJECT_ID(N'acad.ReservaBitacora', N'U') IS NULL
BEGIN
    CREATE TABLE acad.ReservaBitacora (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        reserva_id          INT NOT NULL,
        evento              VARCHAR(60) NOT NULL,
        payload_json        NVARCHAR(MAX) NULL,
        fecha_evento        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_ReservaBitacora_Reserva
            FOREIGN KEY (reserva_id) REFERENCES dbo.Reservas(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.ReservaBloqueoTTL', N'U') IS NULL
BEGIN
    CREATE TABLE acad.ReservaBloqueoTTL (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        reserva_id          INT NOT NULL,
        bloqueo_desde       DATETIME2 NOT NULL,
        bloqueo_hasta       DATETIME2 NOT NULL,
        motivo              NVARCHAR(200) NULL,
        aplicado            BIT NOT NULL DEFAULT 0,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_ReservaBloqueoTTL_Reserva
            FOREIGN KEY (reserva_id) REFERENCES dbo.Reservas(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.ReservaMultaDetalle', N'U') IS NULL
BEGIN
    CREATE TABLE acad.ReservaMultaDetalle (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        reserva_id          INT NOT NULL,
        minutos_exceso      INT NOT NULL DEFAULT 0,
        tarifa_base_hora    DECIMAL(10,2) NOT NULL DEFAULT 0,
        factor_recargo      DECIMAL(6,2) NOT NULL DEFAULT 1.00,
        monto_calculado     DECIMAL(10,2) NOT NULL DEFAULT 0,
        observaciones       NVARCHAR(255) NULL,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_ReservaMultaDetalle_Reserva
            FOREIGN KEY (reserva_id) REFERENCES dbo.Reservas(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.PagoTransaccion', N'U') IS NULL
BEGIN
    CREATE TABLE acad.PagoTransaccion (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        reserva_id          INT NOT NULL,
        metodo_pago         VARCHAR(30) NOT NULL,
        estado              VARCHAR(30) NOT NULL DEFAULT 'pendiente',
        moneda              CHAR(3) NOT NULL DEFAULT 'BOB',
        monto               DECIMAL(10,2) NOT NULL,
        referencia_externa  NVARCHAR(120) NULL,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        fecha_confirmacion  DATETIME2 NULL,
        CONSTRAINT FK_acad_PagoTransaccion_Reserva
            FOREIGN KEY (reserva_id) REFERENCES dbo.Reservas(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.PagoIntento', N'U') IS NULL
BEGIN
    CREATE TABLE acad.PagoIntento (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        transaccion_id      BIGINT NOT NULL,
        nro_intento         INT NOT NULL,
        proveedor           VARCHAR(40) NULL,
        request_json        NVARCHAR(MAX) NULL,
        response_json       NVARCHAR(MAX) NULL,
        exitoso             BIT NOT NULL DEFAULT 0,
        fecha_intento       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_PagoIntento_Transaccion
            FOREIGN KEY (transaccion_id) REFERENCES acad.PagoTransaccion(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.PagoComprobante', N'U') IS NULL
BEGIN
    CREATE TABLE acad.PagoComprobante (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        transaccion_id      BIGINT NOT NULL,
        tipo_comprobante    VARCHAR(30) NOT NULL,
        url_archivo         NVARCHAR(255) NULL,
        hash_archivo        VARCHAR(64) NULL,
        validado            BIT NOT NULL DEFAULT 0,
        fecha_subida        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_PagoComprobante_Transaccion
            FOREIGN KEY (transaccion_id) REFERENCES acad.PagoTransaccion(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'dbo.Cupones', N'U') IS NOT NULL
BEGIN
    IF OBJECT_ID(N'acad.CuponAplicacion', N'U') IS NULL
    BEGIN
        CREATE TABLE acad.CuponAplicacion (
            id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
            cupon_id            INT NOT NULL,
            reserva_id          INT NOT NULL,
            conductor_id        INT NOT NULL,
            monto_base          DECIMAL(10,2) NOT NULL,
            monto_descuento     DECIMAL(10,2) NOT NULL,
            monto_final         DECIMAL(10,2) NOT NULL,
            fecha_aplicacion    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_acad_CuponAplicacion_Cupon
                FOREIGN KEY (cupon_id) REFERENCES dbo.Cupones(id),
            CONSTRAINT FK_acad_CuponAplicacion_Reserva
                FOREIGN KEY (reserva_id) REFERENCES dbo.Reservas(id),
            CONSTRAINT FK_acad_CuponAplicacion_Conductor
                FOREIGN KEY (conductor_id) REFERENCES dbo.UsuarioConductor(id)
        );
    END;
END
ELSE
    PRINT 'i  dbo.Cupones no existe aun. Se omite acad.CuponAplicacion.';
GO

IF OBJECT_ID(N'dbo.Cupones', N'U') IS NOT NULL
BEGIN
    IF OBJECT_ID(N'acad.CuponRegla', N'U') IS NULL
    BEGIN
        CREATE TABLE acad.CuponRegla (
            id                  INT IDENTITY(1,1) PRIMARY KEY,
            cupon_id            INT NOT NULL,
            clave               VARCHAR(60) NOT NULL,
            operador            VARCHAR(20) NOT NULL,
            valor               NVARCHAR(120) NOT NULL,
            prioridad           INT NOT NULL DEFAULT 1,
            activo              BIT NOT NULL DEFAULT 1,
            fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_acad_CuponRegla_Cupon
                FOREIGN KEY (cupon_id) REFERENCES dbo.Cupones(id) ON DELETE CASCADE
        );
    END;
END
ELSE
    PRINT 'i  dbo.Cupones no existe aun. Se omite acad.CuponRegla.';
GO

IF OBJECT_ID(N'dbo.Cupones', N'U') IS NOT NULL
BEGIN
    IF OBJECT_ID(N'acad.CuponSegmento', N'U') IS NULL
    BEGIN
        CREATE TABLE acad.CuponSegmento (
            id                  INT IDENTITY(1,1) PRIMARY KEY,
            cupon_id            INT NOT NULL,
            segmento            VARCHAR(60) NOT NULL,
            activo              BIT NOT NULL DEFAULT 1,
            fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
            CONSTRAINT FK_acad_CuponSegmento_Cupon
                FOREIGN KEY (cupon_id) REFERENCES dbo.Cupones(id) ON DELETE CASCADE
        );
    END;
END
ELSE
    PRINT 'i  dbo.Cupones no existe aun. Se omite acad.CuponSegmento.';
GO

IF OBJECT_ID(N'acad.RutaSolicitud', N'U') IS NULL
BEGIN
    CREATE TABLE acad.RutaSolicitud (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        reserva_id          INT NULL,
        conductor_id        INT NOT NULL,
        origen_lat          DECIMAL(10,7) NOT NULL,
        origen_lng          DECIMAL(10,7) NOT NULL,
        destino_lat         DECIMAL(10,7) NOT NULL,
        destino_lng         DECIMAL(10,7) NOT NULL,
        proveedor_mapa      VARCHAR(40) NULL,
        distancia_m         INT NULL,
        duracion_s          INT NULL,
        estado              VARCHAR(30) NOT NULL DEFAULT 'calculada',
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_RutaSolicitud_Reserva
            FOREIGN KEY (reserva_id) REFERENCES dbo.Reservas(id),
        CONSTRAINT FK_acad_RutaSolicitud_Conductor
            FOREIGN KEY (conductor_id) REFERENCES dbo.UsuarioConductor(id)
    );
END;
GO

IF OBJECT_ID(N'acad.RutaTramo', N'U') IS NULL
BEGIN
    CREATE TABLE acad.RutaTramo (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        ruta_id             BIGINT NOT NULL,
        orden_tramo         INT NOT NULL,
        instruccion         NVARCHAR(255) NULL,
        distancia_m         INT NULL,
        duracion_s          INT NULL,
        latitud             DECIMAL(10,7) NULL,
        longitud            DECIMAL(10,7) NULL,
        CONSTRAINT FK_acad_RutaTramo_Ruta
            FOREIGN KEY (ruta_id) REFERENCES acad.RutaSolicitud(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.RutaEventoETA', N'U') IS NULL
BEGIN
    CREATE TABLE acad.RutaEventoETA (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        ruta_id             BIGINT NOT NULL,
        eta_segundos        INT NOT NULL,
        velocidad_kmh       DECIMAL(8,2) NULL,
        precision_gps_m     DECIMAL(8,2) NULL,
        fecha_evento        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_RutaEventoETA_Ruta
            FOREIGN KEY (ruta_id) REFERENCES acad.RutaSolicitud(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.Notificacion', N'U') IS NULL
BEGIN
    CREATE TABLE acad.Notificacion (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        usuario_id          INT NOT NULL,
        canal               VARCHAR(30) NOT NULL,
        titulo              NVARCHAR(150) NOT NULL,
        mensaje             NVARCHAR(500) NOT NULL,
        estado              VARCHAR(30) NOT NULL DEFAULT 'pendiente',
        prioridad           VARCHAR(20) NOT NULL DEFAULT 'normal',
        fecha_programada    DATETIME2 NULL,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_Notificacion_Usuario
            FOREIGN KEY (usuario_id) REFERENCES dbo.Credenciales(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.NotificacionEntrega', N'U') IS NULL
BEGIN
    CREATE TABLE acad.NotificacionEntrega (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        notificacion_id     BIGINT NOT NULL,
        proveedor           VARCHAR(40) NULL,
        resultado           VARCHAR(40) NOT NULL,
        codigo_resultado    VARCHAR(40) NULL,
        detalle             NVARCHAR(255) NULL,
        fecha_intento       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_NotificacionEntrega_Notificacion
            FOREIGN KEY (notificacion_id) REFERENCES acad.Notificacion(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.AuditoriaEvento', N'U') IS NULL
BEGIN
    CREATE TABLE acad.AuditoriaEvento (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        usuario_id          INT NULL,
        modulo              VARCHAR(60) NOT NULL,
        accion              VARCHAR(60) NOT NULL,
        entidad             VARCHAR(60) NULL,
        entidad_id          NVARCHAR(60) NULL,
        ip_origen           VARCHAR(45) NULL,
        resultado           VARCHAR(30) NOT NULL DEFAULT 'ok',
        payload_json        NVARCHAR(MAX) NULL,
        fecha_evento        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_AuditoriaEvento_Usuario
            FOREIGN KEY (usuario_id) REFERENCES dbo.Credenciales(id)
    );
END;
GO

IF OBJECT_ID(N'acad.AuditoriaCambioCampo', N'U') IS NULL
BEGIN
    CREATE TABLE acad.AuditoriaCambioCampo (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        auditoria_id        BIGINT NOT NULL,
        campo               NVARCHAR(100) NOT NULL,
        valor_anterior      NVARCHAR(MAX) NULL,
        valor_nuevo         NVARCHAR(MAX) NULL,
        CONSTRAINT FK_acad_AuditoriaCambioCampo_Evento
            FOREIGN KEY (auditoria_id) REFERENCES acad.AuditoriaEvento(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.IoTDispositivo', N'U') IS NULL
BEGIN
    CREATE TABLE acad.IoTDispositivo (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        garaje_id           INT NOT NULL,
        codigo_serial       VARCHAR(80) NOT NULL,
        tipo_dispositivo    VARCHAR(40) NOT NULL,
        estado              VARCHAR(30) NOT NULL DEFAULT 'activo',
        firmware_version    VARCHAR(40) NULL,
        bateria_pct         DECIMAL(5,2) NULL,
        ultimo_ping         DATETIME2 NULL,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_acad_IoTDispositivo_Serial UNIQUE (codigo_serial),
        CONSTRAINT FK_acad_IoTDispositivo_Garaje
            FOREIGN KEY (garaje_id) REFERENCES dbo.Garajes(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'acad.IoTEvento', N'U') IS NULL
BEGIN
    CREATE TABLE acad.IoTEvento (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        dispositivo_id      BIGINT NOT NULL,
        espacio_id          INT NULL,
        tipo_evento         VARCHAR(50) NOT NULL,
        valor_numerico      DECIMAL(12,4) NULL,
        valor_texto         NVARCHAR(255) NULL,
        raw_json            NVARCHAR(MAX) NULL,
        fecha_evento        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_acad_IoTEvento_Dispositivo
            FOREIGN KEY (dispositivo_id) REFERENCES acad.IoTDispositivo(id) ON DELETE CASCADE,
        CONSTRAINT FK_acad_IoTEvento_Espacio
            FOREIGN KEY (espacio_id) REFERENCES dbo.Espacios(id)
    );
END;
GO

IF OBJECT_ID(N'acad.IoTAlerta', N'U') IS NULL
BEGIN
    CREATE TABLE acad.IoTAlerta (
        id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
        evento_id           BIGINT NOT NULL,
        severidad           VARCHAR(20) NOT NULL,
        estado              VARCHAR(20) NOT NULL DEFAULT 'abierta',
        titulo              NVARCHAR(120) NOT NULL,
        detalle             NVARCHAR(255) NULL,
        fecha_creacion      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        fecha_cierre        DATETIME2 NULL,
        CONSTRAINT FK_acad_IoTAlerta_Evento
            FOREIGN KEY (evento_id) REFERENCES acad.IoTEvento(id) ON DELETE CASCADE
    );
END;
GO

/* ============================================================
   B) CATALOGOS ACADEMICOS (tabla por catalogo de negocio)
   - Permite justificar descomposicion por dominios.
   - Se crean de forma generica e idempotente.
============================================================ */

DECLARE @Catalogos TABLE (tabla SYSNAME NOT NULL PRIMARY KEY, descripcion NVARCHAR(200) NULL);
INSERT INTO @Catalogos (tabla, descripcion)
VALUES
('Cat_RolSistema', 'Roles del sistema'),
('Cat_EstadoCuenta', 'Estados de cuenta'),
('Cat_Pais', 'Paises'),
('Cat_Departamento', 'Departamentos'),
('Cat_Ciudad', 'Ciudades'),
('Cat_ZonaUrbana', 'Zonas urbanas'),
('Cat_TipoDocumento', 'Tipos de documento'),
('Cat_TipoTelefono', 'Tipos de telefono'),
('Cat_TipoVehiculo', 'Tipos de vehiculo'),
('Cat_TipoCombustible', 'Tipos de combustible'),
('Cat_ColorVehiculo', 'Colores de vehiculo'),
('Cat_TransmisionVehiculo', 'Tipos de transmision'),
('Cat_TipoGaraje', 'Tipos de garaje'),
('Cat_TipoEspacio', 'Tipos de espacio'),
('Cat_CondicionFisicaEspacio', 'Condicion fisica del espacio'),
('Cat_EstadoEspacio', 'Estados de espacio'),
('Cat_EstadoGaraje', 'Estados de garaje'),
('Cat_NivelSeguridad', 'Niveles de seguridad'),
('Cat_MetodoAcceso', 'Metodos de acceso'),
('Cat_DiaSemana', 'Dias de la semana'),
('Cat_Moneda', 'Monedas'),
('Cat_EstadoReserva', 'Estados de reserva'),
('Cat_EstadoPago', 'Estados de pago'),
('Cat_MetodoPago', 'Metodos de pago'),
('Cat_EstadoTransaccion', 'Estados de transaccion'),
('Cat_TipoComprobante', 'Tipos de comprobante'),
('Cat_TipoCupon', 'Tipos de cupon'),
('Cat_SegmentoCliente', 'Segmentos de cliente'),
('Cat_EstadoCupon', 'Estados de cupon'),
('Cat_CanalNotificacion', 'Canales de notificacion'),
('Cat_EstadoNotificacion', 'Estados de notificacion'),
('Cat_ResultadoEntrega', 'Resultados de entrega'),
('Cat_TipoEventoAuditoria', 'Tipos de eventos de auditoria'),
('Cat_SeveridadAuditoria', 'Severidades de auditoria'),
('Cat_ModuloSistema', 'Modulos del sistema'),
('Cat_AccionSistema', 'Acciones del sistema'),
('Cat_TipoDispositivoIoT', 'Tipos de dispositivo IoT'),
('Cat_EstadoDispositivoIoT', 'Estados de dispositivo IoT'),
('Cat_TipoSensorIoT', 'Tipos de sensores IoT'),
('Cat_EstadoSensorIoT', 'Estados de sensor IoT'),
('Cat_TipoEventoIoT', 'Tipos de eventos IoT'),
('Cat_NivelAlertaIoT', 'Niveles de alerta IoT'),
('Cat_EstadoAlertaIoT', 'Estados de alerta IoT'),
('Cat_TipoRuta', 'Tipos de ruta'),
('Cat_EstadoRuta', 'Estados de ruta'),
('Cat_TipoTramoRuta', 'Tipos de tramo de ruta'),
('Cat_TipoIncidenciaRuta', 'Tipos de incidencia de ruta'),
('Cat_PrioridadIncidencia', 'Prioridades de incidencia'),
('Cat_TipoMantenimiento', 'Tipos de mantenimiento'),
('Cat_EstadoMantenimiento', 'Estados de mantenimiento'),
('Cat_TipoServicioGaraje', 'Tipos de servicio del garaje'),
('Cat_EstadoServicioGaraje', 'Estados de servicio del garaje'),
('Cat_TipoTarifa', 'Tipos de tarifa'),
('Cat_EstadoTarifa', 'Estados de tarifa'),
('Cat_TipoHorario', 'Tipos de horario'),
('Cat_EstadoHorario', 'Estados de horario'),
('Cat_TipoPolitica', 'Tipos de politica'),
('Cat_EstadoPolitica', 'Estados de politica'),
('Cat_TipoResena', 'Tipos de resena'),
('Cat_ClasificacionResena', 'Clasificaciones de resena'),
('Cat_TipoFavorito', 'Tipos de favorito'),
('Cat_TipoPreferenciaConductor', 'Tipos de preferencia conductor'),
('Cat_EstadoPreferenciaConductor', 'Estados de preferencia conductor'),
('Cat_TipoBloqueo', 'Tipos de bloqueo'),
('Cat_MotivoCancelacion', 'Motivos de cancelacion'),
('Cat_MotivoRechazo', 'Motivos de rechazo'),
('Cat_TipoPenalizacion', 'Tipos de penalizacion'),
('Cat_EstadoDocumento', 'Estados de documento'),
('Cat_TipoArchivo', 'Tipos de archivo'),
('Cat_TipoIntegracion', 'Tipos de integracion'),
('Cat_EstadoIntegracion', 'Estados de integracion'),
('Cat_ProveedorMapa', 'Proveedores de mapa'),
('Cat_ProveedorPago', 'Proveedores de pago'),
('Cat_ProveedorSMS', 'Proveedores SMS'),
('Cat_ProveedorEmail', 'Proveedores email'),
('Cat_ProveedorPush', 'Proveedores push'),
('Cat_TipoReporte', 'Tipos de reporte'),
('Cat_FrecuenciaReporte', 'Frecuencias de reporte'),
('Cat_EstadoReporte', 'Estados de reporte'),
('Cat_TipoDashboard', 'Tipos de dashboard'),
('Cat_VisibilidadDato', 'Visibilidad de datos'),
('Cat_TipoBitacora', 'Tipos de bitacora'),
('Cat_FuenteDato', 'Fuentes de datos'),
('Cat_CalidadDato', 'Niveles de calidad de datos'),
('Cat_EstadoSincronizacion', 'Estados de sincronizacion'),
('Cat_TipoBackup', 'Tipos de backup'),
('Cat_EstadoBackup', 'Estados de backup'),
('Cat_TipoDespliegue', 'Tipos de despliegue'),
('Cat_Entorno', 'Entornos'),
('Cat_TipoErrorAplicacion', 'Tipos de error de aplicacion'),
('Cat_SeveridadError', 'Severidades de error'),
('Cat_TipoLogTecnico', 'Tipos de log tecnico'),
('Cat_OrigenLogTecnico', 'Origen de logs tecnicos'),
('Cat_EstadoRevision', 'Estados de revision'),
('Cat_TipoRevision', 'Tipos de revision'),
('Cat_TipoSLA', 'Tipos de SLA'),
('Cat_EstadoSLA', 'Estados de SLA'),
('Cat_TipoKPI', 'Tipos de KPI'),
('Cat_EstadoKPI', 'Estados de KPI'),
('Cat_TipoExportacion', 'Tipos de exportacion'),
('Cat_FormatoExportacion', 'Formatos de exportacion'),
('Cat_EstadoExportacion', 'Estados de exportacion'),
('Cat_TipoAlertaNegocio', 'Tipos de alerta de negocio'),
('Cat_EstadoAlertaNegocio', 'Estados de alerta de negocio');

DECLARE @t SYSNAME;
DECLARE @sql NVARCHAR(MAX);

DECLARE cur_catalogos CURSOR LOCAL FAST_FORWARD FOR
    SELECT tabla FROM @Catalogos ORDER BY tabla;

OPEN cur_catalogos;
FETCH NEXT FROM cur_catalogos INTO @t;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'acad.' + @t, N'U') IS NULL
    BEGIN
        SET @sql = N'
        CREATE TABLE acad.' + QUOTENAME(@t) + N' (
            id INT IDENTITY(1,1) PRIMARY KEY,
            codigo VARCHAR(50) NOT NULL UNIQUE,
            nombre NVARCHAR(150) NOT NULL,
            descripcion NVARCHAR(300) NULL,
            activo BIT NOT NULL CONSTRAINT DF_' + @t + N'_activo DEFAULT (1),
            fecha_creacion DATETIME2 NOT NULL CONSTRAINT DF_' + @t + N'_fecha DEFAULT SYSUTCDATETIME()
        );';
        EXEC sp_executesql @sql;
    END;

    FETCH NEXT FROM cur_catalogos INTO @t;
END

CLOSE cur_catalogos;
DEALLOCATE cur_catalogos;
GO

/* ============================================================
   C) VALIDACION RAPIDA DE CANTIDAD DE TABLAS
============================================================ */
PRINT '';
PRINT '=== RESUMEN DE TABLAS ===';

SELECT 
    COUNT(*) AS total_tablas_bd
FROM sys.tables;

SELECT 
    COUNT(*) AS total_tablas_dbo
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE s.name = 'dbo';

SELECT 
    COUNT(*) AS total_tablas_acad
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE s.name = 'acad';

PRINT 'Patch academico aplicado. El codigo actual sigue usando dbo; acad queda listo para defensa/normalizacion.';
GO
