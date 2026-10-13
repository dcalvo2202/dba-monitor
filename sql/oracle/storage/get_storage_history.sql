/*
================================================================================
 Propósito    : Mediciones históricas del almacenamiento por tablespace, para
                calcular y comparar el crecimiento de la base de datos.
 Módulo       : 3 - Gestión del almacenamiento
 Tablas       : DBA_MONITOR_HIST.STORAGE_SNAPSHOT
                (creada por setup/create_storage_history.sql)
 Privilegios  : SELECT ON DBA_MONITOR_HIST.STORAGE_SNAPSHOT
 Parámetros   : :days  Antigüedad máxima de las mediciones, en días.
 Columnas     : captured_at, tablespace_name, total_bytes, used_bytes,
                free_bytes, max_bytes
 Notas        :
   - Todas las filas de una misma medición comparten captured_at (el
     procedimiento inserta todos los tablespaces en una sola sentencia).
   - El historial existe solo en XEPDB1. Desde CDB$ROOT la tabla no existe
     (ORA-00942) y el servicio lo informa sin afectar el resto del módulo.
================================================================================
*/
SELECT
    captured_at,
    tablespace_name,
    total_bytes,
    used_bytes,
    free_bytes,
    max_bytes
FROM dba_monitor_hist.storage_snapshot
WHERE captured_at >= SYSDATE - :days
ORDER BY captured_at, tablespace_name
