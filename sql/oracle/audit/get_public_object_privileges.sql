/*
================================================================================
 Archivo     : sql/oracle/audit/get_public_object_privileges.sql
 Módulo      : 5 - Auditoría
 Propósito   : Contar los privilegios de objeto otorgados a PUBLIC, que todo
               usuario de la base de datos hereda implícitamente.
 Vistas      : DBA_TAB_PRIVS, DBA_USERS
 Privilegios : SELECT ON SYS.DBA_TAB_PRIVS, SYS.DBA_USERS

 Columnas devueltas:
   total_privileges     Privilegios de objeto otorgados a PUBLIC.
   custom_owner_count   Cuántos de ellos son sobre objetos de esquemas
                        creados por el administrador (no internos de Oracle).
                        Son los que conviene revisar: los internos los otorga
                        Oracle durante la instalación.

 Notas:
   - Se presenta como resumen y no como lista porque una instalación de
     Oracle XE tiene más de 44 000 de estos privilegios, casi todos EXECUTE
     sobre paquetes del sistema.
================================================================================
*/
SELECT COUNT(*) AS total_privileges,
       COUNT(CASE WHEN u.oracle_maintained = 'N' THEN 1 END) AS custom_owner_count
FROM   dba_tab_privs tp
-- LEFT JOIN: el propietario podría no figurar en DBA_USERS.
LEFT JOIN dba_users u
       ON u.username = tp.owner
WHERE  tp.grantee = 'PUBLIC'
