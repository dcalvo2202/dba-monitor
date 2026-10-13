/*
================================================================================
 Archivo     : sql/oracle/instance/get_sga_components.sql
 Módulo      : 1 - Estado general de la instancia
 Propósito   : Obtener la composición de la SGA (System Global Area) para
               mostrarla en un gráfico de partes de un todo.
 Vistas      : V$SGA
 Privilegios : SELECT ON SYS.V_$SGA (ya otorgado para el Módulo 1)

 Columnas devueltas:
   name   Componente de la SGA:
            Database Buffers  Caché de datos: bloques leídos de los datafiles.
            Variable Size     Shared pool, large pool, java pool y otras
                              estructuras de tamaño variable.
            Fixed Size        Estructuras internas fijas de la instancia.
            Redo Buffers      Buffer de redo log antes de escribirse a disco.
   bytes  Tamaño asignado al componente.

 Notas:
   - La suma de todas las filas es la SGA total (la misma cifra que ya usa
     get_memory_info.sql), por lo que el gráfico y la tarjeta coinciden.
================================================================================
*/
SELECT name,
       value AS bytes
FROM   v$sga
ORDER  BY value DESC
