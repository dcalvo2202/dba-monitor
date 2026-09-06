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

### 5.5 Permiso requerido actualmente para el Módulo 1

La primera funcionalidad implementada consulta información de la instancia mediante `V$INSTANCE`.

Conceder únicamente el privilegio necesario:

```sql
GRANT SELECT ON SYS.V_$INSTANCE TO DBA_MONITOR;
```

Los privilegios actuales de la cuenta quedan limitados a:

```text
CREATE SESSION
SELECT ON SYS.V_$INSTANCE
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

| Necesidad | Privilegio |
| --- | --- |
| Conectarse a Oracle | `CREATE SESSION` |
| Consultar estado básico de la instancia | `SELECT ON SYS.V_$INSTANCE` |

Esta tabla debe actualizarse cuando se incorporen nuevas consultas administrativas.

No se deben otorgar privilegios adicionales sin identificar primero qué funcionalidad los requiere.

---

## 13. Flujo básico de Git

Antes de comenzar una funcionalidad:

```powershell
git checkout develop
git pull origin develop
```

Crear una rama propia:

```powershell
git checkout -b feature/nombre-funcionalidad
```

Ejemplos:

```text
feature/modulo-estado-instancia
feature/monitoreo-rendimiento
feature/gestion-almacenamiento
```

Realizar commits pequeños y descriptivos.

Ejemplos:

```text
feat: agregar consulta de estado de la instancia
fix: corregir manejo de conexión con Oracle
docs: actualizar configuración local
refactor: separar procesamiento de métricas
```

Cuando la funcionalidad esté completa se debe subir la rama y crear un Pull Request hacia `develop`.

No subir archivos `.env`, contraseñas ni credenciales reales.

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

### GET /favicon.ico devuelve 404

El navegador solicita automáticamente un favicon.

Actualmente el proyecto todavía no define uno, por lo que:

```text
GET /favicon.ico 404 Not Found
```

es normal y no representa un fallo de la API.

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

Los demás requerimientos del Módulo 1 y los módulos posteriores se incorporarán progresivamente.