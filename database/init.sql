-- ============================================================
-- EstAirbnb — Script de inicialización de Base de Datos
-- Ejecutar en SQL Server Management Studio (SSMS)
-- ============================================================

-- 1. Crear la base de datos (si no existe)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'EstAirbnbDB')
BEGIN
    CREATE DATABASE EstAirbnbDB;
    PRINT '✅ Base de datos EstAirbnbDB creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'ℹ️  La base de datos EstAirbnbDB ya existe.';
END
GO

USE EstAirbnbDB;
GO

-- 2. Crear la tabla Usuarios
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

    PRINT '✅ Tabla Usuarios creada exitosamente.';
END
ELSE
BEGIN
    PRINT 'ℹ️  La tabla Usuarios ya existe.';
END
GO

-- 3. Insertar un usuario de prueba (para testear el endpoint PUT)
IF NOT EXISTS (SELECT 1 FROM [dbo].[Usuarios] WHERE email = 'juan.perez@email.com')
BEGIN
    INSERT INTO [dbo].[Usuarios] (nombre, apellidos, telefono, email, password)
    VALUES (
        N'Juan',
        N'Pérez',
        N'+1 (809) 555-1234',
        N'juan.perez@email.com',
        N'hashed_password_placeholder'   -- En producción, usar bcrypt o similar
    );

    PRINT '✅ Usuario de prueba insertado (id = 1).';
END
ELSE
BEGIN
    PRINT 'ℹ️  El usuario de prueba ya existe.';
END
GO

PRINT '';
PRINT '🚗 Base de datos EstAirbnbDB lista para usar.';
GO
