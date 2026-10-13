/*
================================================================================
 Propósito    : Último respaldo EXITOSO de cada categoría (base de datos y
                archived logs), sin importar cuántos trabajos haya después.
 Módulo       : 4 - Respaldo y recuperación
 Vistas       : V$RMAN_BACKUP_JOB_DETAILS, V$BACKUP_SET_DETAILS
 Privilegios  : SELECT ON SYS.V_$RMAN_BACKUP_JOB_DETAILS
                SELECT ON SYS.V_$BACKUP_SET_DETAILS
 Columnas     : category ('BASE_DATOS' | 'ARCHIVELOG'), session_key,
                input_type, status, start_time, end_time, elapsed_seconds,
                output_bytes, incremental_level
 Notas        :
   - Es una consulta aparte del historial porque el historial se limita a
     los N trabajos más recientes: el último respaldo exitoso de la base
     podría ser más antiguo que todos ellos.
   - 'COMPLETED WITH WARNINGS' cuenta como exitoso: el respaldo se generó y
     es utilizable (por ejemplo, un archived log ya borrado se omitió).
   - Solo cuentan como respaldo de la base los de toda la base ('DB FULL',
     'DB INCR'). Un respaldo de un solo datafile no permite restaurarla.
================================================================================
*/
SELECT
    category,
    session_key,
    input_type,
    status,
    start_time,
    end_time,
    elapsed_seconds,
    output_bytes,
    incremental_level
FROM (
    SELECT
        CASE
            WHEN j.input_type IN ('DB FULL', 'DB INCR') THEN 'BASE_DATOS'
            ELSE 'ARCHIVELOG'
        END AS category,
        j.session_key,
        j.input_type,
        j.status,
        j.start_time,
        j.end_time,
        j.elapsed_seconds,
        j.output_bytes,
        (
            SELECT MAX(s.incremental_level)
            FROM   v$backup_set_details s
            WHERE  s.session_key   = j.session_key
            AND    s.session_recid = j.session_recid
            AND    s.session_stamp = j.session_stamp
        ) AS incremental_level,

        -- Numera los trabajos de cada categoría del más reciente al más
        -- antiguo; el 1 es el último exitoso.
        ROW_NUMBER() OVER (
            PARTITION BY CASE
                WHEN j.input_type IN ('DB FULL', 'DB INCR') THEN 'BASE_DATOS'
                ELSE 'ARCHIVELOG'
            END
            ORDER BY j.end_time DESC
        ) AS position
    FROM v$rman_backup_job_details j
    WHERE j.status IN ('COMPLETED', 'COMPLETED WITH WARNINGS')
    AND   j.input_type IN ('DB FULL', 'DB INCR', 'ARCHIVELOG')
)
WHERE position = 1
