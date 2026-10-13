/*
================================================================================
 Propósito    : Historial de trabajos de respaldo RMAN, del más reciente al
                más antiguo.
 Módulo       : 4 - Respaldo y recuperación
 Vistas       : V$RMAN_BACKUP_JOB_DETAILS (un registro por sesión RMAN que
                hizo un respaldo), V$BACKUP_SET_DETAILS (nivel incremental).
 Privilegios  : SELECT ON SYS.V_$RMAN_BACKUP_JOB_DETAILS
                SELECT ON SYS.V_$BACKUP_SET_DETAILS
 Parámetros   : :max_rows  Cantidad máxima de trabajos a devolver.
 Columnas     : session_key, input_type, status, start_time, end_time,
                elapsed_seconds, input_bytes, output_bytes,
                compression_ratio, output_device_type, incremental_level,
                total_rows
 Notas        :
   - input_type indica QUÉ se respaldó: 'DB FULL' (base completa),
     'DB INCR' (incremental), 'ARCHIVELOG', 'DATAFILE FULL',
     'DATAFILE INCR', 'CONTROLFILE', 'SPFILE', 'RECVR AREA', 'BACKUPSET'.
   - status: 'COMPLETED', 'COMPLETED WITH WARNINGS', 'COMPLETED WITH
     ERRORS', 'FAILED', 'RUNNING', 'RUNNING WITH WARNINGS', 'RUNNING WITH
     ERRORS'.
   - La información sale del archivo de control: Oracle conserva los
     registros según CONTROL_FILE_RECORD_KEEP_TIME (7 días por defecto).
   - total_rows (COUNT(*) OVER ()) se calcula ANTES de FETCH FIRST, así la
     interfaz sabe si el historial se recortó.
================================================================================
*/
SELECT
    j.session_key,
    j.input_type,
    j.status,
    j.start_time,
    j.end_time,
    j.elapsed_seconds,
    j.input_bytes,
    j.output_bytes,
    j.compression_ratio,
    j.output_device_type,

    -- Nivel incremental (0 o 1) de los conjuntos de respaldo de la misma
    -- sesión RMAN. NULL en respaldos que no son incrementales.
    (
        SELECT MAX(s.incremental_level)
        FROM   v$backup_set_details s
        WHERE  s.session_key   = j.session_key
        AND    s.session_recid = j.session_recid
        AND    s.session_stamp = j.session_stamp
    ) AS incremental_level,

    COUNT(*) OVER () AS total_rows
FROM v$rman_backup_job_details j
ORDER BY j.start_time DESC
FETCH FIRST :max_rows ROWS ONLY
