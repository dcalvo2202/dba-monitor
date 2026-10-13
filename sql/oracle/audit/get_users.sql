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
   has_dba_role               'Y' si tiene el rol DBA: directo, heredado de
                              otro rol o recibido a través de PUBLIC.
   sensitive_privilege_count  Privilegios de sistema sensibles efectivos
                              (ver lista en el filtro final).

 Notas:
   - Los roles pueden otorgarse a otros roles; por eso los roles efectivos se
     calculan con una consulta jerárquica (CONNECT BY).
   - Todo usuario recibe implícitamente lo otorgado a PUBLIC, por eso PUBLIC
     se trata como un beneficiario más de cada usuario.
   - La jerarquía se calcula una sola vez para todos los usuarios
     (MATERIALIZE) y los indicadores se obtienen con un único JOIN agrupado,
     en lugar de subconsultas que se repetirían por cada usuario.
   - La lista de privilegios sensibles debe mantenerse igual a
     SENSITIVE_SYSTEM_PRIVILEGES en app/modules/audit/service.py.
================================================================================
*/
WITH user_roles AS (
    -- Expande la jerarquía de roles de cada usuario y de PUBLIC.
    -- CONNECT_BY_ROOT conserva quién inició la cadena; DISTINCT elimina los
    -- caminos repetidos hacia un mismo rol.
    SELECT /*+ MATERIALIZE */
           DISTINCT
           CONNECT_BY_ROOT rp.grantee AS username,
           rp.granted_role
    FROM   dba_role_privs rp
    START WITH rp.grantee IN (SELECT u.username FROM dba_users u)
            OR rp.grantee = 'PUBLIC'
    -- NOCYCLE: protección ante ciclos (Oracle ya los impide con ORA-01934).
    CONNECT BY NOCYCLE PRIOR rp.granted_role = rp.grantee
),
effective_grantees AS (
    -- Para cada usuario, todos los "beneficiarios" cuyos privilegios recibe:
    -- 1) él mismo, 2) sus roles, 3) PUBLIC y 4) los roles de PUBLIC.
    SELECT u.username, u.username AS grantee
    FROM   dba_users u
    UNION
    SELECT ur.username, ur.granted_role
    FROM   user_roles ur
    WHERE  ur.username <> 'PUBLIC'
    UNION
    SELECT u.username, 'PUBLIC'
    FROM   dba_users u
    UNION
    SELECT u.username, ur.granted_role
    FROM   dba_users u
    CROSS  JOIN user_roles ur
    WHERE  ur.username = 'PUBLIC'
),
security_flags AS (
    -- Un solo recorrido agrupado calcula los indicadores de todos los usuarios.
    SELECT eg.username,
           MAX(CASE WHEN eg.grantee = 'DBA' THEN 'Y' ELSE 'N' END) AS has_dba_role,
           COUNT(DISTINCT sp.privilege) AS sensitive_privilege_count
    FROM   effective_grantees eg
    LEFT   JOIN dba_sys_privs sp
           ON  sp.grantee = eg.grantee
           -- Privilegios de sistema sensibles: los "ANY" actúan sobre objetos
           -- de cualquier esquema; el resto administra la instancia,
           -- usuarios, espacio o auditoría.
           AND (   sp.privilege LIKE '% ANY %'
                OR sp.privilege LIKE 'ADMINISTER %'
                OR sp.privilege IN (
                       'ALTER SYSTEM', 'ALTER DATABASE', 'AUDIT SYSTEM',
                       'CREATE USER', 'ALTER USER', 'DROP USER', 'BECOME USER',
                       'UNLIMITED TABLESPACE', 'EXEMPT ACCESS POLICY',
                       'EXEMPT REDACTION POLICY'
                   )
               )
    GROUP  BY eg.username
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
       sf.has_dba_role,
       sf.sensitive_privilege_count
FROM   dba_users u
JOIN   security_flags sf
       ON sf.username = u.username
WHERE  :include_oracle = 'Y'
   OR  u.oracle_maintained = 'N'
ORDER  BY u.oracle_maintained, u.username
