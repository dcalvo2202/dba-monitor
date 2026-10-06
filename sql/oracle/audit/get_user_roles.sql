/*
================================================================================
 Archivo     : sql/oracle/audit/get_user_roles.sql
 Módulo      : 5 - Auditoría
 Propósito   : Listar los roles de un usuario, tanto los asignados
               directamente como los heredados a través de otros roles.
 Vistas      : DBA_ROLE_PRIVS
 Privilegios : SELECT ON SYS.DBA_ROLE_PRIVS

 Parámetros (bind):
   :username  Nombre del usuario en mayúsculas.

 Columnas devueltas:
   granted_role  Nombre del rol.
   role_path     Cadena de roles desde el usuario hasta este rol.
   grant_level   1 = asignado directamente; 2 o más = heredado.
   admin_option  'YES' si puede otorgar el rol a otros usuarios.
   default_role  'YES' si se activa automáticamente al iniciar sesión.
================================================================================
*/
SELECT rp.granted_role,
       LTRIM(SYS_CONNECT_BY_PATH(rp.granted_role, ' > '), ' > ') AS role_path,
       -- LEVEL es la profundidad en la jerarquía: 1 = rol directo del usuario.
       LEVEL AS grant_level,
       rp.admin_option,
       rp.default_role
FROM   dba_role_privs rp
START WITH rp.grantee = :username
CONNECT BY NOCYCLE PRIOR rp.granted_role = rp.grantee
ORDER  SIBLINGS BY rp.granted_role
