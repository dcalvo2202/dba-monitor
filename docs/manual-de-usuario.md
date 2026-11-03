# Manual de usuario

DBA Monitor muestra el estado de una instancia Oracle en seis módulos. Todo se
actualiza con datos reales de la base; la aplicación no guarda ni inventa
información.

## 1. Iniciar la aplicación

1. Verificar que Oracle esté en ejecución.
2. Activar el entorno virtual e iniciar el servidor desde la carpeta del
   proyecto:

   ```powershell
   .\.venv\Scripts\Activate.ps1
   uvicorn app.main:app --reload
   ```

3. Abrir <http://127.0.0.1:8000> en el navegador.

La instalación y los permisos de Oracle están en
[configuracion-local.md](configuracion-local.md).

## 2. La pantalla

- **Menú lateral:** cambia entre los seis módulos. El activo aparece resaltado.
  En pantallas medianas el menú se reduce a íconos (el nombre aparece al
  pasar el mouse) y en móvil pasa a una barra horizontal.
- **Instancia:** selector para elegir la instancia o contenedor monitoreado
  (por ejemplo `XEPDB1` o `CDB$ROOT`). Al cambiarlo la página se recarga.
- **Última actualización:** hora de la última consulta correcta.
- **Auto:** actualización automática apagada, cada 30 s o cada 60 s.
- **Actualizar:** consulta de nuevo la base de datos.
- **Indicador de estado:** *Conectado* (verde), *Datos parciales* (amarillo,
  alguna sección no se pudo consultar) o *Error al consultar* (rojo).
- **Botón de tema:** alterna entre tema claro y oscuro; se recuerda en el
  navegador.

Mientras los datos cargan, las cifras y mensajes aparecen como barras grises
animadas; desaparecen al llegar la información.

## 3. Módulos

### Módulo 1 - Estado general (`/`)

Responde "¿está viva la instancia y cómo está de memoria?".

- Tarjetas: estado (`OPEN`), nombre de la instancia, PDB monitoreada y
  tiempo activo.
- **Información de la instancia:** servidor, gestor, base de datos, versión,
  servicio e inicio de la instancia.
- **Memoria:** asignada y utilizada estimada, con barras de uso de SGA, PGA y
  total, y el desglose en MB.
- **Composición de la SGA:** gráfico con sus componentes.
- **Pluggable Databases visibles:** bases conectables de la instancia.

### Módulo 2 - Rendimiento (`/rendimiento`)

Ayuda a encontrar qué está consumiendo recursos.

- **Sesiones activas:** SID, usuario, equipo, programa e inicio de sesión.
- **Sesiones bloqueadas:** quién espera a quién, el evento y los segundos de
  espera; si no hay, lo indica.
- **SQL de mayor consumo de CPU:** hasta 10 consultas por CPU acumulada.
- **Tiempos de ejecución SQL:** tiempo total y promedio por ejecución.
- **Sesiones con recursos:** CPU acumulada y PGA usada por sesión.

Los valores de SQL vienen de la memoria de Oracle (`V$SQL`): reflejan lo que
sigue en caché, no un historial completo.

### Módulo 3 - Almacenamiento (`/almacenamiento`)

- Tarjetas con el tamaño de la base de datos.
- **Tablespaces:** usado, libre, asignado, máximo y porcentaje de uso del
  máximo, con estado (Normal, advertencia o crítico).
- **Crecimiento de la base de datos:** compara mediciones guardadas. Pulse
  **Registrar medición** para guardar una nueva; con dos o más mediciones se
  calcula el crecimiento, el ritmo por día y una estimación del tiempo para
  alcanzar el máximo.
- **Archivos de datos:** archivo, tablespace, tamaño y autoextensión.
- **Objetos de mayor tamaño:** tablas e índices que más espacio ocupan.

### Módulo 4 - Respaldos (`/respaldos`)

Use el perfil **CDB$ROOT** en el selector de instancia: Oracle registra los
respaldos a nivel del contenedor raíz. En `XEPDB1` la página lo avisa.

- **Último respaldo exitoso:** fecha, tipo (incremental nivel 0/1, archived
  logs, etc.) y estado.
- **Interpretación de riesgo:** indica si la situación es adecuada o hay
  advertencias, y explica por qué (por ejemplo, que el trabajo más reciente
  falló).
- **Configuración de recuperación:** modo de archivado y área de recuperación
  rápida (FRA) con su porcentaje de uso.
- **Historial de respaldos:** trabajos RMAN con fecha, tipo, estado y duración.

### Módulo 5 - Auditoría (`/auditoria`)

Cuatro pestañas (se navegan también con el teclado):

- **Usuarios:** estado de la cuenta, con búsqueda por nombre y hallazgos de
  seguridad.
- **Roles:** roles y a quién están asignados, con búsqueda.
- **Privilegios:** escriba un usuario y pulse **Consultar** para ver sus
  privilegios directos y heredados por rol; filtre por *de sistema* o *de
  objeto*.
- **Objetos inválidos:** objetos con errores de compilación y el detalle de
  cada error.

### Módulo 6 - Mantenimiento (`/mantenimiento`)

Use el perfil **XEPDB1**. Detalle en
[modulo-6-mantenimiento.md](modulo-6-mantenimiento.md).

- **Estadísticas de tablas:** filas estimadas, último análisis y estado.
  Pulse la acción de la fila para recalcular sus estadísticas.
- **Objetos inválidos:** pulse la acción para recompilar el objeto.
- **Resultado de operaciones:** informa si cada operación terminó bien o con
  error.

## 4. Mensajes frecuentes

| Mensaje | Significado | Qué hacer |
| --- | --- | --- |
| `ORA-00942` | La vista no existe o falta el permiso | Ejecutar el script de permisos del módulo (ver README) |
| `ORA-01017` | Usuario o contraseña incorrectos | Revisar `.env` |
| "Datos parciales" | Una sección no se pudo consultar | Revisar el mensaje de esa sección |
| "Sin datos" en Respaldos | Está en `XEPDB1` | Cambiar al perfil `CDB$ROOT` |
| "disponible únicamente en XEPDB1" | Mantenimiento en `CDB$ROOT` | Cambiar al perfil `XEPDB1` |
| Página nueva responde "Not Found" | El servidor no se reinició tras un `git pull` | Reiniciar `uvicorn` |
