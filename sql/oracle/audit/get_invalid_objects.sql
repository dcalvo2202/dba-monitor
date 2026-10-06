/*
================================================================================
 Archivo     : sql/oracle/audit/get_invalid_objects.sql
 Módulo      : 5 - Auditoría (reutilizable por el Módulo 6 - Mantenimiento)
 Propósito   : Detectar los objetos de la base de datos en estado INVALID.
 Vistas      : DBA_OBJECTS, DBA_ERRORS
 Privilegios : SELECT ON SYS.DBA_OBJECTS, SYS.DBA_ERRORS

 Columnas devueltas:
   owner, object_name, object_type, created, last_ddl_time,
   oracle_maintained  'Y' si el objeto pertenece a un esquema interno de Oracle.
   error_count        Errores de compilación registrados en DBA_ERRORS.

 Notas:
   - Un objeto puede estar INVALID sin errores registrados: ocurre cuando un
     objeto del que depende cambió o fue eliminado y todavía nadie intentó
     recompilarlo. Oracle solo escribe en DBA_ERRORS al compilar. Por eso se
     usa una subconsulta (equivalente a LEFT JOIN) y no un JOIN simple, que
     ocultaría esos objetos.
   - LAST_DDL_TIME indica cuándo se modificó el objeto por última vez y ayuda
     a relacionar la invalidez con un cambio reciente.
================================================================================
*/
SELECT o.owner,
       o.object_name,
       o.object_type,
       o.created,
       o.last_ddl_time,
       o.oracle_maintained,
       (SELECT COUNT(*)
        FROM   dba_errors e
        WHERE  e.owner = o.owner
        AND    e.name  = o.object_name
        AND    e.type  = o.object_type
        AND    e.attribute = 'ERROR') AS error_count
FROM   dba_objects o
WHERE  o.status = 'INVALID'
ORDER  BY o.oracle_maintained, o.owner, o.object_type, o.object_name
