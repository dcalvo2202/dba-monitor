/*
================================================================================
 Archivo     : sql/oracle/backup/setup/enable_archivelog.sql
 Módulo      : 4 - Respaldo y recuperación
 Propósito   : Activar el modo ARCHIVELOG en la base de datos local para
               poder hacer respaldos en caliente (con la base abierta) y
               respaldar los archived redo logs.
 Ejecutar    : Como SYS AS SYSDBA, desde la raíz del proyecto:
                   sqlplus / as sysdba
                   @sql/oracle/backup/setup/enable_archivelog.sql

 ATENCIÓN: el script REINICIA la instancia (SHUTDOWN IMMEDIATE). Cerrar
 antes la aplicación y cualquier otra sesión abierta contra Oracle.

 ¿Qué es ARCHIVELOG y por qué importa?
   Oracle anota cada cambio en los redo logs, que se reutilizan en círculo.
   - NOARCHIVELOG: un redo log se sobrescribe al reutilizarse. Solo se puede
     recuperar hasta el último respaldo completo; lo hecho después se pierde.
     Además, RMAN solo puede respaldar con la base cerrada (MOUNT).
   - ARCHIVELOG: antes de reutilizar un redo log, Oracle guarda una copia
     (archived log). Con el último respaldo + los archived logs se puede
     recuperar hasta el último cambio confirmado o hasta un punto en el
     tiempo. Es el modo recomendado para cualquier base de producción.
   El cambio de modo solo se permite con la base en estado MOUNT.

 Costo: los archived logs ocupan disco en la Fast Recovery Area (FRA). Si la
 FRA se llena, la base se detiene hasta liberar espacio; por eso el Módulo 4
 vigila su porcentaje de uso.
================================================================================
*/

-- 1) Comprobaciones previas: si algo falla aquí, el script se detiene
--    ANTES de bajar la instancia.
WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE

SHOW CON_NAME

-- Si ya está en ARCHIVELOG no hace falta reiniciar nada.
BEGIN
    FOR db IN (SELECT log_mode FROM v$database) LOOP
        IF db.log_mode = 'ARCHIVELOG' THEN
            RAISE_APPLICATION_ERROR(
                -20001,
                'La base de datos ya está en modo ARCHIVELOG. No se hizo ningún cambio.'
            );
        END IF;
    END LOOP;
END;
/

SHOW PARAMETER db_recovery_file_dest
ARCHIVE LOG LIST

-- Fast Recovery Area (FRA): carpeta donde Oracle guarda los archived logs y
-- RMAN los respaldos, con un límite de espacio que Oracle administra. Algunas
-- instalaciones de XE la dejan sin configurar (db_recovery_file_dest vacío);
-- entonces los archived logs irían a la carpeta interna de Oracle Home sin
-- ningún control de espacio. Si ya existe una FRA, este paso no la cambia.
ACCEPT fra_dir CHAR DEFAULT 'C:\app\fast_recovery_area' PROMPT 'Carpeta para la FRA [C:\app\fast_recovery_area]: '

-- Oracle no crea la carpeta. Si ya existe, mkdir solo muestra un aviso.
HOST mkdir "&fra_dir"

BEGIN
    FOR fra IN (
        SELECT value
        FROM   v$parameter
        WHERE  name = 'db_recovery_file_dest'
    ) LOOP
        IF fra.value IS NULL THEN
            -- El tamaño se define antes que la ruta: Oracle no acepta un
            -- destino sin límite. 10 GB alcanza para los respaldos de prueba.
            -- La FRA no cuenta para el límite de 12 GB de datos de Oracle XE.
            EXECUTE IMMEDIATE
                'ALTER SYSTEM SET db_recovery_file_dest_size = 10G SCOPE = BOTH';
            EXECUTE IMMEDIATE
                'ALTER SYSTEM SET db_recovery_file_dest = ''&fra_dir'' SCOPE = BOTH';
        END IF;
    END LOOP;
END;
/

SHOW PARAMETER db_recovery_file_dest

-- 2) A partir de aquí un error NO debe detener el script: si fallara el
--    cambio de modo, la base igual debe volver a abrirse.
WHENEVER SQLERROR CONTINUE

SHUTDOWN IMMEDIATE
STARTUP MOUNT
ALTER DATABASE ARCHIVELOG;
ALTER DATABASE OPEN;

-- Abre las PDB (XEPDB1) por si no tienen el estado de apertura guardado.
ALTER PLUGGABLE DATABASE ALL OPEN;

-- 3) Verificación: "Database log mode" debe decir "Archive Mode", "Archive
--    destination" USE_DB_RECOVERY_FILE_DEST y XEPDB1 debe estar en READ WRITE.
ARCHIVE LOG LIST
SELECT log_mode FROM v$database;
SELECT name, open_mode FROM v$pdbs;

WHENEVER OSERROR CONTINUE

/*
--------------------------------------------------------------------------------
 Reversión (volver a NOARCHIVELOG; también reinicia la instancia):

   SHUTDOWN IMMEDIATE
   STARTUP MOUNT
   ALTER DATABASE NOARCHIVELOG;
   ALTER DATABASE OPEN;
   ALTER PLUGGABLE DATABASE ALL OPEN;
--------------------------------------------------------------------------------
*/
