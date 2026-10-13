/*
================================================================================
 Propósito    : Espacio total, usado, libre y máximo de cada tablespace,
                incluidos los temporales.
 Módulo       : 3 - Gestión del almacenamiento
 Vistas       : DBA_TABLESPACES, DBA_DATA_FILES, DBA_FREE_SPACE,
                DBA_TEMP_FILES, DBA_TEMP_FREE_SPACE
 Privilegios  : SELECT sobre las cinco vistas (ver setup/grants.sql)
 Columnas     : tablespace_name, contents, status, total_bytes, used_bytes,
                free_bytes, max_bytes, file_count, autoextensible
 Notas        :
   - contents: PERMANENT, UNDO o TEMPORARY.
   - max_bytes es el tamaño al que el tablespace PUEDE crecer: suma de
     MAXBYTES de los archivos autoextensibles y del tamaño actual de los
     que no lo son (GREATEST evita el MAXBYTES = 0 de estos últimos). Un
     tablespace al 98 % de su tamaño actual no está lleno si aún puede
     crecer; el porcentaje de riesgo se calcula sobre max_bytes.
   - Los temporales no aparecen en DBA_DATA_FILES ni en DBA_FREE_SPACE:
     se leen de DBA_TEMP_FILES y DBA_TEMP_FREE_SPACE (por eso el UNION ALL).
================================================================================
*/
WITH data_files AS (
    SELECT
        tablespace_name,
        SUM(bytes)                      AS total_bytes,
        SUM(GREATEST(bytes, maxbytes))  AS max_bytes,
        COUNT(*)                        AS file_count,
        MAX(autoextensible)             AS autoextensible   -- 'YES' si alguno lo es
    FROM dba_data_files
    GROUP BY tablespace_name
),
free_space AS (
    SELECT tablespace_name, SUM(bytes) AS free_bytes
    FROM dba_free_space
    GROUP BY tablespace_name
),
temp_files AS (
    SELECT
        tablespace_name,
        SUM(bytes)                      AS total_bytes,
        SUM(GREATEST(bytes, maxbytes))  AS max_bytes,
        COUNT(*)                        AS file_count,
        MAX(autoextensible)             AS autoextensible
    FROM dba_temp_files
    GROUP BY tablespace_name
)
-- Tablespaces permanentes y de undo.
SELECT
    t.tablespace_name,
    t.contents,
    t.status,
    d.total_bytes,
    d.total_bytes - NVL(f.free_bytes, 0) AS used_bytes,
    NVL(f.free_bytes, 0)                 AS free_bytes,
    d.max_bytes,
    d.file_count,
    d.autoextensible
FROM dba_tablespaces t
JOIN data_files d
    ON d.tablespace_name = t.tablespace_name
LEFT JOIN free_space f
    ON f.tablespace_name = t.tablespace_name

UNION ALL

-- Tablespaces temporales.
SELECT
    t.tablespace_name,
    t.contents,
    t.status,
    tf.total_bytes,
    tf.total_bytes - NVL(tfs.free_space, 0) AS used_bytes,
    NVL(tfs.free_space, 0)                  AS free_bytes,
    tf.max_bytes,
    tf.file_count,
    tf.autoextensible
FROM dba_tablespaces t
JOIN temp_files tf
    ON tf.tablespace_name = t.tablespace_name
LEFT JOIN dba_temp_free_space tfs
    ON tfs.tablespace_name = t.tablespace_name
