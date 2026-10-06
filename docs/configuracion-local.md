# Configuración local de DBA Monitor

Este documento explica cómo preparar un entorno local para desarrollar y ejecutar el proyecto **DBA Monitor**.

Cada integrante trabaja con una instalación local independiente de Oracle Database XE. La aplicación utiliza archivos de configuración locales para permitir que cada integrante tenga credenciales y parámetros de conexión diferentes sin modificar el código fuente.

---

## 1. Requisitos

Antes de comenzar se necesita tener instalado:

- Git.
- Python.
- Oracle Database XE.
- Una herramienta para administrar Oracle, por ejemplo SQL Developer o SQL*Plus.
- Visual Studio Code o un editor equivalente.

La instalación local de Oracle debe tener disponible la PDB:

```text
XEPDB1
```

Para comprobarlo se puede conectar como `SYS AS SYSDBA` y ejecutar:

```sql
SHOW PDBS;
```

Se espera encontrar `XEPDB1` en estado `READ WRITE`.

---

## 2. Clonar el repositorio

Clonar el repositorio del proyecto:

```powershell
git clone <URL_DEL_REPOSITORIO>
```

Entrar a la carpeta:

```powershell
cd dba-monitor
```

El desarrollo del equipo se integra en la rama `develop`.

Cambiar a esa rama:

```powershell
git checkout develop
```

Actualizarla:

```powershell
git pull origin develop
```

No se recomienda desarrollar directamente sobre `main` o `develop`. Para nuevas funcionalidades se deben crear ramas `feature/...`.

---

## 3. Crear el entorno virtual de Python

Desde la raíz del proyecto ejecutar:

```powershell
python -m venv .venv
```

Activar el entorno:

```powershell
.venv\Scripts\Activate.ps1
```

Cuando el entorno esté activo, la terminal debería mostrar algo parecido a:

```text
(.venv) PS C:\...\dba-monitor>
```

### Error de política de ejecución de PowerShell

En algunos equipos Windows puede aparecer un mensaje indicando que la ejecución de scripts está deshabilitada.

En ese caso se puede habilitar únicamente para la terminal actual:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Después volver a ejecutar:

```powershell
.venv\Scripts\Activate.ps1
```

El alcance `Process` hace que el cambio desaparezca al cerrar esa sesión de PowerShell.

---

## 4. Instalar las dependencias

Con el entorno virtual activo ejecutar:

```powershell
pip install -r requirements.txt
```

No es necesario instalar manualmente cada biblioteca del proyecto.

El archivo `requirements.txt` contiene las dependencias necesarias para reproducir el entorno utilizado durante el desarrollo.

Entre las dependencias actuales se encuentran:

- FastAPI.
- Uvicorn.
- python-oracledb.
- python-dotenv.

Actualmente `python-oracledb` se utiliza en modo Thin, por lo que no es necesario instalar Oracle Instant Client para ejecutar la aplicación.

---

## 5. Preparar Oracle Database XE

La aplicación no debe conectarse utilizando las cuentas administrativas `SYS` o `SYSTEM`.

Cada integrante debe crear localmente una cuenta dedicada llamada:

```text
DBA_MONITOR
```

Esta cuenta utiliza el principio de mínimo privilegio. Solamente recibe los permisos requeridos por las funcionalidades actualmente implementadas.

### 5.1 Conectarse como SYS

Crear o utilizar una conexión:

```text
Usuario: SYS
Rol: SYSDBA
```

### 5.2 Seleccionar XEPDB1

Ejecutar:

```sql
ALTER SESSION SET CONTAINER = XEPDB1;
```

Verificar el contenedor:

```sql
SELECT SYS_CONTEXT('USERENV', 'CON_NAME') AS contenedor_actual
FROM dual;
```

El resultado debe ser:

```text
XEPDB1
```

### 5.3 Crear DBA_MONITOR

Crear el usuario con una contraseña local:

```sql
CREATE USER DBA_MONITOR
IDENTIFIED BY "CONTRASEÑA_LOCAL";
```

Cada integrante puede utilizar una contraseña diferente.

Las contraseñas reales no deben almacenarse en Git.

### 5.4 Permitir inicio de sesión

Ejecutar:

```sql
GRANT CREATE SESSION TO DBA_MONITOR;
```

### 5.5 Permisos requeridos por el Módulo 1 - Estado de la instancia

El Módulo 1 consulta vistas dinámicas de rendimiento (`V$`). En Oracle, `V$INSTANCE` es un sinónimo público de la vista `SYS.V_$INSTANCE`; por eso el privilegio se otorga sobre `V_$...`.

Conceder únicamente los privilegios necesarios:

