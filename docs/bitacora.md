# Bitácora del proyecto

Registro cronológico del desarrollo de DBA Monitor, reconstruido a partir del
historial de Git (`git log`). Cada entrada indica la fecha, quién hizo el
aporte y qué se incorporó. Los nombres corresponden a las cuentas de GitHub
de cada integrante.

| Integrante | Cuenta de GitHub |
| --- | --- |
| Sebastián Benavides Madrigal | Killazz17 |
| David Andrés Calvo Hernández | dcalvo2202 |
| Camila Pastor | CamilaPastor |
| Francisco Elizondo | Franco-1407 |

## Septiembre 2026

**5 de septiembre - Arranque del proyecto (David)**
- Estructura inicial de la aplicación en FastAPI.
- Configuración externa de la conexión a Oracle y conexión configurable.
- Primera versión del módulo 1: consulta, procesamiento y API de la
  información básica de la instancia, y tiempo de actividad.
- Documentación inicial: guía de configuración local y flujo de trabajo con Git.
- Se revirtió por error el PR de documentación y se restauró el mismo día.

**30 de septiembre - Módulo 1 (David)**
- Información general ampliada de la instancia, del contenedor y del servicio.
- Métricas de memoria de la instancia integradas al estado.

## Octubre 2026

**2 y 3 de octubre - Rendimiento y módulo 1**
- Camila: monitoreo de sesiones activas, sesiones bloqueadas y SQL de mayor
  consumo (inicio del módulo 2).
- David: información de las PDBs y memoria total utilizada estimada.

**5 de octubre - Interfaz del módulo 1 (David)**
- Interfaz inicial del estado de la instancia, monitoreo visual y ajustes de
  estados.

**6 de octubre - Auditoría, interfaz base y perfiles de conexión (Sebastián)**
- Reorganización de paquetes Python y extracción de la plantilla base del
  frontend.
- Módulo 5: consultas administrativas de auditoría, API, interfaz,
  scripts de privilegios y datos de prueba reejecutables, y documentación de
  los privilegios.
- Accesibilidad de la interfaz, tema oscuro y navegación por teclado.
- Perfiles de conexión configurables, API para cambiar la instancia, usuario
  común para monitorear `CDB$ROOT`, selector de instancia en la interfaz y su
  documentación.
- Composición de la SGA y gráficos con datos reales en los módulos 1 y 5.
- Cabecera para que el navegador revalide los archivos estáticos.

**6 de octubre - Almacenamiento (Francisco)**
- Primeros archivos, consultas SQL y servicio del módulo 3.

**7 de octubre - Integración de Rendimiento (Camila)**
- Integración del frontend y página del panel de rendimiento.

**11 de octubre - Almacenamiento (Francisco)**
- Archivos faltantes del módulo 3 y corrección de consultas SQL.
- Reversión de la integración de la rama del módulo 3 (PR #15 y #16).

**13 de octubre - Respaldos y Almacenamiento (Sebastián)**
- Módulo 4: scripts de privilegios y respaldos de prueba con RMAN, consultas
  del historial, API, interfaz y documentación de configuración.
- Módulo 3: corrección de privilegios y consultas, reorganización de la API,
  rediseño de la interfaz y documentación.
- Restauración en `main` de los cambios eliminados por la reversión del PR #16.

**27 de octubre - Rendimiento y Mantenimiento**
- Camila: tiempos de ejecución SQL, consumo de CPU y memoria, y cierre del
  módulo 2.
- Francisco: capa repository y service del módulo 6, y funcionalidades e
  interfaz de mantenimiento.

**31 de octubre - Cierre de módulos (David)**
- Permisos de rendimiento para `CDB$ROOT`.
- Historial de almacenamiento restringido a `XEPDB1`.
- Módulo 6 completado: mantenimiento preventivo.

## Noviembre 2026

**2 de noviembre - Restricción de mantenimiento y pulido de interfaz**
- David: mantenimiento restringido a `XEPDB1`.
- Sebastián: interfaz con estilo moderno (cristal, degradados, indicador de
  conexión pulsante), efecto de carga tipo skeleton, barra lateral compacta en
  tableta y mayor espaciado entre bloques.
- Documentación final: README, arquitectura, manual de usuario, módulo 6,
  evidencias de pruebas, esta bitácora y guía de la exposición.

## Cómo se trabajó

- Una rama por funcionalidad (`feature/...`, `fix/...`, `docs/...`) y Pull
  Request hacia `develop` o `main`.
- La rama `main` se mantuvo estable y ejecutable.
- El flujo está descrito en [flujo-git.md](flujo-git.md).

## Cómo ver el detalle de un periodo

```powershell
git log --since="2026-10-01" --until="2026-10-31" --format="%ad | %an | %s" --date=short
```
