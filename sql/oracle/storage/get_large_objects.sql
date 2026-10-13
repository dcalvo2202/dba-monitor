/*
================================================================================
 Propósito    : Objetos (segmentos) que más almacenamiento consumen.
 Módulo       : 3 - Gestión del almacenamiento
 Vistas       : DBA_SEGMENTS, DBA_USERS
 Privilegios  : SELECT ON SYS.DBA_SEGMENTS
                SELECT ON SYS.DBA_USERS (ya otorgado para el Módulo 5)
 Parámetros   : :include_oracle  'Y' incluye los esquemas internos de Oracle.
                :max_rows        Cantidad de objetos a devolver.
 Columnas     : owner, segment_name, partition_name, segment_type,
                tablespace_name, bytes, extents, oracle_maintained
 Notas        :
   - Un segmento es el espacio que ocupa un objeto: TABLE, INDEX,
     LOBSEGMENT (columnas CLOB/BLOB), TABLE PARTITION, etc. Una tabla
     particionada tiene un segmento por partición.
   - En una base recién instalada los objetos internos de Oracle (SYS,
     SYSTEM, XDB...) dominan la lista; por defecto se ocultan para mostrar
     los de las aplicaciones. DBA_USERS.ORACLE_MAINTAINED los identifica.
   - FETCH FIRST (12c+) reemplaza el antiguo filtro con ROWNUM.
================================================================================
*/
SELECT
    s.owner,
    s.segment_name,
    s.partition_name,
    s.segment_type,
    s.tablespace_name,
    s.bytes,
    s.extents,
    u.oracle_maintained
FROM dba_segments s
JOIN dba_users u
    ON u.username = s.owner
WHERE :include_oracle = 'Y'
   OR u.oracle_maintained = 'N'
ORDER BY s.bytes DESC
FETCH FIRST :max_rows ROWS ONLY
