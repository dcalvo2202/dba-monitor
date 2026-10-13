/*
================================================================================
 Propósito    : Tamaño actual de la base de datos (contenedor consultado).
 Módulo       : 3 - Gestión del almacenamiento
 Vistas       : DBA_DATA_FILES, DBA_TEMP_FILES, DBA_SEGMENTS
 Privilegios  : SELECT sobre las tres vistas (ver setup/grants.sql)
 Columnas     : container_name, datafile_bytes, tempfile_bytes,
                datafile_max_bytes, segment_bytes
 Notas        :
   - datafile_bytes: espacio ASIGNADO en disco por los archivos de datos
     (lo que ocupa la base en el sistema de archivos).
   - segment_bytes: espacio realmente USADO por tablas, índices, LOBs...
     La diferencia con datafile_bytes es espacio reservado aún libre.
   - tempfile_bytes se informa aparte: los temporales guardan datos de
     trabajo (ordenamientos), no información de la base.
   - datafile_max_bytes: tamaño al que pueden crecer los datafiles con
     autoextensión.
   - Desde XEPDB1 se mide la PDB; desde CDB$ROOT, la raíz.
================================================================================
*/
SELECT
    SYS_CONTEXT('USERENV', 'CON_NAME')                         AS container_name,
    (SELECT SUM(bytes) FROM dba_data_files)                     AS datafile_bytes,
    (SELECT NVL(SUM(bytes), 0) FROM dba_temp_files)             AS tempfile_bytes,
    (SELECT SUM(GREATEST(bytes, maxbytes)) FROM dba_data_files) AS datafile_max_bytes,
    (SELECT NVL(SUM(bytes), 0) FROM dba_segments)               AS segment_bytes
FROM dual
