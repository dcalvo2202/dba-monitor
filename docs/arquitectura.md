# Arquitectura y decisiones de diseño

## 1. Visión general

DBA Monitor es una aplicación web de tres capas. El navegador solo presenta
datos; la lógica y el acceso a Oracle viven en el servidor.

```text
Navegador (HTML + CSS + JavaScript)
        |  HTTP / JSON
        v
FastAPI
  router.py      Recibe la petición, valida parámetros y traduce errores a HTTP
        |
  service.py     Procesa e interpreta los datos (estados, resúmenes, riesgos)
        |
  repository.py  Lee el archivo SQL del módulo y lo ejecuta
        |
  database/connection.py   Abre la conexión con el perfil activo
        |  python-oracledb
        v
Oracle Database XE  (vistas V$ y DBA_*)
```

Cada módulo repite la misma estructura, por lo que agregar uno nuevo no exige
tocar los existentes: se crea `app/modules/<modulo>/`, una plantilla, un
script de JavaScript y se registra el router en `app/main.py`.

| Capa | Dónde | Responsabilidad |
| --- | --- | --- |
| Presentación | `app/templates/`, `app/static/` | Tablas, tarjetas, gráficos y estados de carga/error |
| Lógica | `app/modules/*/service.py` | Convierte filas crudas en información con contexto |
| Acceso a datos | `app/modules/*/repository.py`, `sql/oracle/` | Ejecuta consultas administrativas; no decide nada |
| Conexión | `app/database/connection.py`, `app/core/` | Perfiles de conexión y credenciales |

## 2. Consultas SQL fuera del código Python

Las consultas administrativas están en `sql/oracle/<modulo>/get_*.sql`, no
incrustadas en cadenas de Python. Así se pueden leer, probar en SQL Developer y
explicar durante la defensa sin abrir el código de la aplicación. Los scripts
de preparación (permisos, datos de prueba, objetos de apoyo) están en
`sql/oracle/<modulo>/setup/`.

## 3. Conexión y configuración

- Las credenciales están en `.env` (variables `DB_*`), que **no** se versiona.
  El repositorio incluye `.env.example`.
- Los perfiles de conexión (por ejemplo `XEPDB1` y `CDB$ROOT`) se definen en
  `config/connections.json`, que tampoco se versiona; la plantilla es
  `config/connections.example.json`. El JSON nunca contiene contraseñas: cada
  perfil nombra la variable de `.env` donde está la suya.
- El selector de instancia de la interfaz cambia el perfil activo. Antes de
  cambiarlo, el servidor valida que la conexión funcione.
- Cada petición abre y cierra su conexión; no se comparten conexiones entre
  peticiones.

Cambiar de instancia o de credenciales no requiere modificar código.

## 4. Seguridad: mínimo privilegio

- La aplicación se conecta con `DBA_MONITOR` (en `XEPDB1`) o `C##DBA_MONITOR`
  (en `CDB$ROOT`). No usa `SYS` ni `SYSTEM`.
- Cada módulo recibe únicamente `SELECT` sobre las vistas que necesita (por
  ejemplo `SYS.V_$SESSION`, `SYS.DBA_TABLESPACES`). No se otorgan privilegios
  `ANY` ni el rol `DBA`.
- Las únicas operaciones que modifican algo son controladas:
  - **Almacenamiento:** registrar una medición mediante el procedimiento
    `DBA_MONITOR_HIST.RECORD_STORAGE_SNAPSHOT`.
  - **Mantenimiento:** recalcular estadísticas y recompilar, solo sobre el
    esquema `MAINT_DEMO`, a través del paquete `MAINT_DEMO.MAINTENANCE_API`
    (ver [módulo 6](modulo-6-mantenimiento.md)).
- Los parámetros que llegan al SQL dinámico se validan con `DBMS_ASSERT`.
- El texto proveniente de la base de datos se escribe en la página con
  `textContent`, nunca con `innerHTML`, para que un dato no pueda inyectar HTML.

## 5. Manejo de errores

- Los errores de configuración, conexión, permisos o lectura de SQL se
  convierten en respuestas HTTP con un mensaje claro (503 para fallas de
  Oracle, 400 para datos inválidos, 403 para operaciones no permitidas, 409
  cuando el módulo no aplica al contenedor seleccionado). El detalle técnico
  queda en el log del servidor y no se muestra al usuario.
- Una lista vacía significa "no hay filas", no "falló la conexión". La
  interfaz distingue ambos casos con mensajes diferentes.
- Cada página muestra el estado de la conexión (Conectado, Datos parciales o
  Error al consultar) y la hora de la última actualización.
- Una sección que falla no tumba a las demás: el resto de la página sigue
  mostrando sus datos.

## 6. Decisiones de diseño y su justificación

| Decisión | Motivo |
| --- | --- |
| FastAPI + Jinja2 | Un solo proceso, documentación automática de la API en `/docs` y poco código de arranque |
| JavaScript sin frameworks | El proyecto es una herramienta de consulta; evita dependencias y un paso de compilación que complicaría la instalación |
| SQL en archivos `.sql` | Se pueden probar y defender por separado del código |
| Un módulo por carpeta | Permite trabajo en paralelo del equipo y agregar módulos sin rediseñar |
| Perfiles de conexión en JSON | Cumple "seleccionar la instancia sin modificar el código fuente" |
| Mínimo privilegio | Un monitor no debe poder dañar lo que observa |
| Gráficos con datos reales | Los gráficos se dibujan con las mismas respuestas de la API; no hay datos de relleno |

## 7. Servidor, instancia y base de datos

Estos tres conceptos se muestran por separado en el módulo 1:

- **Servidor:** el equipo donde corre Oracle (`host_name`).
- **Instancia:** los procesos y la memoria (SGA/PGA) que Oracle levanta, por
  ejemplo `xe`. Se consulta en `V$INSTANCE`.
- **Base de datos:** los archivos que guardan los datos. En Oracle XE es
  multitenant: un contenedor raíz (`CDB$ROOT`) y una base conectable
  (`XEPDB1`), visibles en `V$PDBS`.

Por eso existen dos perfiles de conexión: `XEPDB1` ofrece los datos de la
aplicación y `CDB$ROOT` es el nivel donde Oracle registra los respaldos RMAN.

## 8. Cómo agregar un módulo

1. Crear `app/modules/<modulo>/` con `router.py`, `service.py` y `repository.py`.
2. Escribir las consultas en `sql/oracle/<modulo>/` y el script de permisos en
   `setup/grants.sql`.
3. Crear `app/templates/<modulo>.html` (extiende `base.html`) y
   `app/static/js/<modulo>.js`.
4. Registrar el router en `app/main.py` y el enlace en la lista `modules` de
   `base.html`.
5. Documentar permisos y limitaciones en `docs/`.
