# DBA Monitor

Herramienta web para el monitoreo, la administración y el mantenimiento
preventivo de **Oracle Database**, desarrollada como Proyecto Integrador de
EIF402 - Administración de Bases de Datos (Universidad Nacional, II Ciclo 2026).

Caso de estudio: el equipo actúa como consultor de *DataSolutions Costa Rica
S.A.*, que necesita centralizar el estado de sus bases de datos Oracle. Todos
los datos que muestra la aplicación se consultan en vivo a las vistas
administrativas de Oracle; no hay datos simulados.

## Módulos

| # | Módulo | Página | Qué permite |
| --- | --- | --- | --- |
| 1 | Estado general de la instancia | `/` | Servidor, instancia, versión, estado, inicio, tiempo activo, memoria (SGA/PGA) y PDBs. Selector de instancia |
| 2 | Monitoreo de rendimiento | `/rendimiento` | SQL de mayor consumo, tiempos de ejecución, sesiones activas y bloqueadas, CPU y memoria por sesión |
| 3 | Gestión del almacenamiento | `/almacenamiento` | Tablespaces, tamaño de la base, archivos de datos, objetos más grandes y crecimiento histórico |
| 4 | Respaldo y recuperación | `/respaldos` | Último respaldo exitoso, tipo, estado, historial RMAN y evaluación de riesgo |
| 5 | Auditoría | `/auditoria` | Usuarios, roles, privilegios y objetos inválidos con sus errores |
| 6 | Mantenimiento preventivo | `/mantenimiento` | Recalcular estadísticas, detectar objetos inválidos y recompilarlos |

## Tecnología

- Python 3 y FastAPI (API y plantillas Jinja2)
- python-oracledb (conexión a Oracle)
- HTML, CSS y JavaScript sin frameworks en el navegador
- Oracle Database XE 21c (multitenant: `XE` / `XEPDB1`)

## Inicio rápido

La guía completa, con todos los permisos de Oracle, está en
[docs/configuracion-local.md](docs/configuracion-local.md). Resumen:

```powershell
git clone https://github.com/dcalvo2202/dba-monitor.git
cd dba-monitor
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env          # completar usuario y contraseña de Oracle
copy config\connections.example.json config\connections.json
uvicorn app.main:app --reload
```

Después abrir <http://127.0.0.1:8000>.

Antes de usar la aplicación hay que preparar Oracle **una sola vez**, como
`SYS AS SYSDBA`, desde la raíz del repositorio. Sin estos scripts algunos
módulos responden `ORA-00942` (la vista no existe o falta el permiso):

| Módulo | Script |
| --- | --- |
| Usuario de monitoreo | sección 5 de [configuracion-local.md](docs/configuracion-local.md) |
| 1 - Instancia | sección 5.5 de [configuracion-local.md](docs/configuracion-local.md) |
| 2 - Rendimiento | `sql/oracle/performance/setup/grants.sql` |
| 3 - Almacenamiento | `sql/oracle/storage/setup/grants.sql` y `create_storage_history.sql` |
| 4 - Respaldos | `sql/oracle/backup/setup/grants.sql` (y `demo_backups.cmd` para datos de prueba) |
| 5 - Auditoría | `sql/oracle/audit/setup/grants.sql` (y `demo_objects.sql` para datos de prueba) |
| 6 - Mantenimiento | `sql/oracle/maintenance/setup/setup_maintenance.sql` |
| Perfil CDB$ROOT (opcional) | `sql/oracle/connections/setup/create_cdb_monitor.sql` |

Tras un `git pull` hay que reiniciar `uvicorn`.

## Estructura del repositorio

```text
app/
  main.py                 Aplicación FastAPI y registro de módulos
  core/                   Configuración (.env) y perfiles de conexión
  database/connection.py  Creación de conexiones a Oracle
  modules/<modulo>/       router.py (HTTP) -> service.py (lógica) -> repository.py (SQL)
  templates/              Páginas HTML (base.html + una por módulo)
  static/                 CSS y JavaScript de cada módulo
sql/oracle/<modulo>/      Consultas administrativas (get_*.sql) y scripts setup/
config/                   Plantilla de perfiles de conexión
docs/                     Documentación técnica y manual de usuario
tests/                    Pruebas automatizadas
```

## Endpoints de la API

La documentación interactiva de todos los endpoints está en `/docs`.