```sql
GRANT SELECT ON SYS.V_$INSTANCE TO DBA_MONITOR;  -- identificación, estado y tiempo de actividad
GRANT SELECT ON SYS.V_$SGA      TO DBA_MONITOR;  -- memoria SGA asignada
GRANT SELECT ON SYS.V_$SGASTAT  TO DBA_MONITOR;  -- memoria SGA libre
GRANT SELECT ON SYS.V_$PGASTAT  TO DBA_MONITOR;  -- memoria PGA asignada y en uso
GRANT SELECT ON SYS.V_$PDBS     TO DBA_MONITOR;  -- bases de datos (PDBs) visibles
```

### 5.6 Permisos requeridos por el Módulo 5 - Auditoría

El Módulo 5 consulta vistas `DBA_*` del diccionario de datos. Los privilegios están en un script que fija y verifica el contenedor `XEPDB1`.

Desde la raíz del proyecto:

```powershell
sqlplus / as sysdba
```

```sql
@sql/oracle/audit/setup/grants.sql
```

El script otorga `SELECT` sobre `DBA_USERS`, `DBA_ROLES`, `DBA_ROLE_PRIVS`, `DBA_SYS_PRIVS`, `DBA_TAB_PRIVS`, `DBA_OBJECTS` y `DBA_ERRORS`.

#### Datos de prueba de auditoría

Una instalación limpia de Oracle XE no tiene objetos inválidos. Para demostrar el módulo con información real, ejecutar una vez (también como `SYS AS SYSDBA`):

```sql
@sql/oracle/audit/setup/demo_objects.sql
```

Crea en `XEPDB1` el usuario sin contraseña `AUDIT_DEMO` (schema-only), tres roles (dos anidados, uno de ellos alcanzable por dos caminos, y uno no predeterminado) y tres objetos inválidos con errores de compilación. Los mensajes `Warning: ... compilation errors` son el resultado esperado. El script puede ejecutarse varias veces: elimina el escenario anterior antes de recrearlo. Al final incluye la reversión (`DROP USER AUDIT_DEMO CASCADE` y `DROP ROLE ...`).

### 5.7 Privilegios actuales de DBA_MONITOR

Con los módulos actuales, la cuenta queda limitada a:

```text
CREATE SESSION
SELECT ON SYS.V_$INSTANCE, SYS.V_$SGA, SYS.V_$SGASTAT, SYS.V_$PGASTAT, SYS.V_$PDBS
SELECT ON SYS.DBA_USERS, SYS.DBA_ROLES, SYS.DBA_ROLE_PRIVS, SYS.DBA_SYS_PRIVS,
          SYS.DBA_TAB_PRIVS, SYS.DBA_OBJECTS, SYS.DBA_ERRORS
```

Para comprobarlos, conectado como `DBA_MONITOR`:

```sql
SELECT privilege FROM user_sys_privs;
SELECT table_name, privilege FROM user_tab_privs ORDER BY table_name;
```

No se debe ejecutar:

```sql
GRANT DBA TO DBA_MONITOR;
```

ni conceder permisos generales del diccionario solamente para evitar errores.

Los nuevos privilegios se incorporarán conforme cada módulo los necesite y deberán documentarse junto con la funcionalidad que los requiere.

---

## 6. Verificar DBA_MONITOR

Crear una conexión en SQL Developer con:

```text
Usuario: DBA_MONITOR
Host: localhost
Puerto: 1521
Service name: XEPDB1
```

Probar:

```sql
SELECT
    instance_name,
    host_name,
    version,
    status,
    startup_time
FROM v$instance;
```

La consulta debe devolver información de la instancia Oracle local.

Si aparece:

```text
ORA-00942: table or view does not exist
```

se debe comprobar que:

1. El usuario está conectado a `XEPDB1`.
2. El `GRANT SELECT ON SYS.V_$INSTANCE` fue ejecutado en `XEPDB1`.

---

## 7. Configurar las variables de entorno

El repositorio contiene:

```text
.env.example
```

Este archivo sirve como plantilla y sí se almacena en Git.

Cada integrante debe crear en la raíz del proyecto su propio archivo:

```text
.env
```

con la configuración de su instalación:

```env
DB_HOST=localhost
DB_PORT=1521
DB_SERVICE=XEPDB1
DB_USER=DBA_MONITOR
DB_PASSWORD=CONTRASEÑA_LOCAL
```

La contraseña debe corresponder a la definida al crear `DBA_MONITOR`.

### Importante

```text
.env.example    Se almacena en Git
.env            NO se almacena en Git
```

El `.gitignore` del proyecto ya excluye `.env`.

