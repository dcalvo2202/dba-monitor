"""Capa de acceso a datos del Módulo 3 - Gestión del almacenamiento.

Responsabilidad única: ejecutar las consultas SQL almacenadas en
`sql/oracle/storage/` y devolver sus filas. No interpreta los datos; esa
lógica vive en `service.py`.

Cada fila se devuelve como diccionario con los nombres de columna en
minúsculas (ej. {"tablespace_name": "USERS", "used_bytes": 5242880}).
Los tamaños se devuelven en bytes; el servicio los convierte.
"""

from pathlib import Path
from typing import Any

from app.database.connection import get_connection


# Carpeta con las consultas del módulo: <raíz del proyecto>/sql/oracle/storage
SQL_DIR = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "storage"
)

# Límite de tiempo de cada consulta (30 s). Solo protege ante una base de
# datos colgada; las consultas del módulo responden en menos de un segundo.
QUERY_TIMEOUT_MS = 30_000


def _read_sql(file_name: str) -> str:
    """Texto de una consulta de `sql/oracle/storage/`."""
    return (SQL_DIR / file_name).read_text(encoding="utf-8")


def _fetch_all(file_name: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Ejecuta una consulta del módulo y devuelve todas sus filas.

    Args:
        file_name: Nombre del archivo .sql dentro de `sql/oracle/storage/`.
        params: Valores de las variables bind. Se envían por separado del
            texto SQL, por lo que no existe riesgo de inyección SQL.

    Raises:
        oracledb.Error: Si la conexión o la consulta fallan (por ejemplo,
            ORA-00942 si faltan los privilegios de setup/grants.sql). Se
            propaga para que el router responda con un mensaje adecuado.
    """
    query = _read_sql(file_name)
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


def get_tablespace_usage() -> list[dict[str, Any]]:
    """Espacio total, usado, libre y máximo de cada tablespace."""
    return _fetch_all("get_tablespace_usage.sql")


def get_database_size() -> dict[str, Any]:
    """Tamaño asignado, usado y máximo de la base de datos."""
    return _fetch_all("get_database_size.sql")[0]


def get_datafiles() -> list[dict[str, Any]]:
    """Archivos de datos y temporales con su tamaño y autoextensión."""
    return _fetch_all("get_datafiles.sql")


def get_large_objects(include_oracle: bool, max_rows: int) -> list[dict[str, Any]]:
    """Segmentos que más espacio ocupan, del mayor al menor.

    Args:
        include_oracle: Incluir los objetos internos de Oracle (SYS...).
        max_rows: Cantidad de objetos a devolver.
    """
    return _fetch_all(
        "get_large_objects.sql",
        {"include_oracle": "Y" if include_oracle else "N", "max_rows": max_rows},
    )


def get_storage_history(days: int) -> list[dict[str, Any]]:
    """Mediciones del historial de los últimos `days` días."""
    return _fetch_all("get_storage_history.sql", {"days": days})


def record_storage_snapshot() -> None:
    """Registra una medición llamando a DBA_MONITOR_HIST.RECORD_STORAGE_SNAPSHOT.

    El procedimiento hace su propio COMMIT; la aplicación no escribe en la
    tabla del historial.
    """
    connection = get_connection()
    connection.call_timeout = QUERY_TIMEOUT_MS

    try:
        cursor = connection.cursor()

        try:
            cursor.execute(_read_sql("record_storage_snapshot.sql"))

        finally:
            cursor.close()

    finally:
        connection.close()
