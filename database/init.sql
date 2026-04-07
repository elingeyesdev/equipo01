-- ============================================
-- ParqueoAirbin - Módulo de Identidad
-- Versión 1: Tabla de Usuarios
-- ============================================

-- Crear la base de datos (ejecutar manualmente si no existe)
-- CREATE DATABASE parqueo_airbin;

-- Conectarse a la base de datos antes de ejecutar lo siguiente:
-- \c parqueo_airbin;

-- Tabla: usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100)  NOT NULL,
    correo      VARCHAR(150)  NOT NULL UNIQUE,
    contrasena  VARCHAR(255)  NOT NULL,
    rol         VARCHAR(20)   NOT NULL DEFAULT 'conductor',
    creado_en   TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas rápidas por correo
CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON usuarios(correo);

-- ============================================
-- Módulo de Espacios de Parqueo
-- Versión 1: Tabla de Espacios
-- ============================================

-- Tabla: espacios
CREATE TABLE IF NOT EXISTS espacios (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER       NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    direccion       VARCHAR(255)  NOT NULL,
    capacidad       INTEGER       NOT NULL DEFAULT 1,
    precio_por_hora NUMERIC(10,2) NOT NULL,
    creado_en       TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_espacios_usuario ON espacios(usuario_id);

-- ============================================
-- Módulo de Vehículos (Activos)
-- Versión 1: Tabla de Vehículos
-- ============================================

-- Tabla: vehiculos
CREATE TABLE IF NOT EXISTS vehiculos (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER       NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    placa           VARCHAR(50)   NOT NULL,
    marca           VARCHAR(100)  NOT NULL,
    modelo          VARCHAR(100)  NOT NULL,
    creado_en       TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- Índice para búsquedas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_vehiculos_usuario ON vehiculos(usuario_id);

