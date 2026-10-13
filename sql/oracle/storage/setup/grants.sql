/*
================================================================================
 Archivo     : sql/oracle/storage/setup/grants.sql
 Módulo      : 3 - Gestión del almacenamiento
 Propósito   : Otorgar a los usuarios de monitoreo los privilegios mínimos
               para consultar tablespaces, archivos de datos y segmentos.
 Ejecutar    : Como SYS AS SYSDBA, desde la raíz del proyecto:
                   sqlplus / as sysdba @sql/oracle/storage/setup/grants.sql
               Después, para el historial de crecimiento:
                   sqlplus / as sysdba @sql/oracle/storage/setup/create_storage_history.sql

 Mínimo privilegio:
   Solo SELECT sobre seis vistas del diccionario, sin privilegios de
   sistema (ni CREATE TABLE ni cuota en ningún tablespace).

   DBA_TABLESPACES      Tipo de cada tablespace (PERMANENT, UNDO, TEMPORARY).
   DBA_DATA_FILES       Archivos de datos: tamaño, máximo y autoextensión.
   DBA_FREE_SPACE       Espacio libre dentro de los archivos de datos.
   DBA_TEMP_FILES       Archivos temporales (tempfiles).
   DBA_TEMP_FREE_SPACE  Espacio libre de los tablespaces temporales.
   DBA_SEGMENTS         Tablas, índices y LOBs con el espacio que ocupan.

 Contenedores:
   - DBA_MONITOR en XEPDB1: ve el almacenamiento de la base de datos de la
     aplicación (perfil por defecto).
   - C##DBA_MONITOR en CDB$ROOT (CONTAINER = CURRENT): ve el almacenamiento
     de la raíz (SYSTEM, SYSAUX, UNDO de la CDB). Requiere haber ejecutado
     sql/oracle/connections/setup/create_cdb_monitor.sql.
================================================================================
*/

WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE

-- 1) PDB XEPDB1: usuario local DBA_MONITOR.
ALTER SESSION SET CONTAINER = XEPDB1;
SHOW CON_NAME

GRANT SELECT ON SYS.DBA_TABLESPACES     TO DBA_MONITOR;
GRANT SELECT ON SYS.DBA_DATA_FILES      TO DBA_MONITOR;
GRANT SELECT ON SYS.DBA_FREE_SPACE      TO DBA_MONITOR;
GRANT SELECT ON SYS.DBA_TEMP_FILES      TO DBA_MONITOR;
GRANT SELECT ON SYS.DBA_TEMP_FREE_SPACE TO DBA_MONITOR;
GRANT SELECT ON SYS.DBA_SEGMENTS        TO DBA_MONITOR;

-- 2) Raíz CDB$ROOT: usuario común C##DBA_MONITOR.
ALTER SESSION SET CONTAINER = CDB$ROOT;
SHOW CON_NAME

GRANT SELECT ON SYS.DBA_TABLESPACES     TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.DBA_DATA_FILES      TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.DBA_FREE_SPACE      TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.DBA_TEMP_FILES      TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.DBA_TEMP_FREE_SPACE TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.DBA_SEGMENTS        TO C##DBA_MONITOR CONTAINER = CURRENT;

-- 3) Verificación: seis vistas para cada usuario.
SELECT grantee, COUNT(*) AS vistas
FROM   cdb_tab_privs
WHERE  grantee IN ('DBA_MONITOR', 'C##DBA_MONITOR')
AND    table_name IN (
           'DBA_TABLESPACES', 'DBA_DATA_FILES', 'DBA_FREE_SPACE',
           'DBA_TEMP_FILES', 'DBA_TEMP_FREE_SPACE', 'DBA_SEGMENTS'
       )
GROUP  BY grantee;

WHENEVER SQLERROR CONTINUE
WHENEVER OSERROR CONTINUE

/*
--------------------------------------------------------------------------------
 Reversión: REVOKE SELECT ON SYS.<vista> FROM DBA_MONITOR; en XEPDB1, y
 REVOKE SELECT ON SYS.<vista> FROM C##DBA_MONITOR CONTAINER = CURRENT; en
 CDB$ROOT, para cada una de las seis vistas.
--------------------------------------------------------------------------------
*/
