/*
================================================================================
 Propósito    : Configuración de recuperación de la base de datos: modo de
                archivado y estado de la Fast Recovery Area (FRA).
 Módulo       : 4 - Respaldo y recuperación
 Vistas       : V$DATABASE, V$RECOVERY_FILE_DEST
 Privilegios  : SELECT ON SYS.V_$DATABASE
                SELECT ON SYS.V_$RECOVERY_FILE_DEST
 Columnas     : database_name, log_mode, container_name, current_time,
                fra_path, fra_limit_bytes, fra_used_bytes,
                fra_reclaimable_bytes, fra_files
 Notas        :
   - current_time (SYSDATE) es la hora del servidor de base de datos. La
     antigüedad de los respaldos se calcula con ella y no con el reloj de
     la aplicación: así coincide con las fechas que registra RMAN aunque
     la aplicación corra en otro equipo o zona horaria.
   - log_mode: 'ARCHIVELOG' o 'NOARCHIVELOG'. En NOARCHIVELOG solo se puede
     recuperar hasta el último respaldo completo.
   - La FRA es de nivel CDB. Desde una PDB, V$RECOVERY_FILE_DEST puede no
     devolver filas; por eso se une con LEFT JOIN y las columnas fra_*
     quedan en NULL en lugar de perder la fila de V$DATABASE.
   - fra_reclaimable_bytes es espacio ocupado por archivos que RMAN ya
     considera obsoletos: Oracle lo libera automáticamente si lo necesita.
================================================================================
*/
SELECT
    d.name                                 AS database_name,
    d.log_mode,
    SYS_CONTEXT('USERENV', 'CON_NAME')     AS container_name,
    SYSDATE                                AS current_time,
    f.name                                 AS fra_path,
    f.space_limit                          AS fra_limit_bytes,
    f.space_used                           AS fra_used_bytes,
    f.space_reclaimable                    AS fra_reclaimable_bytes,
    f.number_of_files                      AS fra_files
FROM v$database d
LEFT JOIN v$recovery_file_dest f
    ON 1 = 1
