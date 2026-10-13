/*
================================================================================
 Propósito    : Registrar una medición del almacenamiento en el historial.
 Módulo       : 3 - Gestión del almacenamiento
 Objetos      : DBA_MONITOR_HIST.RECORD_STORAGE_SNAPSHOT
                (creado por setup/create_storage_history.sql)
 Privilegios  : EXECUTE ON DBA_MONITOR_HIST.RECORD_STORAGE_SNAPSHOT
 Notas        :
   - La aplicación no inserta filas directamente: llama al procedimiento,
     que calcula la medición con los datos reales del diccionario y hace
     COMMIT. Así DBA_MONITOR no necesita INSERT sobre la tabla y no puede
     registrar valores inventados.
   - La misma medición la toma cada día la tarea programada
     DBA_MONITOR_HIST.STORAGE_SNAPSHOT_DAILY.
================================================================================
*/
BEGIN
    dba_monitor_hist.record_storage_snapshot;
END;
