"""Acceso a las consultas Oracle del Módulo 2 - Rendimiento."""

from pathlib import Path
from typing import Any

from app.database.connection import get_connection

SQL_DIR = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "performance"
)

QUERY_TIMEOUT_MS = 30_000
QUERY_FILES = {
    "active_sessions": "get_active_sessions.sql",
    "blocked_sessions": "get_blocked_sessions.sql",
    "top_sql": "get_top_sql.sql",
    "query_times": "get_query_times.sql",
    "resource_usage": "get_resource_usage.sql",
}


def _fetch_all(file_name: str) -> list[dict[str, Any]]:
    """Ejecuta una consulta SQL y devuelve filas usando nombres de columna."""
    query = (SQL_DIR / file_name).read_text(encoding="utf-8")
    connection = get_connection()
    connection.call_timeout = QUERY_TIMEOUT_MS

    try:
        cursor = connection.cursor()
        try:
            cursor.execute(query)
            columns = [column[0].lower() for column in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
        finally:
            cursor.close()
    finally:
        connection.close()


def get_active_sessions() -> list[dict[str, Any]]:
    return _fetch_all(QUERY_FILES["active_sessions"])


def get_blocked_sessions() -> list[dict[str, Any]]:
    return _fetch_all(QUERY_FILES["blocked_sessions"])


def get_top_sql() -> list[dict[str, Any]]:
    return _fetch_all(QUERY_FILES["top_sql"])


def get_query_times() -> list[dict[str, Any]]:
    return _fetch_all(QUERY_FILES["query_times"])


def get_resource_usage() -> list[dict[str, Any]]:
    return _fetch_all(QUERY_FILES["resource_usage"])