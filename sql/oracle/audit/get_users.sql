/*
================================================================================
 Archivo     : sql/oracle/audit/get_users.sql
 Módulo      : 5 - Auditoría
 Propósito   : Listar los usuarios registrados en la base de datos junto con
               indicadores de seguridad que el servicio usa para detectar
               cuentas de riesgo.
 Vistas      : DBA_USERS, DBA_ROLE_PRIVS, DBA_SYS_PRIVS
 Privilegios : SELECT ON SYS.DBA_USERS, SYS.DBA_ROLE_PRIVS, SYS.DBA_SYS_PRIVS

 Parámetros (bind):
   :include_oracle  'Y' = incluir las cuentas internas de Oracle
                    (SYS, SYSTEM, XDB...); 'N' = solo cuentas creadas por
                    el administrador.

 Columnas devueltas:
   username, account_status, authentication_type, created, last_login,
   expiry_date, lock_date, default_tablespace, profile, oracle_maintained,
   has_dba_role         'Y' si tiene el rol DBA directo o heredado.
   any_privilege_count  Cantidad de privilegios de sistema "ANY" efectivos.

 Notas:
   - Los roles pueden otorgarse a otros roles; por eso los roles efectivos se
     calculan con una consulta jerárquica (CONNECT BY) y no solo con los
     roles asignados directamente.
   - El diccionario contiene pocas decenas de usuarios, así que la expansión
     de roles para todos ellos es barata.
================================================================================
*/
WITH user_roles AS (
    -- Expande la jerarquía de roles: para cada usuario obtiene todos los
    -- roles que tiene, ya sea asignados directamente o heredados.
    -- CONNECT_BY_ROOT conserva el usuario que inició la cadena.
    SELECT CONNECT_BY_ROOT rp.grantee AS username,
           rp.granted_role
    FROM   dba_role_privs rp
    START WITH rp.grantee IN (SELECT u.username FROM dba_users u)
    -- NOCYCLE evita un bucle infinito si existiera un ciclo entre roles.
    CONNECT BY NOCYCLE PRIOR rp.granted_role = rp.grantee
),
effective_grantees AS (
    -- Un usuario recibe privilegios por sí mismo y por cada uno de sus roles.
    SELECT u.username, u.username AS grantee FROM dba_users u
    UNION
    SELECT ur.username, ur.granted_role AS grantee FROM user_roles ur
)
SELECT u.username,
       u.account_status,
       u.authentication_type,
       u.created,
       u.last_login,
       u.expiry_date,
       u.lock_date,
       u.default_tablespace,
       u.profile,
       u.oracle_maintained,
       CASE
           WHEN EXISTS (SELECT 1
                        FROM   user_roles ur
                        WHERE  ur.username = u.username
                        AND    ur.granted_role = 'DBA')
           THEN 'Y'
           ELSE 'N'
       END AS has_dba_role,
       (SELECT COUNT(DISTINCT sp.privilege)
        FROM   effective_grantees eg
        JOIN   dba_sys_privs sp
               ON sp.grantee = eg.grantee
        WHERE  eg.username = u.username
        -- Privilegios como SELECT ANY TABLE o DROP ANY TABLE actúan sobre
        -- objetos de cualquier esquema: son los más sensibles.
        AND    sp.privilege LIKE '% ANY %') AS any_privilege_count
FROM   dba_users u
WHERE  :include_oracle = 'Y'
   OR  u.oracle_maintained = 'N'
ORDER  BY u.oracle_maintained, u.username
