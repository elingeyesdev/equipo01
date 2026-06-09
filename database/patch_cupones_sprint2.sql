-- ============================================================
-- EstAirbnb - Patch Cupones Sprint 2
-- Agrega: tipo de descuento (% o monto fijo) y flag primera reserva
-- ============================================================

PRINT '=== PATCH CUPONES SPRINT 2 ===';
GO

-- 1. Tipo de descuento: 'porcentaje' (default, compatible con datos existentes) o 'monto_fijo'
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Cupones') AND name = 'tipo_descuento')
BEGIN
    ALTER TABLE Cupones ADD tipo_descuento VARCHAR(15) NOT NULL DEFAULT 'porcentaje';
    PRINT '+ Columna tipo_descuento agregada a Cupones.';
END
ELSE
    PRINT 'i  Columna tipo_descuento ya existe.';
GO

-- 2. Monto fijo en Bolivianos (NULL si tipo = porcentaje)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Cupones') AND name = 'monto_fijo')
BEGIN
    ALTER TABLE Cupones ADD monto_fijo DECIMAL(10,2) NULL;
    PRINT '+ Columna monto_fijo agregada a Cupones.';
END
ELSE
    PRINT 'i  Columna monto_fijo ya existe.';
GO

-- 3. Solo aplica a la primera reserva del conductor
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Cupones') AND name = 'solo_primera_reserva')
BEGIN
    ALTER TABLE Cupones ADD solo_primera_reserva BIT NOT NULL DEFAULT 0;
    PRINT '+ Columna solo_primera_reserva agregada a Cupones.';
END
ELSE
    PRINT 'i  Columna solo_primera_reserva ya existe.';
GO

PRINT 'Patch completado: Cupones ahora soporta monto fijo y restriccion de primera reserva.';
GO
