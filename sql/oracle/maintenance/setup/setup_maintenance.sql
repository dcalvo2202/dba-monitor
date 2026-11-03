/*
===============================================================================
 Módulo 6 - Mantenimiento Preventivo
 Crea un escenario real y controlado para demostrar:
 - estadísticas de tablas;
 - actualización mediante DBMS_STATS;
 - objetos inválidos;
 - recompilación.

 DBA_MONITOR no recibe privilegios ANY.
 Solo puede consultar información concreta y ejecutar una API controlada.
===============================================================================
*/

WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE

ALTER SESSION SET CONTAINER = XEPDB1;
SHOW CON_NAME


-- =========================================================
-- 1. Recrear esquema de demostración
-- =========================================================

BEGIN
    FOR existing IN (
        SELECT 1
        FROM dba_users
        WHERE username = 'MAINT_DEMO'
    ) LOOP
        EXECUTE IMMEDIATE 'DROP USER MAINT_DEMO CASCADE';
    END LOOP;
END;
/

CREATE USER MAINT_DEMO NO AUTHENTICATION
    DEFAULT TABLESPACE USERS
    QUOTA 20M ON USERS;


-- =========================================================
-- 2. Tabla real para mantenimiento de estadísticas
-- =========================================================

CREATE TABLE MAINT_DEMO.CLIENTES (
    id      NUMBER PRIMARY KEY,
    nombre  VARCHAR2(100) NOT NULL,
    estado  VARCHAR2(20) NOT NULL
);

INSERT INTO MAINT_DEMO.CLIENTES
SELECT
    LEVEL,
    'Cliente ' || LEVEL,
    CASE
        WHEN MOD(LEVEL, 2) = 0 THEN 'ACTIVO'
        ELSE 'INACTIVO'
    END
FROM dual
CONNECT BY LEVEL <= 100;

COMMIT;


-- =========================================================
-- 3. Objeto inválido reparable por recompilación
-- =========================================================

CREATE TABLE MAINT_DEMO.CONFIGURACION (
    id     NUMBER PRIMARY KEY,
    valor  VARCHAR2(100)
);

CREATE OR REPLACE PROCEDURE MAINT_DEMO.LEER_CONFIGURACION
AS
    v_valor VARCHAR2(100);
BEGIN
    SELECT valor
    INTO v_valor
    FROM MAINT_DEMO.CONFIGURACION
    WHERE id = 1;
END;
/

-- Romper deliberadamente la dependencia.
DROP TABLE MAINT_DEMO.CONFIGURACION PURGE;

-- Esto deja el procedimiento INVALID y genera errores reales
-- de compilación en DBA_ERRORS.
ALTER PROCEDURE MAINT_DEMO.LEER_CONFIGURACION COMPILE;

-- Restauramos la dependencia, pero NO recompilamos el procedimiento.
-- Así el objeto sigue INVALID hasta que el DBA use el Módulo 6.
CREATE TABLE MAINT_DEMO.CONFIGURACION (
    id     NUMBER PRIMARY KEY,
    valor  VARCHAR2(100)
);

INSERT INTO MAINT_DEMO.CONFIGURACION (
    id,
    valor
)
VALUES (
    1,
    'Configuración de prueba'
);

COMMIT;

-- =========================================================
-- 4. API controlada de mantenimiento
-- =========================================================

CREATE OR REPLACE PACKAGE MAINT_DEMO.MAINTENANCE_API
AUTHID DEFINER
AS
    PROCEDURE gather_table_stats(
        p_table_name IN VARCHAR2
    );

    PROCEDURE recompile_object(
        p_object_name IN VARCHAR2,
        p_object_type IN VARCHAR2
    );
END MAINTENANCE_API;
/

CREATE OR REPLACE PACKAGE BODY MAINT_DEMO.MAINTENANCE_API
AS

    PROCEDURE gather_table_stats(
        p_table_name IN VARCHAR2
    )
    AS
        v_table_name VARCHAR2(128);
        v_count      NUMBER;
    BEGIN
        v_table_name :=
            DBMS_ASSERT.SIMPLE_SQL_NAME(
                UPPER(p_table_name)
            );

        SELECT COUNT(*)
        INTO v_count
        FROM user_tables
        WHERE table_name = v_table_name;

        IF v_count = 0 THEN
            RAISE_APPLICATION_ERROR(
                -20001,
                'La tabla indicada no pertenece a MAINT_DEMO.'
            );
        END IF;

        DBMS_STATS.GATHER_TABLE_STATS(
            ownname => 'MAINT_DEMO',
            tabname => v_table_name,
            cascade => TRUE
        );
    END gather_table_stats;


    PROCEDURE recompile_object(
        p_object_name IN VARCHAR2,
        p_object_type IN VARCHAR2
    )
    AS
        v_name VARCHAR2(128);
        v_type VARCHAR2(30);
        v_sql  VARCHAR2(1000);
    BEGIN
        v_name :=
            DBMS_ASSERT.SIMPLE_SQL_NAME(
                UPPER(p_object_name)
            );

        v_type := UPPER(TRIM(p_object_type));

        IF v_type = 'PROCEDURE' THEN
            v_sql :=
                'ALTER PROCEDURE MAINT_DEMO.'
                || v_name
                || ' COMPILE';

        ELSIF v_type = 'FUNCTION' THEN
            v_sql :=
                'ALTER FUNCTION MAINT_DEMO.'
                || v_name
                || ' COMPILE';

        ELSIF v_type = 'VIEW' THEN
            v_sql :=
                'ALTER VIEW MAINT_DEMO.'
                || v_name
                || ' COMPILE';

        ELSIF v_type = 'PACKAGE' THEN
            v_sql :=
                'ALTER PACKAGE MAINT_DEMO.'
                || v_name
                || ' COMPILE';

        ELSIF v_type = 'PACKAGE BODY' THEN
            v_sql :=
                'ALTER PACKAGE MAINT_DEMO.'
                || v_name
                || ' COMPILE BODY';

        ELSIF v_type = 'TRIGGER' THEN
            v_sql :=
                'ALTER TRIGGER MAINT_DEMO.'
                || v_name
                || ' COMPILE';

        ELSE
            RAISE_APPLICATION_ERROR(
                -20002,
                'Tipo de objeto no permitido.'
            );
        END IF;

        EXECUTE IMMEDIATE v_sql;
    END recompile_object;

END MAINTENANCE_API;
/


-- =========================================================
-- 5. Mínimo privilegio para DBA_MONITOR
-- =========================================================

GRANT SELECT ON SYS.DBA_TAB_STATISTICS TO DBA_MONITOR;
GRANT SELECT ON SYS.DBA_OBJECTS        TO DBA_MONITOR;
GRANT SELECT ON SYS.DBA_ERRORS         TO DBA_MONITOR;

GRANT EXECUTE
ON MAINT_DEMO.MAINTENANCE_API
TO DBA_MONITOR;


-- =========================================================
-- 6. Verificación
-- =========================================================

SELECT owner, table_name, last_analyzed, stale_stats
FROM dba_tab_statistics
WHERE owner = 'MAINT_DEMO'
AND object_type = 'TABLE'
AND partition_name IS NULL;

SELECT owner, object_name, object_type, status
FROM dba_objects
WHERE owner = 'MAINT_DEMO'
AND status = 'INVALID';

SELECT owner, name, type, line, position, text
FROM dba_errors
WHERE owner = 'MAINT_DEMO'
ORDER BY name, sequence;


WHENEVER SQLERROR CONTINUE
WHENEVER OSERROR CONTINUE