# DBA Monitor

Herramienta web desarrollada para el Proyecto Integrador de EIF402 -
Administración de Bases de Datos.

## Tecnología

- Python
- FastAPI
- python-oracledb
- Oracle Database XE

## Instalación

Consultar:

docs/configuracion-local.md

## Ejecución

uvicorn app.main:app --reload

## Páginas

- GET /                Módulo 1 - Estado general de la instancia
- GET /rendimiento     Módulo 2 - Rendimiento de Oracle
- GET /almacenamiento  Módulo 3 - Gestión del almacenamiento
- GET /respaldos       Módulo 4 - Respaldo y recuperación
- GET /auditoria       Módulo 5 - Auditoría

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

## Documentación

- [Configuración del entorno local](docs/configuracion-local.md)
- [Módulo 2 - Rendimiento de Oracle](docs/modulo-2-rendimiento.md)
- [Flujo de trabajo con Git y GitHub](docs/flujo-git.md)