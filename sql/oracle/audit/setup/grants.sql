/*
================================================================================
 Archivo     : sql/oracle/audit/setup/grants.sql
 Módulo      : 5 - Auditoría
 Propósito   : Otorgar a DBA_MONITOR los privilegios mínimos de solo lectura
               que necesita el módulo de auditoría.
 Ejecutar    : Como SYS AS SYSDBA (SQL*Plus o SQL Developer).
                   sqlplus / as sysdba
                   @sql/oracle/audit/setup/grants.sql

 Principio de mínimo privilegio:
   Se otorga SELECT únicamente sobre las vistas del diccionario que el módulo
   consulta. NO se usa GRANT DBA, SELECT ANY DICTIONARY ni SELECT_CATALOG_ROLE,
   porque darían acceso a mucho más de lo necesario.

 Vista del diccionario -> funcionalidad que la usa:
   DBA_USERS       Usuarios registrados (estado de cuenta, fechas, perfil).
   DBA_ROLES       Roles disponibles en la base de datos.
   DBA_ROLE_PRIVS  Roles asignados a usuarios y a otros roles.
   DBA_SYS_PRIVS   Privilegios de sistema (CREATE TABLE, SELECT ANY TABLE...).
   DBA_TAB_PRIVS   Privilegios sobre objetos (SELECT, INSERT... sobre tablas).
   DBA_OBJECTS     Detección de objetos con estado INVALID.
   DBA_ERRORS      Errores de compilación de los objetos inválidos.
================================================================================
*/

-- 1) Las vistas DBA_* de la PDB solo muestran sus propios usuarios y objetos,
--    por eso los privilegios se otorgan dentro de XEPDB1 y no en CDB$ROOT.
ALTER SESSION SET CONTAINER = XEPDB1;

-- Verificación: debe mostrar XEPDB1 antes de continuar.
SHOW CON_NAME

-- 2) Privilegios de lectura sobre el diccionario de datos.
GRANT SELECT ON SYS.DBA_USERS      TO DBA_MONITOR;
GRANT SELECT ON SYS.DBA_ROLES      TO DBA_MONITOR;
GRANT SELECT ON SYS.DBA_ROLE_PRIVS TO DBA_MONITOR;
GRANT SELECT ON SYS.DBA_SYS_PRIVS  TO DBA_MONITOR;
GRANT SELECT ON SYS.DBA_TAB_PRIVS  TO DBA_MONITOR;
GRANT SELECT ON SYS.DBA_OBJECTS    TO DBA_MONITOR;
GRANT SELECT ON SYS.DBA_ERRORS     TO DBA_MONITOR;

-- 3) Verificación: lista los privilegios de objeto que DBA_MONITOR tiene
--    sobre vistas DBA_*. Deben aparecer las 7 vistas anteriores.
SELECT table_name, privilege
FROM   dba_tab_privs
WHERE  grantee = 'DBA_MONITOR'
AND    table_name LIKE 'DBA\_%' ESCAPE '\'
ORDER  BY table_name;

/*
--------------------------------------------------------------------------------
 Reversión (solo si se desea retirar los privilegios del módulo):

   ALTER SESSION SET CONTAINER = XEPDB1;
   REVOKE SELECT ON SYS.DBA_USERS      FROM DBA_MONITOR;
   REVOKE SELECT ON SYS.DBA_ROLES      FROM DBA_MONITOR;
   REVOKE SELECT ON SYS.DBA_ROLE_PRIVS FROM DBA_MONITOR;
   REVOKE SELECT ON SYS.DBA_SYS_PRIVS  FROM DBA_MONITOR;
   REVOKE SELECT ON SYS.DBA_TAB_PRIVS  FROM DBA_MONITOR;
   REVOKE SELECT ON SYS.DBA_OBJECTS    FROM DBA_MONITOR;
   REVOKE SELECT ON SYS.DBA_ERRORS     FROM DBA_MONITOR;
--------------------------------------------------------------------------------
*/
