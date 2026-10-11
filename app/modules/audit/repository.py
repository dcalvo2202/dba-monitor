"""Capa de acceso a datos del Módulo 5 - Auditoría.

Responsabilidad única: ejecutar las consultas SQL almacenadas en
`sql/oracle/audit/` y devolver sus filas. No interpreta los datos; esa
lógica vive en `service.py`.

Cada fila se devuelve como diccionario con los nombres de columna en
minúsculas (ej. {"username": "AUDIT_DEMO", "account_status": "OPEN"}), para
que el servicio no dependa de la posición de las columnas en el SELECT.
"""

from pathlib import Path
from typing import Any

from app.database.connection import get_connection


# Carpeta con las consultas del módulo: <raíz del proyecto>/sql/oracle/audit
SQL_DIR = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "audit"
)

# Límite de tiempo de cada consulta (30 s). Las consultas del módulo tardan
# menos de 0,5 s; el límite solo protege ante una base de datos colgada.
QUERY_TIMEOUT_MS = 30_000


def _fetch_all(file_name: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Ejecuta una consulta del módulo y devuelve todas sus filas.

    Args:
        file_name: Nombre del archivo .sql dentro de `sql/oracle/audit/`.
        params: Valores de las variables bind (ej. {"username": "SYS"}).
            Se envían por separado del texto SQL, por lo que no existe
            riesgo de inyección SQL.

    Returns:
        Lista de diccionarios, uno por fila.

    Raises:
        oracledb.Error: Si la conexión o la consulta fallan. Se propaga para
            que el router responda con un mensaje adecuado.
    """
    query = (SQL_DIR / file_name).read_text(encoding="utf-8")

    connection = get_connection()

    # Tiempo máximo por operación en milisegundos. Si Oracle no responde,
    # python-oracledb lanza DPY-4024 (un oracledb.Error que el router
    # convierte en 503) en lugar de dejar el hilo del servidor bloqueado.
    connection.call_timeout = QUERY_TIMEOUT_MS

    try:
        cursor = connection.cursor()

        try:
            cursor.execute(query, params or {})

            # cursor.description contiene los metadatos de cada columna;
            # el primer elemento es su nombre.
            columns = [column[0].lower() for column in cursor.description]

            return [dict(zip(columns, row)) for row in cursor.fetchall()]

        finally:
            cursor.close()

    finally:
        connection.close()


def _to_flag(value: bool) -> str:
    """Convierte un booleano de Python al indicador 'Y'/'N' que usan las consultas."""
    return "Y" if value else "N"


def get_users(include_oracle: bool) -> list[dict[str, Any]]:
    """Usuarios registrados con sus indicadores de seguridad."""
    return _fetch_all(
        "get_users.sql",
        {"include_oracle": _to_flag(include_oracle)},
    )


def get_user(username: str) -> dict[str, Any] | None:
    """Información de un usuario; None si no existe."""
    rows = _fetch_all("get_user.sql", {"username": username})

    return rows[0] if rows else None


def get_user_roles(username: str) -> list[dict[str, Any]]:
    """Roles directos y heredados de un usuario, con su ruta de herencia."""
    return _fetch_all("get_user_roles.sql", {"username": username})


def get_user_privileges(
    username: str,
    privilege_type: str | None,
    max_rows: int,
) -> list[dict[str, Any]]:
    """Privilegios efectivos de un usuario (directos y por roles).

    Args:
        username: Usuario a consultar.
        privilege_type: 'SISTEMA', 'OBJETO' o None para ambos.
        max_rows: Límite de filas devueltas; cada fila incluye `total_rows`
            con el total real antes del límite.
    """
    return _fetch_all(
        "get_user_privileges.sql",
        {
            "username": username,
            "privilege_type": privilege_type,
            "max_rows": max_rows,
        },
    )


def get_public_object_privileges() -> dict[str, Any]:
    """Resumen de los privilegios de objeto otorgados a PUBLIC."""
    return _fetch_all("get_public_object_privileges.sql")[0]


def get_roles(include_oracle: bool) -> list[dict[str, Any]]:
    """Roles disponibles con su resumen de asignaciones y privilegios."""
    return _fetch_all(
        "get_roles.sql",
        {"include_oracle": _to_flag(include_oracle)},
    )


def get_invalid_objects() -> list[dict[str, Any]]:
    """Objetos en estado INVALID con su cantidad de errores de compilación."""
    return _fetch_all("get_invalid_objects.sql")


def get_compilation_errors() -> list[dict[str, Any]]:
    """Detalle de los errores de compilación registrados en DBA_ERRORS."""
    return _fetch_all("get_compilation_errors.sql")
