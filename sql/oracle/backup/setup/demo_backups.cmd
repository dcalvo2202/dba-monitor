@echo off
REM ============================================================================
REM  Archivo   : sql\oracle\backup\setup\demo_backups.cmd
REM  Modulo    : 4 - Respaldo y recuperacion (datos de prueba)
REM  Proposito : Generar un historial de respaldos RMAN reales para el modulo:
REM                1. Incremental nivel 0  (completo, base de la estrategia)
REM                2. Incremental nivel 1  (solo bloques modificados)
REM                3. Archived logs
REM                4. Un respaldo FALLIDO a proposito
REM              Cada script se ejecuta en una sesion RMAN distinta porque
REM              Oracle registra un "trabajo" de respaldo por sesion.
REM
REM  Ejecutar  : En una terminal (CMD o PowerShell), desde la raiz del proyecto:
REM                  sql\oracle\backup\setup\demo_backups.cmd
REM  Requisitos: - Modo ARCHIVELOG activo (enable_archivelog.sql).
REM              - Usuario de Windows en el grupo ORA_DBA (el que instalo
REM                Oracle XE), para que "rman target /" entre sin contrasena.
REM              - Unos 2 GB libres en el disco de la Fast Recovery Area.
REM  Duracion  : De 2 a 10 minutos, segun el equipo.
REM ============================================================================

REM Se entra a la carpeta de este archivo (%~dp0) y se pasa a RMAN solo el
REM nombre de cada script: el analizador de argumentos de RMAN no acepta
REM rutas completas con espacios (ej. "2do semestre 2026") y falla con
REM RMAN-02001. pushd/popd devuelven la terminal a la carpeta original.
pushd "%~dp0"

echo.
echo [1/4] Respaldo incremental nivel 0...
rman target / cmdfile=backup_level0.rman

echo.
echo [2/4] Respaldo incremental nivel 1...
rman target / cmdfile=backup_level1.rman

echo.
echo [3/4] Respaldo de archived logs...
rman target / cmdfile=backup_archivelog.rman

echo.
echo [4/4] Respaldo fallido a proposito (el error ORA-19504 es esperado)...
rman target / cmdfile=backup_failed.rman

popd

echo.
echo Listo. Abra http://localhost:8000/respaldos para ver el historial.
