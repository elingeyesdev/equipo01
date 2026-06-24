-- ============================================================
-- EstAirbnb — patch_completar_sprint.sql
-- Módulos 1.3 (Vehículos) + 4.2 (Soporte/Tickets)
-- Idempotente: seguro de ejecutar múltiples veces
-- ============================================================

USE EstAirbnbDB;
GO

-- ============================================================
-- 1. Tabla Vehiculos — Módulo 1.3 Gestión de Perfiles
--    Conductor puede registrar varios vehículos con placa,
--    marca, modelo, color y tipo. Uno puede ser el principal.
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Vehiculos')
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

-- ============================================================
-- 2. Tabla Tickets — Módulo 4.2 Soporte y Disputas
--    Usuarios envían reportes/disputas. El sistema asigna
--    un estado: abierto → en_revision → resuelto/cerrado.
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Tickets')
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

-- ============================================================
-- 3. Columnas adicionales en Reservas (si faltan en instancias
--    que no corrieron patch_sprint2.sql)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reservas') AND name = 'cupon_codigo')
BEGIN
  ALTER TABLE Reservas ADD cupon_codigo       VARCHAR(30)    NULL;
  ALTER TABLE Reservas ADD descuento_aplicado DECIMAL(10,2)  NOT NULL DEFAULT 0;
  PRINT '+ Columnas cupon_codigo y descuento_aplicado agregadas a Reservas.';
END
ELSE
  PRINT 'i  Columnas de cupón ya existen en Reservas.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reservas') AND name = 'estado_pago')
BEGIN
  ALTER TABLE Reservas ADD estado_pago VARCHAR(20) NOT NULL DEFAULT 'pendiente';
  PRINT '+ Columna estado_pago agregada a Reservas.';
END
ELSE
  PRINT 'i  Columna estado_pago ya existe.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reservas') AND name = 'motivo_rechazo')
BEGIN
  ALTER TABLE Reservas ADD motivo_rechazo NVARCHAR(500) NULL;
  PRINT '+ Columna motivo_rechazo agregada a Reservas.';
END
ELSE
  PRINT 'i  Columna motivo_rechazo ya existe.';
GO

-- ============================================================
-- 4. Asegurar que la tabla Cupones existe con todos los campos
--    (por si no se corrió patch_sprint3.sql + patch_cupones)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Cupones')
BEGIN
  CREATE TABLE Cupones (
    id                   INT IDENTITY(1,1) PRIMARY KEY,
    codigo               VARCHAR(30)      NOT NULL UNIQUE,
    tipo_descuento       VARCHAR(15)      NOT NULL DEFAULT 'porcentaje',
    descuento_porcentaje INT              NOT NULL DEFAULT 0,
    monto_fijo           DECIMAL(10,2)    NULL,
    descripcion          NVARCHAR(200)    NULL,
    usos_maximos         INT              NULL,
    usos_actuales        INT              NOT NULL DEFAULT 0,
    solo_primera_reserva BIT              NOT NULL DEFAULT 0,
    fecha_inicio         DATETIME         NOT NULL DEFAULT GETDATE(),
    fecha_fin            DATETIME         NOT NULL,
    activo               BIT              NOT NULL DEFAULT 1,
    creado_en            DATETIME         NOT NULL DEFAULT GETDATE()
  );
  PRINT '+ Tabla Cupones creada.';
END
ELSE
BEGIN
  PRINT 'i  Tabla Cupones ya existe.';
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cupones') AND name = 'tipo_descuento')
  BEGIN
    ALTER TABLE Cupones ADD tipo_descuento VARCHAR(15) NOT NULL DEFAULT 'porcentaje';
    PRINT '+ Columna tipo_descuento agregada a Cupones.';
  END
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cupones') AND name = 'monto_fijo')
  BEGIN
    ALTER TABLE Cupones ADD monto_fijo DECIMAL(10,2) NULL;
    PRINT '+ Columna monto_fijo agregada a Cupones.';
  END
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Cupones') AND name = 'solo_primera_reserva')
  BEGIN
    ALTER TABLE Cupones ADD solo_primera_reserva BIT NOT NULL DEFAULT 0;
    PRINT '+ Columna solo_primera_reserva agregada a Cupones.';
  END
END
GO

PRINT '';
PRINT '============================================================';
PRINT 'patch_completar_sprint.sql — aplicado correctamente';
PRINT '  + Tabla Vehiculos (modulo 1.3)';
PRINT '  + Tabla Tickets   (modulo 4.2)';
PRINT '  + Columnas Reservas verificadas';
PRINT '  + Tabla Cupones verificada';
PRINT '============================================================';
GO
