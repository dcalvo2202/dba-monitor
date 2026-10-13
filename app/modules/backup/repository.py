"""Capa de acceso a datos del Módulo 4 - Respaldo y recuperación.

Responsabilidad única: ejecutar las consultas SQL almacenadas en
`sql/oracle/backup/` y devolver sus filas. No interpreta los datos; esa
lógica vive en `service.py`.

Cada fila se devuelve como diccionario con los nombres de columna en
minúsculas (ej. {"input_type": "DB INCR", "status": "COMPLETED"}).
"""

from pathlib import Path
from typing import Any

from app.database.connection import get_connection


# Carpeta con las consultas del módulo: <raíz del proyecto>/sql/oracle/backup
SQL_DIR = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "backup"
)

# Límite de tiempo de cada consulta (30 s). Las vistas de RMAN leen el
# archivo de control y responden en menos de un segundo; el límite solo
# protege ante una base de datos colgada.
QUERY_TIMEOUT_MS = 30_000


def _fetch_all(file_name: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Ejecuta una consulta del módulo y devuelve todas sus filas.

    Args:
        file_name: Nombre del archivo .sql dentro de `sql/oracle/backup/`.
        params: Valores de las variables bind. Se envían por separado del
            texto SQL, por lo que no existe riesgo de inyección SQL.

    Returns:
        Lista de diccionarios, uno por fila.

    Raises:
        oracledb.Error: Si la conexión o la consulta fallan (por ejemplo,
            ORA-00942 si faltan los privilegios de grants.sql). Se propaga
            para que el router responda con un mensaje adecuado.
    """
    query = (SQL_DIR / file_name).read_text(encoding="utf-8")

    connection = get_connection()

    # Si Oracle no responde, python-oracledb lanza DPY-4024 en lugar de
    # dejar el hilo del servidor bloqueado.
    connection.call_timeout = QUERY_TIMEOUT_MS

    try:
        cursor = connection.cursor()

        try:
            cursor.execute(query, params or {})

            columns = [column[0].lower() for column in cursor.description]

            return [dict(zip(columns, row)) for row in cursor.fetchall()]

        finally:
            cursor.close()

    finally:
        connection.close()


def get_backup_jobs(max_rows: int) -> list[dict[str, Any]]:
    """Trabajos de respaldo RMAN, del más reciente al más antiguo.

    Args:
        max_rows: Máximo de trabajos a devolver. Cada fila incluye
            `total_rows` con el total real antes del límite.
    """
    return _fetch_all("get_backup_jobs.sql", {"max_rows": max_rows})


def get_last_successful_backups() -> list[dict[str, Any]]:
    """Último respaldo exitoso de la base de datos y de los archived logs.

    Devuelve como máximo dos filas, identificadas por la columna
    `category` ('BASE_DATOS' o 'ARCHIVELOG'); falta la fila de una
    categoría si nunca tuvo un respaldo exitoso.
    """
    return _fetch_all("get_last_successful_backups.sql")


def get_recovery_config() -> dict[str, Any]:
    """Modo de archivado, contenedor actual, hora del servidor y uso de la FRA."""
    return _fetch_all("get_recovery_config.sql")[0]