Nunca se deben incluir contraseñas reales, cuentas administrativas o información sensible en commits.

### 7.1 Perfiles de conexión (selector de instancia) — opcional

El encabezado de la aplicación tiene un selector **Instancia** que permite cambiar la instancia o contenedor monitoreado sin modificar el código (requisito del Módulo 1).

Sin configuración adicional, la aplicación usa un único perfil con los datos de `.env`. Para tener varios perfiles (por ejemplo, la PDB `XEPDB1` y el contenedor raíz `CDB$ROOT`):

1. Crear el usuario común para la raíz, como `SYS AS SYSDBA` desde la raíz del proyecto. El script pide la contraseña sin mostrarla:

```sql
@sql/oracle/connections/setup/create_cdb_monitor.sql
```

2. Agregar esa contraseña al `.env`:

```env
DB_PASSWORD_CDB=CONTRASEÑA_LOCAL_CDB
```

3. Crear el archivo local de perfiles a partir de la plantilla:

```powershell
copy config\connections.example.json config\connections.json
```

4. Reiniciar uvicorn.

```text
config/connections.example.json   Se almacena en Git (plantilla, sin contraseñas)
config/connections.json           NO se almacena en Git (cada integrante tiene el suyo)
```

Las contraseñas nunca van en el JSON: cada perfil indica en `password_env` qué variable del `.env` la contiene. Al cambiar de perfil, la aplicación prueba la conexión antes de activarlo; si falla, mantiene el perfil anterior y muestra el motivo.

**¿Por qué un usuario común `C##`?** `DBA_MONITOR` es un usuario local de `XEPDB1` y no existe en la raíz. Para conectarse a `CDB$ROOT` se necesita un usuario común, cuyo nombre empieza por `C##`. Sus privilegios se otorgan con `CONTAINER = CURRENT`, por lo que solo valen en la raíz.

---

## 8. Probar la conexión desde Python

Con el entorno virtual activo se puede comprobar la conexión ejecutando:

```powershell
python -c "from app.database.connection import get_connection; connection = get_connection(); print('Conexión exitosa a Oracle:', connection.version); connection.close()"
```

Un resultado correcto será similar a:

```text
Conexión exitosa a Oracle: 21.3.0.0.0
```

La versión puede variar según la instalación local.

---

## 9. Ejecutar DBA Monitor

Desde la raíz del proyecto y con el entorno virtual activo:

```powershell
uvicorn app.main:app --reload
```

Si inicia correctamente, Uvicorn mostrará una dirección similar a:

```text
http://127.0.0.1:8000
```

---

## 10. Verificar la aplicación

### Página raíz

Abrir:

```text
http://localhost:8000
```

Actualmente devuelve un mensaje confirmando que DBA Monitor está funcionando.

### Documentación de la API

Abrir:

```text
http://localhost:8000/docs
```

FastAPI presenta desde esta dirección los endpoints disponibles.

### Estado de la instancia

Abrir:

```text
http://localhost:8000/api/instance
```

Se debe obtener información real del Oracle XE instalado en el equipo.

Un resultado aproximado es:

```json
{
    "instance_name": "xe",
    "host_name": "NOMBRE-PC",
    "version": "21.0.0.0.0",
    "status": "OPEN",
    "startup_time": "2026-09-02T18:31:28",
    "uptime_seconds": 265078,
    "uptime": "3d 1h 37m 58s"
}
```

Los valores deben corresponder a la instalación Oracle del integrante y no a información simulada.

---

## 11. Arquitectura actual

La consulta implementada sigue el siguiente flujo:

```text
Navegador
    |
    v
FastAPI Router
    |
    v
Service
    |
    v
Repository
    |
    v
connection.py
    |
    v
DBA_MONITOR
    |
    v
Oracle Database XE
```

Las responsabilidades se mantienen separadas:

```text
app/core/config.py
    Lee la configuración del entorno.

app/database/connection.py
    Administra la creación de conexiones con Oracle.

app/modules/instance/repository.py
    Obtiene la información almacenada en Oracle.

app/modules/instance/service.py
    Procesa e interpreta la información obtenida.

app/modules/instance/router.py
    Expone las funcionalidades mediante HTTP.

sql/oracle/instance/
    Contiene las consultas administrativas SQL del módulo.
```

El objetivo es mantener una estructura modular y evitar mezclar consultas SQL, conexión, lógica y presentación dentro de un mismo archivo.

---

## 12. Seguridad y principio de mínimo privilegio

DBA Monitor utiliza una cuenta propia en lugar de `SYS` o `SYSTEM`.

El objetivo es reducir el impacto que podría tener un problema en la aplicación o la exposición de sus credenciales.

