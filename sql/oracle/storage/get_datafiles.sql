/*
================================================================================
 Propósito    : Archivos físicos de la base de datos (datafiles y tempfiles)
                con su tamaño, límite de crecimiento y estado.
 Módulo       : 3 - Gestión del almacenamiento
 Vistas       : DBA_DATA_FILES, DBA_TEMP_FILES, DBA_TABLESPACES
 Privilegios  : SELECT sobre las tres vistas (ver setup/grants.sql)
 Columnas     : file_type, file_id, file_name, tablespace_name, bytes,
                max_bytes, autoextensible, increment_bytes, status
 Notas        :
   - file_type: 'DATOS' o 'TEMPORAL'.
   - max_bytes: MAXBYTES si el archivo es autoextensible; si no, su tamaño
     actual (no puede crecer).
   - increment_bytes: cuánto crece cada vez que se llena. INCREMENT_BY está
     en bloques, por eso se multiplica por el tamaño de bloque del
     tablespace.
================================================================================
*/
SELECT
    'DATOS'                                   AS file_type,
    d.file_id,
    d.file_name,
    d.tablespace_name,
    d.bytes,
    GREATEST(d.bytes, d.maxbytes)             AS max_bytes,
    d.autoextensible,
    d.increment_by * t.block_size             AS increment_bytes,
    d.status
FROM dba_data_files d
JOIN dba_tablespaces t
    ON t.tablespace_name = d.tablespace_name

UNION ALL

SELECT
    'TEMPORAL'                                AS file_type,
    f.file_id,
    f.file_name,
    f.tablespace_name,
    f.bytes,
    GREATEST(f.bytes, f.maxbytes)             AS max_bytes,
    f.autoextensible,
    f.increment_by * t.block_size             AS increment_bytes,
    f.status
FROM dba_temp_files f
JOIN dba_tablespaces t
    ON t.tablespace_name = f.tablespace_name

ORDER BY file_type, tablespace_name, file_id
