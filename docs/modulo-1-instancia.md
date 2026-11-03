# Módulo 1 - Estado general de la instancia

La página `/` muestra si la instancia Oracle está viva, desde cuándo, cuánta
memoria usa y qué bases de datos administra. Es también donde se elige la
instancia monitoreada.

## Qué muestra

| Información | Origen |
| --- | --- |
| Servidor, instancia, versión, estado, fecha de inicio | `V$INSTANCE` |
| Base de datos y servicio (contenedor actual) | `SYS_CONTEXT('USERENV', ...)` |
| Tiempo de actividad | Se calcula en el servicio a partir de la fecha de inicio |
| Memoria SGA asignada, libre y utilizada | `V$SGA`, `V$SGASTAT` |
| Memoria PGA asignada y en uso | `V$PGASTAT` |
| Composición de la SGA (gráfico) | `V$SGASTAT` |
| Pluggable Databases visibles | `V$PDBS` |

Las consultas están en `sql/oracle/instance/`:
`get_instance_info.sql`, `get_memory_info.sql`, `get_sga_components.sql` y
`get_pdbs.sql`.

## Servidor, instancia y base de datos

La página muestra los tres conceptos por separado (ver
[arquitectura](arquitectura.md), sección 7). En Oracle XE multitenant hay un
contenedor raíz `CDB$ROOT` y una base conectable `XEPDB1`. Por eso `V$PDBS`
puede aparecer vacía desde ciertos perfiles, y la página lo indica sin tratarlo
como un error.

## Selección de la instancia

El selector del encabezado cambia el perfil de conexión activo sin tocar el
código:

1. Los perfiles se leen de `config/connections.json` (plantilla en
   `config/connections.example.json`). Si el archivo no existe, se crea un
   único perfil con las variables `DB_*` del `.env`.
2. Al elegir otro perfil, `PUT /api/connections/active` valida que la conexión
   funcione **antes** de activarlo; si falla, el perfil anterior sigue activo y
   se muestra el motivo.
3. Las contraseñas nunca están en el JSON: cada perfil nombra la variable de
   `.env` que la contiene.

## API

| Método y ruta | Descripción |
| --- | --- |
| `GET /api/instance` | Estado, memoria, composición de la SGA y PDBs |
| `GET /api/connections` | Perfiles disponibles y el activo (sin contraseñas) |
| `PUT /api/connections/active` | Cambia la instancia monitoreada: `{"name": "cdb_root"}` |

## Permisos

Solo `SELECT` sobre las vistas base, otorgado a `DBA_MONITOR`:

```sql
GRANT SELECT ON SYS.V_$INSTANCE TO DBA_MONITOR;
GRANT SELECT ON SYS.V_$SGA      TO DBA_MONITOR;
GRANT SELECT ON SYS.V_$SGASTAT  TO DBA_MONITOR;
GRANT SELECT ON SYS.V_$PGASTAT  TO DBA_MONITOR;
GRANT SELECT ON SYS.V_$PDBS     TO DBA_MONITOR;
```

`V$INSTANCE` es un sinónimo público de `SYS.V_$INSTANCE`; por eso el permiso se
otorga sobre la vista base. Los comandos completos están en la sección 5.5 de
[configuracion-local.md](configuracion-local.md).

## Limitaciones

- La memoria "utilizada" es una **estimación** (SGA utilizada más PGA en uso),
  porque Oracle no expone un único valor de memoria utilizada por la instancia.
- Un 98 % de uso de SGA es normal: Oracle reserva la SGA completa al iniciar y
  la reparte internamente.
