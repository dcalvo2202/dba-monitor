# Módulo 3 - Gestión del almacenamiento

La página `/almacenamiento` supervisa el espacio que usa la base de datos y
cómo crece con el tiempo.

## Qué muestra

| Información | Origen |
| --- | --- |
| Uso de tablespaces (usado, libre, asignado, máximo) | `DBA_TABLESPACES`, `DBA_DATA_FILES`, `DBA_FREE_SPACE`, `DBA_TEMP_FILES`, `DBA_TEMP_FREE_SPACE` |
| Tamaño de la base de datos | Suma de datos y temporales |
| Archivos de datos (tamaño, máximo, autoextensión, incremento, estado) | `DBA_DATA_FILES`, `DBA_TEMP_FILES` |
| Objetos de mayor tamaño (tablas e índices) | `DBA_SEGMENTS` |
| Crecimiento histórico | Tabla `DBA_MONITOR_HIST.STORAGE_SNAPSHOT` |

Las consultas están en `sql/oracle/storage/`.

## Cómo se interpreta el uso

El porcentaje se mide sobre el **tamaño máximo** del tablespace, considerando
la autoextensión, no sobre lo asignado hoy. Un tablespace puede estar casi
lleno respecto de lo asignado y aun así tener mucho margen para crecer.

| Estado | Condición (uso del máximo) |
| --- | --- |
| Normal | menor de 85 % |
| Advertencia | 85 % o más |
| Crítico | 95 % o más |

Los umbrales son las constantes `TABLESPACE_WARNING_PERCENT` y
`TABLESPACE_CRITICAL_PERCENT` de `app/modules/storage/service.py`.

## Crecimiento: mecanismo documentado

Oracle no guarda un historial del tamaño de la base, por lo que el módulo crea
uno propio:

- La tabla `DBA_MONITOR_HIST.STORAGE_SNAPSHOT` almacena una fila por
  tablespace y medición.
- La tarea `DBA_MONITOR_HIST.STORAGE_SNAPSHOT_DAILY` (`DBMS_SCHEDULER`) toma
  una medición diaria.
- El botón **Registrar medición** (`POST /api/storage/snapshot`) ejecuta el
  procedimiento `DBA_MONITOR_HIST.RECORD_STORAGE_SNAPSHOT` para tomar una
  medición manual.
- Con dos o más mediciones se calcula el crecimiento del periodo, el ritmo por
  día y una estimación del tiempo para alcanzar el máximo.

El historial solo está disponible en `XEPDB1`, donde se creó el esquema
`DBA_MONITOR_HIST`.

## API

| Método y ruta | Descripción |
| --- | --- |
| `GET /api/storage` | Todo junto: `?include_oracle=true&max_objects=20&days=90` |
| `GET /api/storage/tablespaces` | Uso de tablespaces |
| `GET /api/storage/database-size` | Tamaño de la base de datos |
| `GET /api/storage/datafiles` | Archivos de datos |
| `GET /api/storage/large-objects` | Objetos de mayor tamaño (`?include_oracle`, `?max_rows`) |
| `GET /api/storage/growth` | Crecimiento (`?days=90`) |
| `POST /api/storage/snapshot` | Registra una medición |

Por defecto los objetos de mayor tamaño excluyen los esquemas internos de
Oracle; `include_oracle=true` los incluye.

## Preparación

Como `SYS AS SYSDBA`, desde la raíz del repositorio:

```powershell
sqlplus / as sysdba @sql/oracle/storage/setup/grants.sql
sqlplus / as sysdba @sql/oracle/storage/setup/create_storage_history.sql
```

- `grants.sql`: `SELECT` sobre `DBA_TABLESPACES`, `DBA_DATA_FILES`,
  `DBA_FREE_SPACE`, `DBA_TEMP_FILES`, `DBA_TEMP_FREE_SPACE` y `DBA_SEGMENTS`
  para `DBA_MONITOR` (y `C##DBA_MONITOR` en la raíz).
- `create_storage_history.sql`: crea el esquema, la tabla, el procedimiento y
  la tarea diaria, y otorga `EXECUTE` y `SELECT` a `DBA_MONITOR`.

## Limitaciones

- El crecimiento es tan bueno como la cantidad de mediciones guardadas; con
  pocas el ritmo por día es poco representativo.
- La estimación de "días para alcanzar el máximo" es una proyección lineal y
  puede dar valores muy grandes cuando el crecimiento es pequeño.
