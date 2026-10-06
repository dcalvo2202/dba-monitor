/*
================================================================================
 Archivo     : sql/oracle/audit/get_compilation_errors.sql
 Módulo      : 5 - Auditoría
 Propósito   : Obtener el detalle de los errores de compilación de objetos
               PL/SQL, vistas y otros objetos almacenados.
 Vistas      : DBA_ERRORS
 Privilegios : SELECT ON SYS.DBA_ERRORS

 Columnas devueltas:
   owner, name, type  Identifican el objeto con errores.
   sequence           Orden del mensaje dentro del objeto.
   line, position     Ubicación del error en el código fuente.
   text               Mensaje de Oracle (ej. PLS-00103, ORA-00942).
   attribute          ERROR o WARNING (advertencias del compilador PL/SQL).
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
ORDER  BY e.owner, e.name, e.type, e.sequence
