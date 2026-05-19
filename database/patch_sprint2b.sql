-- ============================================================
-- EstAirbnb — patch_sprint2b.sql
-- Programa de Fidelidad + Overstay/Multa
-- Ejecutar en SSMS sobre la base de datos EstAirbnb
-- ============================================================

-- ============================================================
-- 1. Columnas de Fidelidad en tabla Garajes
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Garajes') AND name = 'fidelidad_activo')
  ALTER TABLE Garajes ADD fidelidad_activo BIT NOT NULL DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Garajes') AND name = 'fidelidad_visitas')
  ALTER TABLE Garajes ADD fidelidad_visitas INT NOT NULL DEFAULT 10;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Garajes') AND name = 'fidelidad_descuento_pct')
  ALTER TABLE Garajes ADD fidelidad_descuento_pct INT NOT NULL DEFAULT 10;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Garajes') AND name = 'fidelidad_dias_validez')
  ALTER TABLE Garajes ADD fidelidad_dias_validez INT NULL; -- NULL = sin vencimiento

-- ============================================================
-- 2. Columnas de Overstay/Multa en tabla Reservas
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reservas') AND name = 'hora_entrada_real')
  ALTER TABLE Reservas ADD hora_entrada_real DATETIME NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reservas') AND name = 'hora_salida_real')
  ALTER TABLE Reservas ADD hora_salida_real DATETIME NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Reservas') AND name = 'multa_exceso')
  ALTER TABLE Reservas ADD multa_exceso DECIMAL(10,2) NOT NULL DEFAULT 0;

-- ============================================================
-- 3. Columna de nivel seguridad y método acceso en Garajes
--    (por si no existen ya)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Garajes') AND name = 'nivel_seguridad')
  ALTER TABLE Garajes ADD nivel_seguridad VARCHAR(20) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Garajes') AND name = 'metodo_acceso')
  ALTER TABLE Garajes ADD metodo_acceso VARCHAR(20) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Garajes') AND name = 'instrucciones_acceso')
  ALTER TABLE Garajes ADD instrucciones_acceso VARCHAR(500) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Garajes') AND name = 'politica_cancelacion')
  ALTER TABLE Garajes ADD politica_cancelacion VARCHAR(200) NULL;

PRINT '✅ patch_sprint2b.sql aplicado correctamente.'
GO
