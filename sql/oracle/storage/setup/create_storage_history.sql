/*
================================================================================
 Archivo     : sql/oracle/storage/setup/create_storage_history.sql
 Módulo      : 3 - Gestión del almacenamiento (crecimiento de la base de datos)
 Propósito   : Crear el mecanismo que registra y compara el crecimiento del
               almacenamiento: una tabla de mediciones, un procedimiento que
               toma una medición y una tarea diaria que lo ejecuta.
 Ejecutar    : Como SYS AS SYSDBA, desde la raíz del proyecto:
                   sqlplus / as sysdba @sql/oracle/storage/setup/create_storage_history.sql
               Ejecutar DESPUÉS de sql/oracle/storage/setup/grants.sql.

 Diseño de mínimo privilegio:
   - DBA_MONITOR_HIST es un esquema SIN contraseña (NO AUTHENTICATION):
     nadie puede iniciar sesión con él. Solo es dueño de los objetos del
     historial.
   - DBA_MONITOR (el usuario de la aplicación) NO puede crear tablas ni
     insertar filas: solo recibe
         EXECUTE sobre DBA_MONITOR_HIST.RECORD_STORAGE_SNAPSHOT
         SELECT  sobre DBA_MONITOR_HIST.STORAGE_SNAPSHOT
     Así la aplicación puede pedir una medición, pero no escribir datos
     inventados ni modificar el historial.
   - El procedimiento usa los derechos de su dueño (definer rights); por
     eso DBA_MONITOR_HIST recibe directamente SELECT sobre las dos vistas
     del diccionario que necesita.

 Registro automático:
   La tarea DBA_MONITOR_HIST.STORAGE_SNAPSHOT_DAILY (DBMS_SCHEDULER) toma
   una medición todos los días a las 00:00. Además, el botón "Registrar
   medición" de la página permite tomar una cuando se necesite.

 El script se puede ejecutar varias veces: elimina el esquema anterior (y
 con él el historial) antes de recrearlo.
================================================================================
*/

WHENEVER SQLERROR EXIT SQL.SQLCODE
WHENEVER OSERROR EXIT FAILURE

ALTER SESSION SET CONTAINER = XEPDB1;
SHOW CON_NAME

-- 1) Limpieza de una ejecución anterior.
BEGIN
    FOR existing IN (SELECT 1 FROM dba_users WHERE username = 'DBA_MONITOR_HIST') LOOP
        EXECUTE IMMEDIATE 'DROP USER DBA_MONITOR_HIST CASCADE';
    END LOOP;
END;
/

-- 2) Esquema dueño del historial. La cuota de 50 MB alcanza para años de
--    mediciones diarias (cada medición son unas pocas filas por tablespace).
CREATE USER DBA_MONITOR_HIST NO AUTHENTICATION
    DEFAULT TABLESPACE USERS
    QUOTA 50M ON USERS;

GRANT SELECT ON SYS.DBA_DATA_FILES TO DBA_MONITOR_HIST;
GRANT SELECT ON SYS.DBA_FREE_SPACE TO DBA_MONITOR_HIST;

-- 3) Tabla de mediciones. captured_at usa SYSDATE: Oracle la evalúa una
--    sola vez por sentencia, así todas las filas de una medición comparten
--    la misma fecha y se pueden agrupar por ella.
CREATE TABLE DBA_MONITOR_HIST.STORAGE_SNAPSHOT (
    snapshot_id      NUMBER GENERATED ALWAYS AS IDENTITY,
    captured_at      DATE DEFAULT SYSDATE NOT NULL,
    tablespace_name  VARCHAR2(128) NOT NULL,
    total_bytes      NUMBER NOT NULL,
    used_bytes       NUMBER NOT NULL,
    free_bytes       NUMBER NOT NULL,
    max_bytes        NUMBER NOT NULL,
    CONSTRAINT pk_storage_snapshot PRIMARY KEY (snapshot_id)
);

