/*
================================================================================
 Archivo     : sql/oracle/audit/get_user_roles.sql
 Módulo      : 5 - Auditoría
 Propósito   : Listar los roles de un usuario: los asignados directamente,
               los heredados a través de otros roles y los que recibe por
               estar otorgados a PUBLIC.
 Vistas      : DBA_ROLE_PRIVS
 Privilegios : SELECT ON SYS.DBA_ROLE_PRIVS

 Parámetros (bind):
   :username  Nombre exacto del usuario.

 Columnas devueltas (una fila por rol):
   granted_role  Nombre del rol.
   role_path     Camino más corto desde el usuario hasta el rol.
   grant_level   1 = asignado directamente (o a PUBLIC); 2 o más = heredado.
   via_public    'Y' si el rol llega por PUBLIC.
   admin_option  'YES' si el usuario puede otorgar el rol a otros (solo
                 posible cuando se le asignó directamente WITH ADMIN OPTION).
   default_role  'YES' si el rol se activa automáticamente al iniciar
                 sesión. Para un rol heredado se toma del rol directo del que
                 proviene, porque es ese el que se activa o no.

 Notas:
   - CONNECT BY devuelve una fila por camino; si un rol se alcanza por varios
     caminos (por ejemplo, asignado directamente y también dentro de otro
     rol) se agrupa en una sola fila con el camino más corto.
================================================================================
*/
WITH role_paths AS (
    SELECT rp.granted_role,
           CONNECT_BY_ROOT rp.grantee      AS root_grantee,
           -- default_role del primer eslabón (rol asignado al usuario).
           CONNECT_BY_ROOT rp.default_role AS root_default_role,
           SYS_CONNECT_BY_PATH(rp.granted_role, ' > ') AS raw_path,
           LEVEL                            AS path_level,
           -- ADMIN OPTION solo cuenta en el primer eslabón y si no es PUBLIC.
           CASE
               WHEN LEVEL = 1 AND CONNECT_BY_ROOT rp.grantee <> 'PUBLIC'
               THEN rp.admin_option
               ELSE 'NO'
           END                              AS user_admin_option
    FROM   dba_role_privs rp
    START WITH rp.grantee IN (:username, 'PUBLIC')
    CONNECT BY NOCYCLE PRIOR rp.granted_role = rp.grantee
)
SELECT granted_role,
       -- SUBSTR quita el separador inicial ' > ' de SYS_CONNECT_BY_PATH.
       MIN(
           CASE WHEN root_grantee = 'PUBLIC'
                THEN 'PUBLIC > ' || SUBSTR(raw_path, 4)
                ELSE SUBSTR(raw_path, 4)
           END
       ) KEEP (DENSE_RANK FIRST ORDER BY path_level, root_grantee DESC) AS role_path,
       MIN(path_level) AS grant_level,
       -- 'Y' solo si TODOS los caminos pasan por PUBLIC.
       MIN(CASE WHEN root_grantee = 'PUBLIC' THEN 'Y' ELSE 'N' END) AS via_public,
       MAX(user_admin_option) AS admin_option,
       -- 'YES' > 'NO': basta un camino que active el rol al iniciar sesión.
       MAX(root_default_role) AS default_role
FROM   role_paths
GROUP  BY granted_role
ORDER  BY grant_level, granted_role
