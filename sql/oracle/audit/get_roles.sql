/*
================================================================================
 Archivo     : sql/oracle/audit/get_roles.sql
 Módulo      : 5 - Auditoría
 Propósito   : Listar los roles disponibles en la base de datos con un resumen
               de a quién están asignados y cuántos privilegios agrupan.
 Vistas      : DBA_ROLES, DBA_ROLE_PRIVS, DBA_SYS_PRIVS, DBA_USERS
 Privilegios : SELECT ON SYS.DBA_ROLES, SYS.DBA_ROLE_PRIVS,
               SYS.DBA_SYS_PRIVS, SYS.DBA_USERS

 Parámetros (bind):
   :include_oracle  'Y' = incluir los roles predefinidos de Oracle
                    (DBA, CONNECT, RESOURCE...); 'N' = solo roles propios.

 Columnas devueltas:
   role                Nombre del rol.
   authentication_type NONE = se activa sin contraseña.
   oracle_maintained   'Y' si es un rol predefinido de Oracle.
   user_grantees       Usuarios que tienen el rol asignado directamente.
   role_grantees       Otros roles que contienen a este rol.
   sys_privilege_count Privilegios de sistema que otorga el rol.
   granted_roles       Roles que este rol contiene (separados por coma).
================================================================================
*/
SELECT r.role,
       r.authentication_type,
       r.oracle_maintained,
       -- Distingue si el beneficiario del rol es un usuario o es otro rol.
       (SELECT COUNT(*)
        FROM   dba_role_privs rp
        JOIN   dba_users u ON u.username = rp.grantee
        WHERE  rp.granted_role = r.role) AS user_grantees,
       (SELECT COUNT(*)
        FROM   dba_role_privs rp
        JOIN   dba_roles r2 ON r2.role = rp.grantee
        WHERE  rp.granted_role = r.role) AS role_grantees,
       (SELECT COUNT(*)
        FROM   dba_sys_privs sp
        WHERE  sp.grantee = r.role) AS sys_privilege_count,
       (SELECT LISTAGG(rp.granted_role, ', ')
                   WITHIN GROUP (ORDER BY rp.granted_role)
        FROM   dba_role_privs rp
        WHERE  rp.grantee = r.role) AS granted_roles
FROM   dba_roles r
WHERE  :include_oracle = 'Y'
   OR  r.oracle_maintained = 'N'
ORDER  BY r.oracle_maintained, r.role
