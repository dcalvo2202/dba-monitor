/*
================================================================================
 Archivo     : sql/oracle/audit/setup/demo_objects.sql
 Módulo      : 5 - Auditoría
 Propósito   : Crear en XEPDB1 un escenario de prueba REAL para demostrar el
               módulo de auditoría: un usuario con privilegios directos y
               heredados por roles anidados, y objetos PL/SQL inválidos con
               errores de compilación.
 Ejecutar    : Como SYS AS SYSDBA desde la raíz del proyecto.
                   sqlplus / as sysdba
                   @sql/oracle/audit/setup/demo_objects.sql
               Puede ejecutarse varias veces: el paso 1 elimina el escenario
               anterior antes de crearlo de nuevo.

 ¿Por qué es necesario?
   Una instalación limpia de Oracle XE no tiene objetos inválidos (DBA_OBJECTS
   y DBA_ERRORS están vacíos para status INVALID). Este script provoca las
   situaciones reales que el módulo debe detectar; no se simula ningún dato:
   todo lo que muestra la aplicación proviene del diccionario de Oracle.

 Escenario que se crea:
   AUDIT_DEMO_BASE_ROLE  --(otorgado a)-->  AUDIT_DEMO_ROLE  --(otorgado a)-->  AUDIT_DEMO
        CREATE TABLE                         CREATE PROCEDURE                  CREATE SESSION (directo)
                                             SELECT ANY TABLE  (riesgo)

   AUDIT_DEMO_BASE_ROLE también se otorga DIRECTAMENTE a AUDIT_DEMO: llega
   por dos caminos y el módulo debe mostrarlo una sola vez.

   AUDIT_DEMO_REPORT_ROLE (CREATE VIEW) se asigna como rol NO predeterminado:
   no se activa al iniciar sesión hasta ejecutar SET ROLE.

   AUDIT_DEMO.ACTUALIZAR_PRODUCTO  -> INVALID (depende de una tabla eliminada)
   AUDIT_DEMO.V_PRODUCTOS          -> INVALID (vista sobre la tabla eliminada)
   AUDIT_DEMO.CALCULAR_DESCUENTO   -> INVALID (error de sintaxis PL/SQL)
================================================================================
*/

-- 0) Detener el script ante un error inesperado. Las advertencias de
--    compilación ("Warning: ... compilation errors") no son errores de
--    SQL*Plus, por lo que no lo detienen.
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE

-- 1) Todo el escenario vive dentro de la PDB que monitorea la aplicación.
ALTER SESSION SET CONTAINER = XEPDB1;
SHOW CON_NAME

-- Limpieza previa: elimina el escenario si ya existía, para que el script
-- pueda ejecutarse más de una vez. Los errores "no existe" se ignoran.
BEGIN
    FOR stmt IN (
        SELECT 'DROP USER AUDIT_DEMO CASCADE' AS sql_text FROM dual
        UNION ALL SELECT 'DROP ROLE AUDIT_DEMO_ROLE'        FROM dual
        UNION ALL SELECT 'DROP ROLE AUDIT_DEMO_BASE_ROLE'   FROM dual
        UNION ALL SELECT 'DROP ROLE AUDIT_DEMO_REPORT_ROLE' FROM dual
    ) LOOP
        BEGIN
            EXECUTE IMMEDIATE stmt.sql_text;
        EXCEPTION
            -- ORA-01918: el usuario no existe; ORA-01919: el rol no existe.
            WHEN OTHERS THEN
                IF SQLCODE NOT IN (-1918, -1919) THEN
                    RAISE;
                END IF;
        END;
    END LOOP;
END;
/

-- 2) Usuario de prueba como "schema-only account" (Oracle 18c+).
--    NO AUTHENTICATION: el usuario no tiene contraseña y nadie puede iniciar
--    sesión con él. Es la práctica recomendada para esquemas que solo
--    almacenan objetos y evita guardar credenciales en el repositorio.
CREATE USER AUDIT_DEMO NO AUTHENTICATION
    DEFAULT TABLESPACE USERS
    QUOTA 5M ON USERS;

-- 3) Roles anidados: permiten demostrar privilegios heredados a través de
--    más de un nivel (usuario -> rol -> rol).
CREATE ROLE AUDIT_DEMO_BASE_ROLE;
CREATE ROLE AUDIT_DEMO_ROLE;
CREATE ROLE AUDIT_DEMO_REPORT_ROLE;

GRANT CREATE TABLE TO AUDIT_DEMO_BASE_ROLE;

GRANT CREATE PROCEDURE     TO AUDIT_DEMO_ROLE;
-- Privilegio "ANY" intencional: el módulo debe marcarlo como riesgo, porque
-- permite leer cualquier tabla de cualquier esquema.
GRANT SELECT ANY TABLE     TO AUDIT_DEMO_ROLE;
GRANT AUDIT_DEMO_BASE_ROLE TO AUDIT_DEMO_ROLE;

