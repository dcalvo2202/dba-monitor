# Módulo 6 - Mantenimiento preventivo

La página `/mantenimiento` permite recalcular estadísticas de tablas, detectar
objetos inválidos y recompilarlos. Es el único módulo, junto con el registro de
mediciones de almacenamiento, que modifica algo en Oracle, por lo que está
diseñado con límites estrictos.

## Qué hace

| Funcionalidad | Cómo se logra |
| --- | --- |
| Ver estadísticas de las tablas | `DBA_TAB_STATISTICS`: filas estimadas, bloques, último análisis y si están desactualizadas (`STALE_STATS`) |
| Recalcular estadísticas | `DBMS_STATS.GATHER_TABLE_STATS` con `cascade => TRUE`, invocado desde el paquete controlado |
| Detectar objetos inválidos | `DBA_OBJECTS` con `STATUS = 'INVALID'` |
| Recompilar | `ALTER <tipo> ... COMPILE` ejecutado dentro del paquete controlado |
| Confirmar el resultado | Tras la operación se vuelve a consultar el estado real del objeto o la fecha de análisis |

Las estadísticas importan porque el optimizador de Oracle decide los planes de
ejecución con ellas: si están viejas, las consultas pueden volverse lentas sin
que el código haya cambiado.

## Diseño de mínimo privilegio

`DBA_MONITOR` **no** recibe privilegios `ANY` (como `ANALYZE ANY` o `ALTER
ANY PROCEDURE`). Solo puede:

1. Leer `DBA_TAB_STATISTICS`, `DBA_OBJECTS` y `DBA_ERRORS`.
2. Ejecutar el paquete `MAINT_DEMO.MAINTENANCE_API`, que expone dos
   procedimientos:
   - `GATHER_TABLE_STATS(p_table_name)`
   - `RECOMPILE_OBJECT(p_object_name, p_object_type)`

El paquete usa `AUTHID DEFINER`, valida los nombres con
`DBMS_ASSERT.SIMPLE_SQL_NAME`, comprueba que la tabla pertenezca a
`MAINT_DEMO` y solo admite estos tipos: `PROCEDURE`, `FUNCTION`, `VIEW`,
`PACKAGE`, `PACKAGE BODY` y `TRIGGER`. Cualquier otro tipo se rechaza.

Además, la aplicación comprueba tres cosas antes de operar:

- El propietario debe ser `MAINT_DEMO` (si no, responde 403).
- La conexión debe estar en `XEPDB1` (si no, responde 409 con un mensaje que
  pide cambiar de perfil).
- Toda operación exige `confirm: true`; sin él responde 400.

**Justificación:** en un entorno real un monitor no debería poder recompilar ni
analizar objetos de cualquier esquema. Limitar la acción a un esquema y a un
paquete auditable evita que un error o un abuso de la herramienta afecte datos
de producción.

## Preparación del entorno

Ejecutar una vez, como `SYS AS SYSDBA`, desde la raíz del repositorio:

```powershell
sqlplus / as sysdba @sql/oracle/maintenance/setup/setup_maintenance.sql
```

El script (puede repetirse; recrea el escenario):

1. Elimina y crea el esquema `MAINT_DEMO` (usuario sin contraseña, solo
   propietario de objetos).
2. Crea la tabla `CLIENTES` con 100 filas, para demostrar las estadísticas.
3. Crea `CONFIGURACION` y el procedimiento `LEER_CONFIGURACION`; elimina la
   tabla para dejar el procedimiento `INVALID` con errores reales y la vuelve
   a crear **sin** recompilar, de modo que el objeto sigue inválido hasta que
   el administrador usa el módulo.
4. Crea el paquete `MAINTENANCE_API`.
5. Otorga a `DBA_MONITOR` los tres `SELECT` y el `EXECUTE` descritos arriba.

Sin este script la página muestra errores `ORA-00942` y "Ocurrió un error al
ejecutar la operación en Oracle", porque el esquema y los permisos no existen.

## API

| Método y ruta | Descripción |
| --- | --- |
| `GET /api/maintenance/statistics` | Estadísticas de las tablas de `MAINT_DEMO` |
| `GET /api/maintenance/invalid-objects` | Objetos inválidos de `MAINT_DEMO` |
| `POST /api/maintenance/update-statistics` | Cuerpo: `{"owner": "MAINT_DEMO", "table_name": "CLIENTES", "confirm": true}` |
| `POST /api/maintenance/recompile` | Cuerpo: `{"owner": "MAINT_DEMO", "object_name": "LEER_CONFIGURACION", "object_type": "PROCEDURE", "confirm": true}` |

## Cómo demostrarlo

1. Abrir `/mantenimiento` con el perfil **XEPDB1**.
2. En "Estadísticas de tablas", observar `CLIENTES` sin análisis (`—`) y
   pulsar la acción para actualizarlas. La fecha de último análisis aparece
   y el estado cambia.
3. En "Objetos inválidos", observar `LEER_CONFIGURACION` y pulsar recompilar.
   El resultado informa si el objeto quedó `VALID`; si sigue inválido, indica
   que hay que revisar sus errores de compilación.
4. La sección "Resultado de operaciones" conserva lo ejecutado en la sesión.

## Limitaciones

- Solo opera sobre `MAINT_DEMO`. Para extenderlo a otro esquema habría que
  crear un paquete equivalente propiedad de ese esquema y otorgar `EXECUTE`;
  no se amplía el privilegio de `DBA_MONITOR`.
- Solo está disponible en `XEPDB1`; en `CDB$ROOT` la página lo indica.
- Una recompilación puede terminar con el objeto aún inválido si su error de
  fondo no se corrigió; en ese caso Oracle devuelve `ORA-24344` y la aplicación
  lo informa como advertencia, no como falla de conexión.
