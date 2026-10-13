/*
================================================================================
 Archivo     : sql/oracle/audit/get_user_privileges.sql
 Módulo      : 5 - Auditoría
 Propósito   : Obtener los privilegios EFECTIVOS de un usuario: los otorgados
               directamente, los heredados a través de roles (incluidos los
               roles anidados) y los otorgados a PUBLIC, indicando por qué
               camino llega cada uno.
 Vistas      : DBA_ROLE_PRIVS, DBA_SYS_PRIVS, DBA_TAB_PRIVS
 Privilegios : SELECT ON SYS.DBA_ROLE_PRIVS, SYS.DBA_SYS_PRIVS, SYS.DBA_TAB_PRIVS

 Parámetros (bind):
   :username        Nombre exacto del usuario (ej. 'AUDIT_DEMO').
   :privilege_type  'SISTEMA', 'OBJETO' o NULL para ambos tipos.
   :max_rows        Máximo de filas a devolver.

 Columnas devueltas (una fila por privilegio distinto):
   privilege_type  'SISTEMA' (ej. CREATE TABLE) u 'OBJETO' (ej. SELECT sobre
                   una tabla concreta).
   privilege       Nombre del privilegio.
   object_name     OWNER.OBJETO para privilegios de objeto; NULL en sistema.
   origin          'DIRECTO', 'PUBLIC' o la ruta de roles más corta por la
                   que se hereda (ej. 'AUDIT_DEMO_ROLE > AUDIT_DEMO_BASE_ROLE').
   path_count      Cantidad de fuentes distintas que otorgan el mismo
                   privilegio al usuario: él mismo (directo), cada rol que
                   lo contiene y PUBLIC.
   admin_option    'YES' solo si el usuario puede volver a otorgarlo: requiere
                   que se le haya otorgado DIRECTAMENTE con ADMIN OPTION
                   (sistema) o GRANT OPTION (objeto). Un rol con esa opción no
                   la transmite a quienes lo reciben.
   total_rows      Total de privilegios distintos que cumplen el filtro,
                   aunque se devuelvan menos filas por el límite :max_rows.

 Notas:
   - Una consulta jerárquica (CONNECT BY) devuelve una fila por CAMINO, no
     por rol: si un rol se alcanza por dos caminos aparece dos veces. Por eso
     los roles se agrupan primero (una fila por rol, camino más corto) y los
     privilegios se reducen al final a una fila por privilegio. Sin esto,
     SYS mostraba 92 584 filas para solo 6 969 privilegios distintos.
   - Todo usuario recibe implícitamente lo otorgado a PUBLIC. Se incluyen los
     privilegios de SISTEMA y los roles de PUBLIC (un GRANT ... TO PUBLIC es
     un hallazgo de auditoría clásico). Los privilegios de OBJETO de PUBLIC
     (más de 44 000 en Oracle XE, sobre paquetes y vistas del sistema) se
     cuentan aparte en get_public_object_privileges.sql para no ocultar los
     privilegios propios del usuario.
   - No incluye privilegios de columna (DBA_COL_PRIVS), los derechos del
     usuario sobre sus propios objetos ni la pertenencia a SYSDBA/SYSOPER.
   - Se usan variables bind para evitar inyección SQL y permitir que Oracle
     reutilice el plan de ejecución.
================================================================================
*/
WITH role_paths AS (
    -- Todos los caminos desde el usuario (y desde PUBLIC) hasta cada rol.
    -- CONNECT_BY_ROOT conserva el punto de partida de la cadena.
    SELECT rp.granted_role                       AS role_name,
           CONNECT_BY_ROOT rp.grantee            AS root_grantee,
           SYS_CONNECT_BY_PATH(rp.granted_role, ' > ') AS raw_path,
           LEVEL                                 AS path_level
    FROM   dba_role_privs rp
    START WITH rp.grantee IN (:username, 'PUBLIC')
    -- NOCYCLE: protección ante ciclos (Oracle ya los impide con ORA-01934).
    CONNECT BY NOCYCLE PRIOR rp.granted_role = rp.grantee
),
user_roles AS (
    -- Una sola fila por rol, con el camino más corto. SUBSTR quita el
    -- separador inicial ' > ' que agrega SYS_CONNECT_BY_PATH.
    SELECT role_name,
           MIN(
               CASE WHEN root_grantee = 'PUBLIC'
                    THEN 'PUBLIC > ' || SUBSTR(raw_path, 4)
                    ELSE SUBSTR(raw_path, 4)
               END
           ) KEEP (DENSE_RANK FIRST ORDER BY path_level) AS role_path
    FROM   role_paths
    GROUP  BY role_name
),
grantees AS (
    -- Quién puede haber recibido privilegios en nombre del usuario:
    -- él mismo, PUBLIC y cada uno de sus roles.
    SELECT :username AS grantee, 'DIRECTO' AS origin, 0 AS origin_rank FROM dual
    UNION ALL
    SELECT 'PUBLIC', 'PUBLIC', 2 FROM dual
    UNION ALL
    SELECT ur.role_name, ur.role_path, 1 FROM user_roles ur
),
all_privileges AS (
    -- Privilegios de sistema.
    SELECT 'SISTEMA'  AS privilege_type,
           sp.privilege,
           NULL       AS object_name,
           g.origin,
           g.origin_rank,
           CASE WHEN g.origin = 'DIRECTO' THEN sp.admin_option ELSE 'NO' END
                      AS admin_option
    FROM   grantees g
    JOIN   dba_sys_privs sp
           ON sp.grantee = g.grantee
    UNION ALL
    -- Privilegios sobre objetos concretos (tablas, vistas, procedimientos...).
    -- Se excluyen los otorgados a PUBLIC (ver Notas).
    SELECT 'OBJETO',
           tp.privilege,
           tp.owner || '.' || tp.table_name,
           g.origin,
           g.origin_rank,
           CASE WHEN g.origin = 'DIRECTO' THEN tp.grantable ELSE 'NO' END
    FROM   grantees g
    JOIN   dba_tab_privs tp
           ON tp.grantee = g.grantee
    WHERE  g.grantee <> 'PUBLIC'
),
ranked_privileges AS (
    -- Un mismo privilegio puede otorgarse por varias fuentes (directo y en
    -- uno o más roles). Se conserva la más relevante (directo primero, luego
    -- por rol, luego PUBLIC) y se cuenta cuántas fuentes lo otorgan.
    SELECT ap.*,
           ROW_NUMBER() OVER (
               PARTITION BY ap.privilege_type, ap.privilege, ap.object_name
               ORDER BY ap.origin_rank, LENGTH(ap.origin), ap.origin
           ) AS path_rank,
           COUNT(*) OVER (
               PARTITION BY ap.privilege_type, ap.privilege, ap.object_name
           ) AS path_count,
           MAX(ap.admin_option) OVER (
               PARTITION BY ap.privilege_type, ap.privilege, ap.object_name
           ) AS best_admin_option
    FROM   all_privileges ap
    WHERE  :privilege_type IS NULL
       OR  ap.privilege_type = :privilege_type
)
SELECT rp.privilege_type,
       rp.privilege,
       rp.object_name,
       rp.origin,
       rp.path_count,
       -- 'YES' > 'NO' alfabéticamente: MAX indica si algún camino directo
       -- permite volver a otorgarlo.
       rp.best_admin_option AS admin_option,
       -- Función analítica: cuenta los privilegios distintos antes de aplicar
       -- el límite, sin necesidad de una segunda consulta.
       COUNT(*) OVER () AS total_rows
FROM   ranked_privileges rp
WHERE  rp.path_rank = 1
-- Primero los de sistema; dentro de cada tipo, directos, luego por rol,
-- luego PUBLIC.
ORDER  BY rp.privilege_type DESC,
          rp.origin_rank,
          rp.origin,
          rp.privilege,
          rp.object_name
FETCH FIRST :max_rows ROWS ONLY
