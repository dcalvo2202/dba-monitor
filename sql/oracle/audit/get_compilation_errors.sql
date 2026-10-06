/*
================================================================================
 Archivo     : sql/oracle/audit/get_compilation_errors.sql
 Módulo      : 5 - Auditoría
 Propósito   : Obtener el detalle de los errores de compilación de los
               objetos que actualmente están en estado INVALID.
 Vistas      : DBA_ERRORS, DBA_OBJECTS
 Privilegios : SELECT ON SYS.DBA_ERRORS, SYS.DBA_OBJECTS

 Columnas devueltas:
   owner, name, type  Identifican el objeto con errores.
   sequence           Orden del mensaje dentro del objeto.
   line, position     Ubicación del error en el código fuente.
   text               Mensaje de Oracle (ej. PLS-00103, ORA-00942).
   attribute          ERROR o WARNING (advertencias del compilador PL/SQL).

 Notas:
   - DBA_ERRORS también conserva advertencias de objetos válidos. El filtro
     EXISTS limita el resultado a los objetos inválidos, que son los que el
     módulo muestra, y evita traer filas innecesarias.
================================================================================
*/
SELECT e.owner,
       e.name,
       e.type,
       e.sequence,
       e.line,
       e.position,
       e.text,
       e.attribute
FROM   dba_errors e
WHERE  EXISTS (SELECT 1
               FROM   dba_objects o
               WHERE  o.owner       = e.owner
               AND    o.object_name = e.name
               AND    o.object_type = e.type
               AND    o.status      = 'INVALID')
ORDER  BY e.owner, e.name, e.type, e.sequence