| Módulo | Endpoint | Descripción |
| --- | --- | --- |
| 1 - Instancia | GET /api/instance | Estado, memoria y PDBs de la instancia |
| 1 - Instancia | GET /api/connections | Perfiles de conexión disponibles y el activo (sin contraseñas) |
| 1 - Instancia | PUT /api/connections/active | Cambia la instancia monitoreada (`{"name": "cdb_root"}`); valida la conexión antes |
| 2 - Rendimiento | GET /api/performance/sessions, /blocked-sessions | Sesiones activas y sesiones bloqueadas |
| 2 - Rendimiento | GET /api/performance/top-sql | SQL de mayor consumo de CPU |
| 2 - Rendimiento | GET /api/performance/query-times | Tiempo total y promedio de ejecución SQL |
| 2 - Rendimiento | GET /api/performance/resource-usage | CPU acumulada y PGA usada por sesión |
| 3 - Almacenamiento | GET /api/storage | Tamaño, tablespaces, archivos de datos, objetos de mayor tamaño y crecimiento (`?include_oracle=true&max_objects=20&days=90`) |
| 3 - Almacenamiento | GET /api/storage/tablespaces, /database-size, /datafiles, /large-objects, /growth | Cada sección por separado |
| 3 - Almacenamiento | POST /api/storage/snapshot | Registra una medición en el historial (procedimiento `DBA_MONITOR_HIST.RECORD_STORAGE_SNAPSHOT`) |
| 4 - Respaldos | GET /api/backup | Último respaldo exitoso, modo de archivado, FRA, evaluación de riesgo e historial (`?max_rows=50`). Usar el perfil CDB$ROOT |
| 4 - Respaldos | GET /api/backup/history | Solo el historial de trabajos RMAN (`?max_rows=50`) |
| 5 - Auditoría | GET /api/audit/users | Usuarios y hallazgos de seguridad (`?include_oracle=true` incluye cuentas internas) |
| 5 - Auditoría | GET /api/audit/users/{username}/privileges | Roles y privilegios directos y heredados (`?privilege_type=SISTEMA\|OBJETO&max_rows=200`) |
| 5 - Auditoría | GET /api/audit/roles | Roles y su asignación |
| 5 - Auditoría | GET /api/audit/invalid-objects | Objetos inválidos con errores de compilación |
| 6 - Mantenimiento | GET /api/maintenance/statistics | Estadísticas de las tablas del esquema `MAINT_DEMO` |
| 6 - Mantenimiento | GET /api/maintenance/invalid-objects | Objetos inválidos del esquema `MAINT_DEMO` |
| 6 - Mantenimiento | POST /api/maintenance/update-statistics | Recalcula las estadísticas de una tabla (`{"owner", "table_name", "confirm": true}`) |
| 6 - Mantenimiento | POST /api/maintenance/recompile | Recompila un objeto inválido (`{"owner", "object_name", "object_type", "confirm": true}`) |

## Limitaciones conocidas

- **Respaldos (módulo 4):** Oracle registra los respaldos RMAN a nivel de CDB,
  por lo que el historial solo aparece con el perfil **CDB$ROOT**. Desde
  `XEPDB1` la página lo indica y no muestra un diagnóstico falso.
- **Mantenimiento (módulo 6):** las operaciones que modifican datos se limitan
  al esquema de demostración `MAINT_DEMO` y a la instancia `XEPDB1`, por el
  principio de mínimo privilegio (ver [módulo 6](docs/modulo-6-mantenimiento.md)).
- **Estadísticas de SQL (módulo 2):** vienen de `V$SQL`, que solo conserva
  los cursores que siguen en memoria; no es un historial completo.

## Documentación

- [Manual de usuario](docs/manual-de-usuario.md)
- [Arquitectura y decisiones de diseño](docs/arquitectura.md)
- [Configuración del entorno local](docs/configuracion-local.md)
- [Módulo 2 - Rendimiento de Oracle](docs/modulo-2-rendimiento.md)
- [Módulo 6 - Mantenimiento preventivo](docs/modulo-6-mantenimiento.md)
- [Evidencias de pruebas](docs/evidencias-pruebas.md)
- [Bitácora del proyecto](docs/bitacora.md)
- [Guía de la exposición](docs/guia-exposicion.md)
- [Presentación de la exposición final (PDF)](docs/presentacion/DBA-Monitor-presentacion.pdf)
- [Flujo de trabajo con Git y GitHub](docs/flujo-git.md)

## Pruebas

```powershell
python -m unittest tests.test_performance_repository tests.test_performance_service tests.test_performance_router
```

`tests/test_performance_http.py` consulta un servidor en ejecución, por lo que
se corre aparte con la aplicación iniciada.

## Equipo

| Integrante | Usuario de GitHub |
| --- | --- |
| Sebastián Benavides Madrigal | Killazz17 |
| David Andrés Calvo Hernández | dcalvo2202 |
| Camila Pastor | CamilaPastor |
| Francisco Elizondo | Franco-1407 |

## Seguridad

El repositorio no contiene contraseñas. Las credenciales viven en `.env` y
`config/connections.json`, ambos fuera del control de versiones; se incluyen
`.env.example` y `config/connections.example.json` como plantillas.
