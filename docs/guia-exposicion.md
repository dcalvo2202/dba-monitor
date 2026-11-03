# Guía de la exposición

Apoyo para preparar la presentación del 3 de noviembre de 2026 (unos 15
minutos). Las diapositivas están en el repositorio:
[`docs/presentacion/DBA-Monitor-presentacion.pdf`](presentacion/DBA-Monitor-presentacion.pdf).

## Antes de empezar

- Oracle iniciado y `uvicorn` corriendo desde la **versión final de `main`**.
- Scripts de preparación ejecutados (README): permisos de todos los módulos,
  `demo_objects.sql`, `demo_backups.cmd` y `setup_maintenance.sql`.
- Al menos dos mediciones de almacenamiento registradas, para que el
  crecimiento muestre un cálculo.
- El navegador abierto en la página inicial y el repositorio de GitHub en otra
  pestaña.
- Probar la conexión 10 minutos antes. No se aceptan capturas ni videos en
  lugar de la ejecución en vivo.

## Guion sugerido (15 min)

| Min | Qué | Quién |
| --- | --- | --- |
| 0-1 | Caso de estudio y objetivo (DataSolutions Costa Rica) | |
| 1-2 | Arquitectura: router, service, repository, SQL en archivos | |
| 2-4 | Módulo 1: instancia, servidor vs instancia vs base de datos, selector de instancia | |
| 4-6 | Módulo 2: SQL de mayor consumo, sesiones, bloqueos | |
| 6-8 | Módulo 3: tablespaces, crecimiento (registrar una medición en vivo) | |
| 8-10 | Módulo 4: perfil `CDB$ROOT`, último respaldo, historial y riesgo | |
| 10-11 | Módulo 5: usuarios, roles, privilegios y objetos inválidos | |
| 11-13 | Módulo 6: recalcular estadísticas y recompilar en vivo | |
| 13-14 | Repositorio: estructura, historial, ramas, aportes y versión final | |
| 14-15 | Limitaciones y mejoras posibles | |

Cada integrante debe participar: asigne módulos en la columna "Quién" y
ensaye la demostración completa.

## Qué mostrar del repositorio

- Estructura de carpetas (`app/`, `sql/`, `docs/`, `tests/`).
- Historial de commits con fechas y autores; ramas creadas.
- Los aportes de cada integrante (`git shortlog -sn --all`).
- La etiqueta de la versión final.

## Preguntas probables y cómo responderlas

**¿Cuál es la diferencia entre servidor, instancia y base de datos?**
El servidor es el equipo físico o virtual. La instancia son los procesos y la
memoria (SGA/PGA) que Oracle levanta (`xe`). La base de datos son los archivos
en disco. En XE hay un contenedor raíz (`CDB$ROOT`) y una base conectable
(`XEPDB1`).

**¿Por qué dos perfiles de conexión?**
Oracle registra los respaldos RMAN a nivel de CDB; desde `XEPDB1` esa vista
aparece vacía. Por eso el módulo 4 se consulta con `CDB$ROOT` y la aplicación
lo avisa en lugar de mostrar un diagnóstico falso.

**¿Qué permisos necesita el usuario de monitoreo y por qué?**
Solo `SELECT` sobre las vistas de cada módulo (`V$SESSION`, `V$SQL`,
`DBA_TABLESPACES`, `DBA_USERS`, etc.). Es el principio de mínimo privilegio:
un monitor no debe poder modificar lo que observa.

**¿Cómo se interpreta el uso de un tablespace?**
Se mide sobre el tamaño máximo (con autoextensión), no sobre lo asignado hoy;
un tablespace puede estar al 90 % de lo asignado y al 1 % de su máximo.

**¿Por qué el mantenimiento solo funciona en `MAINT_DEMO`?**
Para no dar a `DBA_MONITOR` privilegios `ANY`. La acción se hace con un paquete
propietario de ese esquema, que valida el nombre y el tipo de objeto
(`DBMS_ASSERT`). Ver [módulo 6](modulo-6-mantenimiento.md).

**¿Qué significa que una recompilación siga inválida?**
Que el error de fondo no se corrigió (por ejemplo una tabla faltante). La
aplicación lo informa y remite a los errores de compilación.

**¿Los datos son reales?**
Sí. Cada cifra sale de una consulta a una vista de Oracle en el momento. Los
datos de prueba (`AUDIT_DEMO`, `MAINT_DEMO`, respaldos de prueba) son objetos
reales creados con scripts del repositorio, no valores simulados en el código.

**¿Cómo manejan los errores?**
Cada sección falla por separado con un mensaje claro y la página sigue
funcionando; los detalles técnicos quedan en el log. Ver
[arquitectura](arquitectura.md), sección 5.

**¿Cómo agregarían un módulo nuevo?**
Ver [arquitectura](arquitectura.md), sección 8.

**¿Posibles mejoras?**
Historial persistente de métricas de rendimiento (hoy viene de `V$SQL`, en
memoria), alertas por umbral, soporte para SQL Server y ampliar el
mantenimiento a más esquemas con paquetes equivalentes.

## Sobre el uso de IA

El proyecto permite apoyarse en IA, pero cada integrante debe poder explicar
las consultas, los permisos y las decisiones de diseño que aparecen en el
código y justificar su uso. Repase su módulo hasta poder responder sin leer.
