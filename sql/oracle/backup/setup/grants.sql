/*
================================================================================
 Archivo     : sql/oracle/backup/setup/grants.sql
 Módulo      : 4 - Respaldo y recuperación
 Propósito   : Otorgar a los usuarios de monitoreo los privilegios mínimos
               para leer el historial de respaldos RMAN y la configuración
               de recuperación de la base de datos.
 Ejecutar    : Como SYS AS SYSDBA, desde la raíz del proyecto:
                   sqlplus / as sysdba
                   @sql/oracle/backup/setup/grants.sql
 Requisitos  : Haber ejecutado antes
                   sql/oracle/connections/setup/create_cdb_monitor.sql
               (crea el usuario común C##DBA_MONITOR).

 ¿Por qué en los dos contenedores?
   Los respaldos RMAN son de nivel CDB: se registran en el archivo de
   control, que es único para toda la instancia. Por eso la fuente
   principal del módulo es la raíz CDB$ROOT (perfil "cdb_root",
   usuario C##DBA_MONITOR). También se otorgan a DBA_MONITOR en XEPDB1
   para que el módulo pueda consultarse con el perfil por defecto.

 Mínimo privilegio:
   Solo SELECT sobre cuatro vistas dinámicas, sin privilegios de sistema.
   El usuario de monitoreo puede VER los respaldos, pero no ejecutarlos,
   borrarlos ni cambiar la configuración de RMAN.

   V_$RMAN_BACKUP_JOB_DETAILS  Un registro por trabajo RMAN: tipo, estado,
                               inicio, fin, tamaño y duración.
   V_$BACKUP_SET_DETAILS       Conjuntos de respaldo; aporta el nivel
                               incremental (0 o 1) de cada trabajo.
   V_$DATABASE                 Modo de archivado (ARCHIVELOG/NOARCHIVELOG).
   V_$RECOVERY_FILE_DEST       Ubicación, límite y uso de la Fast Recovery
                               Area (FRA), donde RMAN guarda los respaldos.
================================================================================
*/

-- Detener el script ante el primer error.
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE

-- 1) Raíz CDB$ROOT: usuario común C##DBA_MONITOR (fuente principal).
--    CONTAINER = CURRENT limita el privilegio a la raíz.
ALTER SESSION SET CONTAINER = CDB$ROOT;
SHOW CON_NAME

GRANT SELECT ON SYS.V_$RMAN_BACKUP_JOB_DETAILS TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.V_$BACKUP_SET_DETAILS      TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.V_$DATABASE                TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.V_$RECOVERY_FILE_DEST      TO C##DBA_MONITOR CONTAINER = CURRENT;

-- 2) PDB XEPDB1: usuario local DBA_MONITOR (perfil por defecto).
ALTER SESSION SET CONTAINER = XEPDB1;
SHOW CON_NAME

GRANT SELECT ON SYS.V_$RMAN_BACKUP_JOB_DETAILS TO DBA_MONITOR;
GRANT SELECT ON SYS.V_$BACKUP_SET_DETAILS      TO DBA_MONITOR;
GRANT SELECT ON SYS.V_$DATABASE                TO DBA_MONITOR;
GRANT SELECT ON SYS.V_$RECOVERY_FILE_DEST      TO DBA_MONITOR;

-- 3) Verificación: deben aparecer las cuatro vistas para cada usuario.
SELECT grantee, table_name, privilege
FROM   dba_tab_privs
WHERE  grantee = 'DBA_MONITOR'
AND    table_name IN (
           'V_$RMAN_BACKUP_JOB_DETAILS',
           'V_$BACKUP_SET_DETAILS',
           'V_$DATABASE',
           'V_$RECOVERY_FILE_DEST'
       )
ORDER  BY table_name;

ALTER SESSION SET CONTAINER = CDB$ROOT;

SELECT grantee, table_name, privilege
FROM   dba_tab_privs
WHERE  grantee = 'C##DBA_MONITOR'
AND    table_name IN (
           'V_$RMAN_BACKUP_JOB_DETAILS',
           'V_$BACKUP_SET_DETAILS',
           'V_$DATABASE',
           'V_$RECOVERY_FILE_DEST'
       )
ORDER  BY table_name;

-- Restablece el comportamiento por defecto de SQL*Plus para la sesión.
WHENEVER SQLERROR CONTINUE
WHENEVER OSERROR CONTINUE

/*
--------------------------------------------------------------------------------
 Reversión (quita los privilegios del módulo):

   ALTER SESSION SET CONTAINER = CDB$ROOT;
   REVOKE SELECT ON SYS.V_$RMAN_BACKUP_JOB_DETAILS FROM C##DBA_MONITOR CONTAINER = CURRENT;
   REVOKE SELECT ON SYS.V_$BACKUP_SET_DETAILS      FROM C##DBA_MONITOR CONTAINER = CURRENT;
   REVOKE SELECT ON SYS.V_$DATABASE                FROM C##DBA_MONITOR CONTAINER = CURRENT;
   REVOKE SELECT ON SYS.V_$RECOVERY_FILE_DEST      FROM C##DBA_MONITOR CONTAINER = CURRENT;

   ALTER SESSION SET CONTAINER = XEPDB1;
   REVOKE SELECT ON SYS.V_$RMAN_BACKUP_JOB_DETAILS FROM DBA_MONITOR;
   REVOKE SELECT ON SYS.V_$BACKUP_SET_DETAILS      FROM DBA_MONITOR;
   REVOKE SELECT ON SYS.V_$DATABASE                FROM DBA_MONITOR;
   REVOKE SELECT ON SYS.V_$RECOVERY_FILE_DEST      FROM DBA_MONITOR;
--------------------------------------------------------------------------------
*/
