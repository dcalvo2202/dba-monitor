# Módulo 5 - Auditoría

La página `/auditoria` ayuda a supervisar la seguridad de la base de datos:
quién existe, qué roles y privilegios tiene y qué objetos están dañados.

## Qué muestra

La página tiene cuatro pestañas:

| Pestaña | Contenido | Origen |
| --- | --- | --- |
| Usuarios | Cuentas, estado y hallazgos de seguridad | `DBA_USERS`, `DBA_SYS_PRIVS`, `DBA_ROLE_PRIVS` |
| Roles | Roles y a quién están asignados | `DBA_ROLES`, `DBA_ROLE_PRIVS` |
| Privilegios | Privilegios de un usuario, directos y heredados por rol | `DBA_SYS_PRIVS`, `DBA_TAB_PRIVS`, `DBA_ROLE_PRIVS` |
| Objetos inválidos | Objetos con errores y el detalle de cada error | `DBA_OBJECTS`, `DBA_ERRORS` |

Las consultas están en `sql/oracle/audit/`.

## Hallazgos de seguridad

El servicio evalúa cada cuenta y genera hallazgos con un nivel y una
explicación legible (`app/modules/audit/service.py`):

- Cuentas propias con **privilegios de sistema sensibles** (los que incluyen
  `ANY`, `ALTER SYSTEM`, `CREATE USER`, entre otros).
- Cuentas **expiradas** o **bloqueadas**.
- Cuentas con la contraseña **por vencer** (`EXPIRED(GRACE)`).

Por defecto solo se analizan las **cuentas propias**, no las internas de
Oracle (`ORACLE_MAINTAINED`), para que el resumen coincida con los hallazgos.
`?include_oracle=true` las incluye.

## Privilegios heredados

La pestaña Privilegios resuelve los roles anidados: un usuario puede recibir un
privilegio directamente o a través de uno o varios roles, incluso por dos
caminos. La consulta recorre la jerarquía de roles y muestra el origen de cada
privilegio. Se puede filtrar por tipo: de sistema o de objeto. Los privilegios
otorgados a `PUBLIC` también se incluyen.

## API

| Método y ruta | Descripción |
| --- | --- |
| `GET /api/audit/users` | Usuarios, hallazgos y resumen (`?include_oracle=true`) |
| `GET /api/audit/users/{username}/privileges` | Roles y privilegios (`?privilege_type=SISTEMA\|OBJETO&max_rows=200`) |
| `GET /api/audit/roles` | Roles y su asignación (`?include_oracle=true`) |
| `GET /api/audit/invalid-objects` | Objetos inválidos con errores de compilación |

## Preparación

Como `SYS AS SYSDBA`, desde la raíz del repositorio:

```powershell
sqlplus / as sysdba @sql/oracle/audit/setup/grants.sql
sqlplus / as sysdba @sql/oracle/audit/setup/demo_objects.sql
```

- `grants.sql`: `SELECT` sobre `DBA_USERS`, `DBA_ROLES`, `DBA_ROLE_PRIVS`,
  `DBA_SYS_PRIVS`, `DBA_TAB_PRIVS`, `DBA_OBJECTS` y `DBA_ERRORS` para
  `DBA_MONITOR`. **No** se usan `GRANT DBA`, `SELECT ANY DICTIONARY` ni
  `SELECT_CATALOG_ROLE`.
- `demo_objects.sql`: una instalación limpia de Oracle XE no tiene objetos
  inválidos, así que crea el usuario sin contraseña `AUDIT_DEMO`, tres roles
  (dos anidados, uno alcanzable por dos caminos y uno no predeterminado) y tres
  objetos inválidos con errores de compilación reales. El script se puede
  repetir: elimina el escenario anterior antes de recrearlo. Los mensajes
  `Warning: ... compilation errors` son el resultado esperado.

Más detalle en la sección 5.6 de [configuracion-local.md](configuracion-local.md).

## Relación con el módulo 6

Este módulo **detecta** objetos inválidos y muestra sus errores; el
[módulo 6](modulo-6-mantenimiento.md) permite **recompilarlos** en el esquema
de mantenimiento.

## Limitaciones

- Es una auditoría de **configuración** (quién tiene qué), no un registro de
  actividad: no usa Unified Auditing ni lee `UNIFIED_AUDIT_TRAIL`.
- Un privilegio "sensible" es un criterio definido por el equipo, listado en
  `SENSITIVE_SYSTEM_PRIVILEGES`; puede ajustarse.
