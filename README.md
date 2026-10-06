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

- GET /            Módulo 1 - Estado general de la instancia
- GET /auditoria   Módulo 5 - Auditoría

## Endpoints de la API

La documentación interactiva de todos los endpoints está en `/docs`.

| Módulo | Endpoint | Descripción |
| --- | --- | --- |
| 1 - Instancia | GET /api/instance | Estado, memoria y PDBs de la instancia |
| 1 - Instancia | GET /api/connections | Perfiles de conexión disponibles y el activo (sin contraseñas) |
| 1 - Instancia | PUT /api/connections/active | Cambia la instancia monitoreada (`{"name": "cdb_root"}`); valida la conexión antes |
| 5 - Auditoría | GET /api/audit/users | Usuarios y hallazgos de seguridad (`?include_oracle=true` incluye cuentas internas) |
| 5 - Auditoría | GET /api/audit/users/{username}/privileges | Roles y privilegios directos y heredados (`?privilege_type=SISTEMA\|OBJETO&max_rows=200`) |
| 5 - Auditoría | GET /api/audit/roles | Roles y su asignación |
| 5 - Auditoría | GET /api/audit/invalid-objects | Objetos inválidos con errores de compilación |

## Documentación

- [Configuración del entorno local](docs/configuracion-local.md)
- [Flujo de trabajo con Git y GitHub](docs/flujo-git.md)