Actualmente:

| Módulo | Necesidad | Privilegio |
| --- | --- | --- |
| General | Conectarse a Oracle | `CREATE SESSION` |
| 1 - Instancia | Identificación, estado y tiempo de actividad | `SELECT ON SYS.V_$INSTANCE` |
| 1 - Instancia | Memoria SGA asignada y libre | `SELECT ON SYS.V_$SGA`, `SYS.V_$SGASTAT` |
| 1 - Instancia | Memoria PGA | `SELECT ON SYS.V_$PGASTAT` |
| 1 - Instancia | Bases de datos (PDBs) | `SELECT ON SYS.V_$PDBS` |
| 5 - Auditoría | Usuarios registrados | `SELECT ON SYS.DBA_USERS` |
| 5 - Auditoría | Roles y su asignación | `SELECT ON SYS.DBA_ROLES`, `SYS.DBA_ROLE_PRIVS` |
| 5 - Auditoría | Privilegios de sistema y de objeto | `SELECT ON SYS.DBA_SYS_PRIVS`, `SYS.DBA_TAB_PRIVS` |
| 5 - Auditoría | Objetos inválidos y errores de compilación | `SELECT ON SYS.DBA_OBJECTS`, `SYS.DBA_ERRORS` |

Se otorgan privilegios sobre vistas concretas y no roles amplios como `DBA`, `SELECT_CATALOG_ROLE` o el privilegio `SELECT ANY DICTIONARY`, que darían acceso a todo el diccionario de datos.

Esta tabla debe actualizarse cuando se incorporen nuevas consultas administrativas.

No se deben otorgar privilegios adicionales sin identificar primero qué funcionalidad los requiere.

---

## 13. Flujo básico de Git

El procedimiento utilizado por el equipo para ramas, commits, Pull Requests y merges se encuentra documentado en:

`docs/flujo-git.md`

---

## 14. Problemas conocidos

### PowerShell bloquea Activate.ps1

Usar temporalmente:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### ORA-00942 al consultar V$INSTANCE

Comprobar el privilegio:

```sql
GRANT SELECT ON SYS.V_$INSTANCE TO DBA_MONITOR;
```

y verificar que fue concedido desde `XEPDB1`.

### V$PDBS vacía desde el perfil CDB$ROOT

En la raíz, las vistas `V$` de un usuario común solo muestran los contenedores autorizados con el atributo `CONTAINER_DATA` (por defecto, solo la raíz). El script `create_cdb_monitor.sql` ya lo configura; si el usuario se creó antes, ejecutar como `SYS`:

```sql
ALTER USER C##DBA_MONITOR SET CONTAINER_DATA = ALL CONTAINER = CURRENT;
```

### Una página nueva responde "Not Found" después de un pull

En Windows, `uvicorn --reload` a veces no detecta los cambios que llegan con `git pull` o al cambiar de rama. Detener el servidor con `Ctrl+C` y volver a ejecutar `uvicorn app.main:app --reload`.

### Las tipografías no cargan sin internet

La interfaz usa las fuentes Fira Sans y Fira Code desde Google Fonts. Sin conexión a internet la aplicación funciona igual: el navegador usa automáticamente fuentes del sistema (Segoe UI, Consolas).

### Ícono de la pestaña

El ícono de la pestaña está definido en `base.html` como SVG en línea, por lo que ya no aparece el error `GET /favicon.ico 404 Not Found` en el registro del servidor.

---

## 15. Estado actual del proyecto

Actualmente se encuentra implementado:

- Estructura inicial del proyecto.
- Aplicación FastAPI.
- Configuración externa mediante `.env`.
- Conexión con Oracle Database XE.
- Cuenta dedicada `DBA_MONITOR`.
- Aplicación inicial del principio de mínimo privilegio.
- Consulta básica de `V$INSTANCE`.
- Información de servidor e instancia.
- Versión de Oracle.
- Estado de la instancia.
- Fecha de inicio.
- Tiempo de actividad de la instancia.
- Endpoint `/api/instance`.
- Plantilla base del frontend (`base.html`) compartida por todos los módulos, con tema claro/oscuro, actualización automática opcional, menú adaptable a móvil y navegación accesible por teclado.
- Módulo 5 - Auditoría (`/auditoria`): usuarios, roles, privilegios directos y heredados por roles, y objetos inválidos con sus errores de compilación.
- Perfiles de conexión: selector de instancia en el encabezado (PDB `XEPDB1` y raíz `CDB$ROOT` con el usuario común `C##DBA_MONITOR`).

Los demás requerimientos del Módulo 1 y los módulos posteriores se incorporarán progresivamente.