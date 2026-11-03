/*
Módulo 2 - Rendimiento.

Otorga los privilegios mínimos de lectura requeridos por el módulo
en los dos perfiles soportados por DBA Monitor:

- XEPDB1  -> DBA_MONITOR
- CDB$ROOT -> C##DBA_MONITOR

Ejecutar como SYS AS SYSDBA.

Para usar CDB$ROOT debe haberse ejecutado previamente:
sql/oracle/connections/setup/create_cdb_monitor.sql
*/

WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE


-- =========================================================
-- 1. PDB XEPDB1
-- =========================================================

ALTER SESSION SET CONTAINER = XEPDB1;
SHOW CON_NAME

GRANT SELECT ON SYS.V_$SESSION  TO DBA_MONITOR;
GRANT SELECT ON SYS.V_$SQL      TO DBA_MONITOR;
GRANT SELECT ON SYS.V_$PROCESS  TO DBA_MONITOR;
GRANT SELECT ON SYS.V_$SESSTAT  TO DBA_MONITOR;
GRANT SELECT ON SYS.V_$STATNAME TO DBA_MONITOR;


-- =========================================================
-- 2. CDB$ROOT
-- =========================================================

ALTER SESSION SET CONTAINER = CDB$ROOT;
SHOW CON_NAME

GRANT SELECT ON SYS.V_$SESSION
TO C##DBA_MONITOR CONTAINER = CURRENT;

GRANT SELECT ON SYS.V_$SQL
TO C##DBA_MONITOR CONTAINER = CURRENT;

GRANT SELECT ON SYS.V_$PROCESS
TO C##DBA_MONITOR CONTAINER = CURRENT;

GRANT SELECT ON SYS.V_$SESSTAT
TO C##DBA_MONITOR CONTAINER = CURRENT;

GRANT SELECT ON SYS.V_$STATNAME
TO C##DBA_MONITOR CONTAINER = CURRENT;


-- =========================================================
-- 3. Verificación
-- =========================================================

ALTER SESSION SET CONTAINER = XEPDB1;

SELECT grantee, table_name, privilege
FROM dba_tab_privs
WHERE grantee = 'DBA_MONITOR'
AND table_name IN (
    'V_$SESSION',
    'V_$SQL',
    'V_$PROCESS',
    'V_$SESSTAT',
    'V_$STATNAME'
)
ORDER BY table_name;


ALTER SESSION SET CONTAINER = CDB$ROOT;

SELECT grantee, table_name, privilege
FROM dba_tab_privs
WHERE grantee = 'C##DBA_MONITOR'
AND table_name IN (
    'V_$SESSION',
    'V_$SQL',
    'V_$PROCESS',
    'V_$SESSTAT',
    'V_$STATNAME'
)
ORDER BY table_name;


WHENEVER SQLERROR CONTINUE
WHENEVER OSERROR CONTINUE