GRANT CREATE VIEW TO AUDIT_DEMO_REPORT_ROLE;

-- Privilegio directo (sin rol) y roles asignados al usuario.
GRANT CREATE SESSION         TO AUDIT_DEMO;
GRANT AUDIT_DEMO_ROLE        TO AUDIT_DEMO;
-- Segundo camino hacia AUDIT_DEMO_BASE_ROLE (ya llega por AUDIT_DEMO_ROLE).
GRANT AUDIT_DEMO_BASE_ROLE   TO AUDIT_DEMO;
GRANT AUDIT_DEMO_REPORT_ROLE TO AUDIT_DEMO;

-- Rol no predeterminado: se asigna, pero no se activa al iniciar sesión.
ALTER USER AUDIT_DEMO DEFAULT ROLE ALL EXCEPT AUDIT_DEMO_REPORT_ROLE;

-- Al crear un rol, Oracle se lo otorga a quien lo creó (aquí SYS) con
-- ADMIN OPTION. Se retira para no alterar los privilegios de SYS.
REVOKE AUDIT_DEMO_ROLE        FROM SYS;
REVOKE AUDIT_DEMO_BASE_ROLE   FROM SYS;
REVOKE AUDIT_DEMO_REPORT_ROLE FROM SYS;

-- 4) Tabla base y objetos que dependen de ella.
CREATE TABLE AUDIT_DEMO.PRODUCTOS (
    id      NUMBER        CONSTRAINT productos_pk PRIMARY KEY,
    nombre  VARCHAR2(100) NOT NULL,
    precio  NUMBER(10, 2) NOT NULL
);

CREATE OR REPLACE VIEW AUDIT_DEMO.V_PRODUCTOS AS
    SELECT id, nombre, precio
    FROM   AUDIT_DEMO.PRODUCTOS;

CREATE OR REPLACE PROCEDURE AUDIT_DEMO.ACTUALIZAR_PRODUCTO (
    p_id     IN NUMBER,
    p_precio IN NUMBER
) AS
BEGIN
    UPDATE AUDIT_DEMO.PRODUCTOS
    SET    precio = p_precio
    WHERE  id = p_id;
END;
/

-- 5) Se elimina la tabla: la vista y el procedimiento quedan INVALID porque
--    dependen de un objeto que ya no existe (dependencia rota).
DROP TABLE AUDIT_DEMO.PRODUCTOS PURGE;

-- Al intentar recompilar, Oracle registra el error en DBA_ERRORS
-- (PL/SQL: ORA-00942). SQL*Plus mostrará "Warning: ... compilation errors";
-- es el resultado esperado.
ALTER PROCEDURE AUDIT_DEMO.ACTUALIZAR_PRODUCTO COMPILE;

-- 6) Función con un error de código (falta el punto y coma tras RETURN):
--    se crea INVALID desde el inicio y su error queda en DBA_ERRORS.
CREATE OR REPLACE FUNCTION AUDIT_DEMO.CALCULAR_DESCUENTO (
    p_monto IN NUMBER
) RETURN NUMBER AS
BEGIN
    RETURN p_monto * 0.9
END;
/

-- 7) Verificación: deben aparecer 3 objetos INVALID y sus errores.
SELECT object_name, object_type, status
FROM   dba_objects
WHERE  owner = 'AUDIT_DEMO'
ORDER  BY object_name;

SELECT name, type, line, position, text
FROM   dba_errors
WHERE  owner = 'AUDIT_DEMO'
ORDER  BY name, sequence;

-- Restablece el comportamiento por defecto de SQL*Plus para la sesión.
WHENEVER SQLERROR CONTINUE
WHENEVER OSERROR CONTINUE

/*
--------------------------------------------------------------------------------
 Reversión (elimina todo el escenario de prueba):

   ALTER SESSION SET CONTAINER = XEPDB1;
   DROP USER AUDIT_DEMO CASCADE;   -- elimina el usuario y todos sus objetos
   DROP ROLE AUDIT_DEMO_ROLE;
   DROP ROLE AUDIT_DEMO_BASE_ROLE;
   DROP ROLE AUDIT_DEMO_REPORT_ROLE;

 Nota para el Módulo 6 (Mantenimiento): para corregir los objetos se puede
 recrear la tabla PRODUCTOS y recompilar con
   ALTER PROCEDURE AUDIT_DEMO.ACTUALIZAR_PRODUCTO COMPILE;
   ALTER VIEW AUDIT_DEMO.V_PRODUCTOS COMPILE;
 CALCULAR_DESCUENTO seguirá inválida hasta corregir su código fuente.
--------------------------------------------------------------------------------
*/
