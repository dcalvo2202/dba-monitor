/*
================================================================================
 Archivo     : sql/oracle/audit/get_user_privileges.sql
 Módulo      : 5 - Auditoría
 Propósito   : Obtener los privilegios EFECTIVOS de un usuario: los otorgados
               directamente y los heredados a través de roles (incluidos los
               roles anidados), indicando por qué camino llega cada uno.
 Vistas      : DBA_ROLE_PRIVS, DBA_SYS_PRIVS, DBA_TAB_PRIVS
 Privilegios : SELECT ON SYS.DBA_ROLE_PRIVS, SYS.DBA_SYS_PRIVS, SYS.DBA_TAB_PRIVS

 Parámetros (bind):
   :username        Nombre del usuario en mayúsculas (ej. 'AUDIT_DEMO').
   :privilege_type  'SISTEMA', 'OBJETO' o NULL para ambos tipos.
   :max_rows        Máximo de filas a devolver.

 Columnas devueltas:
   privilege_type  'SISTEMA' (ej. CREATE TABLE) u 'OBJETO' (ej. SELECT sobre
                   una tabla concreta).
   privilege       Nombre del privilegio.
   object_name     OWNER.OBJETO para privilegios de objeto; NULL en sistema.
   origin          'DIRECTO' o la ruta de roles por la que se hereda
                   (ej. 'AUDIT_DEMO_ROLE > AUDIT_DEMO_BASE_ROLE').
   admin_option    'YES' si puede volver a otorgar el privilegio a otros
                   (ADMIN OPTION en sistema, GRANTABLE en objeto).
   total_rows      Total de privilegios que cumplen el filtro, aunque se
                   devuelvan menos filas por el límite :max_rows.

 Notas:
   - Se usan variables bind y no concatenación de texto para evitar
     inyección SQL y permitir que Oracle reutilice el plan de ejecución.
   - Cuentas administrativas como SYS acumulan decenas de miles de
     privilegios de objeto a través de roles internos. El límite :max_rows
     evita enviar a la interfaz una cantidad de filas que nadie podría
     revisar; total_rows permite informar cuántos hay en realidad.
================================================================================
*/
WITH user_roles AS (
    -- Todos los roles del usuario, directos y heredados.
    -- SYS_CONNECT_BY_PATH construye la cadena de roles recorrida, que se
    -- muestra como "origen" del privilegio.
    SELECT rp.granted_role AS role_name,
           LTRIM(SYS_CONNECT_BY_PATH(rp.granted_role, ' > '), ' > ') AS role_path
    FROM   dba_role_privs rp
    START WITH rp.grantee = :username
    CONNECT BY NOCYCLE PRIOR rp.granted_role = rp.grantee
),
grantees AS (
    -- El propio usuario (privilegios directos) más cada uno de sus roles.
    SELECT :username AS grantee, 'DIRECTO' AS origin FROM dual
    UNION ALL
    SELECT ur.role_name, ur.role_path FROM user_roles ur
),
all_privileges AS (
    -- Privilegios de sistema.
    SELECT 'SISTEMA'       AS privilege_type,
           sp.privilege,
           NULL            AS object_name,
           g.origin,
           sp.admin_option
    FROM   grantees g
    JOIN   dba_sys_privs sp
           ON sp.grantee = g.grantee
    UNION ALL
    -- Privilegios sobre objetos concretos (tablas, vistas, procedimientos...).
    SELECT 'OBJETO'        AS privilege_type,
           tp.privilege,
           tp.owner || '.' || tp.table_name AS object_name,
           g.origin,
           tp.grantable    AS admin_option
    FROM   grantees g
    JOIN   dba_tab_privs tp
           ON tp.grantee = g.grantee
)
SELECT ap.privilege_type,
       ap.privilege,
       ap.object_name,
       ap.origin,
       ap.admin_option,
       -- Función analítica: cuenta todas las filas filtradas antes de aplicar
       -- el límite, sin necesidad de una segunda consulta.
       COUNT(*) OVER () AS total_rows
FROM   all_privileges ap
WHERE  :privilege_type IS NULL
   OR  ap.privilege_type = :privilege_type
-- Primero los de sistema, luego los directos antes que los heredados.
ORDER  BY ap.privilege_type DESC,
          CASE WHEN ap.origin = 'DIRECTO' THEN 0 ELSE 1 END,
          ap.origin, ap.privilege, ap.object_name
FETCH FIRST :max_rows ROWS ONLY
