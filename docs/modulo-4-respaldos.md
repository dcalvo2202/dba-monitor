# Módulo 4 - Respaldo y recuperación

La página `/respaldos` permite verificar el estado de los respaldos RMAN y la
capacidad de recuperación de la base de datos.

## Qué muestra

| Información | Origen |
| --- | --- |
| Último respaldo exitoso (base de datos y archived logs) | `V$RMAN_BACKUP_JOB_DETAILS` |
| Tipo, estado, duración y tamaño de cada trabajo | `V$RMAN_BACKUP_JOB_DETAILS`, `V$BACKUP_SET_DETAILS` |
| Historial de respaldos | `V$RMAN_BACKUP_JOB_DETAILS` |
| Modo de archivado | `V$DATABASE` |
| Fast Recovery Area (ruta, límite, uso, archivos) | `V$RECOVERY_FILE_DEST` |
| Interpretación de riesgo | Calculada en `app/modules/backup/service.py` |

Las consultas están en `sql/oracle/backup/`:
`get_last_successful_backups.sql`, `get_backup_jobs.sql` y
`get_recovery_config.sql`.

## Por qué se usa el perfil CDB$ROOT

Oracle registra los respaldos RMAN a nivel de **CDB**. Desde una PDB como
`XEPDB1`, `V$RMAN_BACKUP_JOB_DETAILS` aparece vacía aunque existan respaldos.
Por eso el módulo se consulta con el perfil `CDB$ROOT` (usuario común
`C##DBA_MONITOR`). Desde `XEPDB1` la página informa que no hay datos y no
emite un diagnóstico falso.

## Interpretación de riesgo

El servicio convierte los datos en un diagnóstico legible, en lugar de mostrar
filas sin contexto. Cada hallazgo lleva un nivel (Correcto, Info,
Advertencia o Crítico) y una explicación. Se evalúa:

- **Antigüedad del último respaldo de la base de datos:** advertencia si pasan
  24 horas y crítico si pasan 7 días.
- **Archived logs:** advertencia si el último respaldo supera las 24 horas.
- **Trabajos fallidos:** el trabajo más reciente con estado fallido o con
  errores genera una advertencia, y los fallidos anteriores se indican como
  información.
- **Modo de archivado:** `ARCHIVELOG` permite recuperar hasta el último cambio;
  `NOARCHIVELOG` se señala como riesgo.
- **Fast Recovery Area:** se informa su porcentaje de uso respecto del límite.

El riesgo global (por ejemplo "Medio") resume el peor hallazgo.

## API

| Método y ruta | Descripción |
| --- | --- |
| `GET /api/backup` | Último respaldo, configuración, evaluación e historial (`?max_rows=50`) |
| `GET /api/backup/history` | Solo el historial de trabajos (`?max_rows=50`) |

## Preparación

Como `SYS AS SYSDBA`, desde la raíz del repositorio:

```powershell
sqlplus / as sysdba @sql/oracle/backup/setup/grants.sql
```

Otorga únicamente `SELECT` sobre `V$RMAN_BACKUP_JOB_DETAILS`,
`V$BACKUP_SET_DETAILS`, `V$DATABASE` y `V$RECOVERY_FILE_DEST`: el usuario puede
**ver** los respaldos, pero no ejecutarlos ni borrarlos.

Para tener datos reales de demostración:

1. `sql/oracle/backup/setup/enable_archivelog.sql`: activa el modo ARCHIVELOG y
   configura la Fast Recovery Area. **Reinicia la instancia.**
2. `sql/oracle/backup/setup/demo_backups.cmd`: ejecuta con RMAN un respaldo
   incremental nivel 0, uno nivel 1, uno de archived logs y un respaldo
   **fallido a propósito** (error `ORA-19504`, resultado esperado) para
   demostrar el diagnóstico. Los scripts RMAN están en la misma carpeta.

Más detalle en la sección 5.7 de [configuracion-local.md](configuracion-local.md).

## Limitaciones

- Solo hay datos con el perfil `CDB$ROOT`.
- La vista conserva el historial según la retención del archivo de control de
  Oracle; no es un historial ilimitado.
- La aplicación **no ejecuta ni restaura** respaldos; solo los supervisa.
