# Módulo 2 - Rendimiento de Oracle

El dashboard `/rendimiento` consulta actividad, esperas, SQL en memoria y uso
de recursos de la instancia o PDB seleccionada. No modifica datos de Oracle.

## Endpoints

| Método y ruta | Información |
| --- | --- |
| `GET /api/performance/sessions` | Sesiones de usuario con estado `ACTIVE`, SID, equipo, programa e inicio de sesión |
| `GET /api/performance/blocked-sessions` | Sesiones bloqueadas, instancia y SID bloqueador cuando Oracle los identifica, evento y segundos de espera |
| `GET /api/performance/top-sql` | Hasta 10 SQL_ID ordenados por CPU acumulada |
| `GET /api/performance/query-times` | Hasta 10 SQL_ID ordenados por tiempo transcurrido acumulado, con promedio por ejecución |
| `GET /api/performance/resource-usage` | Hasta 10 sesiones de usuario ordenadas por CPU acumulada, con PGA usada |

Todas las respuestas son listas JSON; una lista vacía significa que no hay filas
que cumplan el filtro, no una falla de conexión. Los errores de configuración,
conexión, permisos o lectura de SQL responden HTTP 503 con un mensaje; el
detalle técnico queda en el log del servidor.

## Vistas y permisos

Las consultas utilizan `V$SESSION`, `V$SQL`, `V$PROCESS`, `V$SESSTAT` y
`V$STATNAME`. Para Oracle XE multitenant, el usuario local `DBA_MONITOR` debe
tener únicamente `SELECT` sobre sus vistas base `SYS.V_$...` en `XEPDB1`.

Como `SYS AS SYSDBA`, ejecutar desde la raíz del repositorio:

```powershell
sqlplus / as sysdba @sql/oracle/performance/setup/grants.sql
```

El script cambia y muestra el contenedor `XEPDB1`, otorga los cinco permisos de
solo lectura y consulta los grants para verificarlos. No concede roles
administrativos ni permisos generales al diccionario. La aplicación debe
conectarse con el perfil configurado para `XEPDB1`.

## Interpretación y límites

- `ACTIVE` identifica el estado de Oracle en el momento de la consulta; una
  sesión activa puede estar ejecutando o esperando un recurso.
- Un bloqueo se lista cuando `V$SESSION.BLOCKING_SESSION` identifica una
  sesión bloqueadora. Oracle puede no identificar un SID para ciertos bloqueos;
  esos casos no se presentan como una relación confirmada.
- `V$SQL` contiene estadísticas de cursores que aún están en la shared pool.
  Los cursores hijos se agregan por `SQL_ID`; sus contadores son acumulados
  desde que el cursor se cargó o volvió a cargar y pueden desaparecer al
  desalojarse de memoria.
- `CPU_TIME` y `ELAPSED_TIME` de `V$SQL` se expresan internamente en
  microsegundos y el SQL los convierte a segundos. El promedio es tiempo
  transcurrido total dividido entre ejecuciones acumuladas; no es una muestra
  instantánea ni necesariamente equivale a latencia de una ejecución aislada.
- `CPU used by this session` se expresa en centésimas de segundo; la consulta
  lo convierte a segundos. Es un contador acumulado desde el inicio de la
  sesión, no CPU instantánea.
- `PGA_USED_MEM` se expresa en bytes y se convierte a MiB. Representa memoria
  privada actualmente usada por el proceso Oracle; no es la PGA completa de la
  instancia ni una cantidad de memoria reservada por el sistema operativo.
- Lecturas de buffer son lecturas lógicas; lecturas de disco son lecturas
  físicas registradas por el cursor.

## Ejecución y pruebas

Desde la raíz, con el entorno virtual y `.env` local configurados:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Abrir `http://127.0.0.1:8000/rendimiento`. Los endpoints también se pueden
probar desde `/docs`.

Las pruebas unitarias no necesitan Oracle:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Para incluir las verificaciones HTTP contra una aplicación en ejecución y
conectada a Oracle, establecer `DBA_MONITOR_TEST_BASE_URL` (por ejemplo,
`http://127.0.0.1:8000`) y ejecutar el mismo comando. Las comprobaciones
integradas se omiten si la variable no está establecida.
