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