-- Las consultas buscan por fecha de medición.
CREATE INDEX DBA_MONITOR_HIST.IX_STORAGE_SNAPSHOT_DATE
    ON DBA_MONITOR_HIST.STORAGE_SNAPSHOT (captured_at, tablespace_name);

-- 4) Procedimiento que toma una medición de los tablespaces permanentes y
--    de undo. max_bytes considera la autoextensión: es el tamaño máximo al
--    que pueden crecer los datafiles (MAXBYTES, o el tamaño actual si no
--    son autoextensibles).
CREATE OR REPLACE PROCEDURE DBA_MONITOR_HIST.RECORD_STORAGE_SNAPSHOT
AUTHID DEFINER
AS
BEGIN
    INSERT INTO DBA_MONITOR_HIST.STORAGE_SNAPSHOT (
        tablespace_name, total_bytes, used_bytes, free_bytes, max_bytes
    )
    SELECT
        df.tablespace_name,
        df.total_bytes,
        df.total_bytes - NVL(fs.free_bytes, 0),
        NVL(fs.free_bytes, 0),
        df.max_bytes
    FROM (
        SELECT
            tablespace_name,
            SUM(bytes) AS total_bytes,
            SUM(GREATEST(bytes, maxbytes)) AS max_bytes
        FROM sys.dba_data_files
        GROUP BY tablespace_name
    ) df
    LEFT JOIN (
        SELECT tablespace_name, SUM(bytes) AS free_bytes
        FROM sys.dba_free_space
        GROUP BY tablespace_name
    ) fs
        ON fs.tablespace_name = df.tablespace_name;

    COMMIT;
END;
/

SHOW ERRORS PROCEDURE DBA_MONITOR_HIST.RECORD_STORAGE_SNAPSHOT

-- 5) Privilegios de la aplicación: ejecutar la medición y leer el historial.
GRANT EXECUTE ON DBA_MONITOR_HIST.RECORD_STORAGE_SNAPSHOT TO DBA_MONITOR;
GRANT SELECT  ON DBA_MONITOR_HIST.STORAGE_SNAPSHOT        TO DBA_MONITOR;

-- 6) Tarea diaria (00:00). Si la base está apagada a esa hora, el
--    planificador la ejecuta al volver a abrirse.
BEGIN
    DBMS_SCHEDULER.CREATE_JOB(
        job_name        => 'DBA_MONITOR_HIST.STORAGE_SNAPSHOT_DAILY',
        job_type        => 'STORED_PROCEDURE',
        job_action      => 'DBA_MONITOR_HIST.RECORD_STORAGE_SNAPSHOT',
        repeat_interval => 'FREQ=DAILY;BYHOUR=0;BYMINUTE=0;BYSECOND=0',
        enabled         => TRUE,
        comments        => 'DBA Monitor - Módulo 3: medición diaria del almacenamiento'
    );
END;
/

-- 7) Primera medición, para que el historial no empiece vacío.
EXEC DBA_MONITOR_HIST.RECORD_STORAGE_SNAPSHOT

-- 8) Verificación.
SELECT captured_at, COUNT(*) AS tablespaces
FROM   DBA_MONITOR_HIST.STORAGE_SNAPSHOT
GROUP  BY captured_at;

SELECT job_name, enabled, state, TO_CHAR(next_run_date, 'DD/MM/YYYY HH24:MI') AS next_run
FROM   dba_scheduler_jobs
WHERE  owner = 'DBA_MONITOR_HIST';

WHENEVER SQLERROR CONTINUE
WHENEVER OSERROR CONTINUE

/*
--------------------------------------------------------------------------------
 Reversión (elimina el historial, el procedimiento y la tarea diaria):

   ALTER SESSION SET CONTAINER = XEPDB1;
   DROP USER DBA_MONITOR_HIST CASCADE;
--------------------------------------------------------------------------------
*/
