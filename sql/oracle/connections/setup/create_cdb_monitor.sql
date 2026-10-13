/*
================================================================================
 Archivo     : sql/oracle/connections/setup/create_cdb_monitor.sql
 Módulo      : 1 - Estado general (perfiles de conexión) y base para el
               Módulo 4 - Respaldo y recuperación
 Propósito   : Crear el usuario común C##DBA_MONITOR para monitorear el
               contenedor raíz CDB$ROOT desde el perfil "cdb_root".
 Ejecutar    : Como SYS AS SYSDBA, desde la raíz del proyecto:
                   sqlplus / as sysdba
                   @sql/oracle/connections/setup/create_cdb_monitor.sql
               El script pide la contraseña (no se muestra al escribirla).
               Luego agregar al archivo .env:   DB_PASSWORD_CDB=<la contraseña>

 ¿Por qué un usuario común (C##)?
   Oracle XE es una base de datos multitenant: la raíz CDB$ROOT administra
   la instancia y contiene las PDB (como XEPDB1). DBA_MONITOR es un usuario
   LOCAL de XEPDB1 y no existe en la raíz. Para conectarse a CDB$ROOT se
   necesita un usuario COMÚN, cuyo nombre debe empezar por C##.
   Desde la raíz se ven datos de toda la instancia: todas las PDB en V$PDBS
   y, más adelante, los respaldos RMAN (Módulo 4).

 Mínimo privilegio:
   Los privilegios se otorgan con CONTAINER=CURRENT: solo valen en la raíz.
   El usuario no puede abrir sesión en las PDB ni modificar nada: únicamente
   consulta las mismas vistas que DBA_MONITOR usa en los Módulos 1 y 5.
================================================================================
*/

-- Detener el script ante el primer error.
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE

-- No mostrar en pantalla las sustituciones de variables (la contraseña).
SET VERIFY OFF

-- 1) Los usuarios comunes se crean desde la raíz.
ALTER SESSION SET CONTAINER = CDB$ROOT;
SHOW CON_NAME

-- 2) Pedir la contraseña sin guardarla en el archivo. HIDE oculta lo escrito.
ACCEPT cdb_monitor_password CHAR PROMPT 'Contraseña para C##DBA_MONITOR: ' HIDE

-- 3) Crear el usuario común, o solo actualizar su contraseña si ya existe
--    (permite volver a ejecutar el script sin errores).
DECLARE
    user_count NUMBER;
BEGIN
    SELECT COUNT(*)
    INTO   user_count
    FROM   dba_users
    WHERE  username = 'C##DBA_MONITOR';

    IF user_count = 0 THEN
        EXECUTE IMMEDIATE
            'CREATE USER C##DBA_MONITOR IDENTIFIED BY "&cdb_monitor_password" CONTAINER = ALL';
    ELSE
        EXECUTE IMMEDIATE
            'ALTER USER C##DBA_MONITOR IDENTIFIED BY "&cdb_monitor_password" CONTAINER = ALL';
    END IF;
END;
/

-- Se elimina la variable de la sesión de SQL*Plus.
UNDEFINE cdb_monitor_password

-- 4) Iniciar sesión, solo en la raíz.
GRANT CREATE SESSION TO C##DBA_MONITOR CONTAINER = CURRENT;

-- 5) Módulo 1 - Estado general (vistas dinámicas V$).
GRANT SELECT ON SYS.V_$INSTANCE TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.V_$SGA      TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.V_$SGASTAT  TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.V_$PGASTAT  TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.V_$PDBS     TO C##DBA_MONITOR CONTAINER = CURRENT;

-- 6) Módulo 5 - Auditoría (diccionario de datos de la raíz).
GRANT SELECT ON SYS.DBA_USERS      TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.DBA_ROLES      TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.DBA_ROLE_PRIVS TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.DBA_SYS_PRIVS  TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.DBA_TAB_PRIVS  TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.DBA_OBJECTS    TO C##DBA_MONITOR CONTAINER = CURRENT;
GRANT SELECT ON SYS.DBA_ERRORS     TO C##DBA_MONITOR CONTAINER = CURRENT;

-- 7) CONTAINER_DATA: en la raíz, las vistas V$ de un usuario común solo
--    muestran filas de los contenedores que el DBA autoriza explícitamente
--    (por defecto, solo CDB$ROOT). Sin esto, V$PDBS aparece vacía aunque
--    existan PDB. ALL autoriza ver los datos de todos los contenedores; es
--    solo visibilidad de lectura en las vistas que ya puede consultar.
ALTER USER C##DBA_MONITOR SET CONTAINER_DATA = ALL CONTAINER = CURRENT;

-- 8) Verificación: el usuario existe, es común y tiene sus privilegios.
SELECT username, common, account_status
FROM   dba_users
WHERE  username = 'C##DBA_MONITOR';

SELECT table_name, privilege
FROM   dba_tab_privs
WHERE  grantee = 'C##DBA_MONITOR'
ORDER  BY table_name;

-- Debe mostrar CONTAINER_NAME = ALL (DEFAULT_ATTR = 'Y').
SELECT username, default_attr, owner, object_name, container_name
FROM   cdb_container_data
WHERE  username = 'C##DBA_MONITOR';

-- Restablece el comportamiento por defecto de SQL*Plus para la sesión.
SET VERIFY ON
WHENEVER SQLERROR CONTINUE
WHENEVER OSERROR CONTINUE

/*
--------------------------------------------------------------------------------
 Reversión (elimina el usuario común y sus privilegios):

   ALTER SESSION SET CONTAINER = CDB$ROOT;
   DROP USER C##DBA_MONITOR CASCADE;
--------------------------------------------------------------------------------
*/
