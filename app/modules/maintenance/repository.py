"""
Módulo 6 - Mantenimiento Preventivo.

Acceso a datos y operaciones controladas de mantenimiento.
Las operaciones modificadoras se limitan al esquema MAINT_DEMO.
"""

from pathlib import Path
from typing import Any

import oracledb

from app.database.connection import get_connection


SQL_DIR = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "maintenance"
)

MAINTENANCE_SCHEMA = "MAINT_DEMO"


def _load_sql(filename: str) -> str:
    path = SQL_DIR / filename

    if not path.is_file():
        raise FileNotFoundError(
            f"No se encontró la consulta SQL: {path}"
        )

    return (
        path.read_text(encoding="utf-8")
        .strip()
        .removesuffix(";")
        .strip()
    )


def _fetch_all(
    filename: str,
) -> list[dict[str, Any]]:
    sql = _load_sql(filename)
    connection = get_connection()

    try:
        with connection.cursor() as cursor:
            cursor.execute(sql)

            columns = [
                column[0].lower()
                for column in cursor.description
            ]

            return [
                dict(zip(columns, row))
                for row in cursor.fetchall()
            ]

    finally:
        connection.close()


def get_invalid_objects() -> list[dict]:
    return _fetch_all(
        "get_invalid_objects.sql"
    )


def get_table_statistics() -> list[dict]:
    return _fetch_all(
        "get_table_statistics.sql"
    )


def update_table_statistics(
    owner: str,
    table_name: str,
) -> dict:
    owner = owner.strip().upper()
    table_name = table_name.strip().upper()

    if owner != MAINTENANCE_SCHEMA:
        raise PermissionError(
            "Solo se permite ejecutar mantenimiento "
            "sobre el esquema MAINT_DEMO."
        )

    connection = get_connection()

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                BEGIN
                    MAINT_DEMO.MAINTENANCE_API.GATHER_TABLE_STATS(
                        :table_name
                    );
                END;
                """,
                {
                    "table_name": table_name
                },
            )

            cursor.execute(
                """
                SELECT last_analyzed
                FROM dba_tab_statistics
                WHERE owner = 'MAINT_DEMO'
                  AND table_name = :table_name
                  AND object_type = 'TABLE'
                  AND partition_name IS NULL
                """,
                {
                    "table_name": table_name
                },
            )

            row = cursor.fetchone()

            return {
                "success": True,
                "owner": owner,
                "table_name": table_name,
                "last_analyzed": (
                    row[0].isoformat()
                    if row and row[0]
                    else None
                ),
                "message": (
                    "Estadísticas actualizadas correctamente."
                ),
            }

    finally:
        connection.close()


def recompile_object(
    owner: str,
    object_name: str,
    object_type: str,
) -> dict:
    owner = owner.strip().upper()
    object_name = object_name.strip().upper()
    object_type = object_type.strip().upper()

    if owner != MAINTENANCE_SCHEMA:
        raise PermissionError(
            "Solo se permite recompilar objetos "
            "del esquema MAINT_DEMO."
        )

    connection = get_connection()

    try:
        with connection.cursor() as cursor:
            try:
                cursor.execute(
                    """
                    BEGIN
                        MAINT_DEMO.MAINTENANCE_API.RECOMPILE_OBJECT(
                            :object_name,
                            :object_type
                        );
                    END;
                    """,
                    {
                        "object_name": object_name,
                        "object_type": object_type,
                    },
                )

            except oracledb.Warning as warning:
                warning_text = str(warning)

                # ORA-24344 significa que ALTER ... COMPILE se ejecutó,
                # pero el objeto continúa con errores de compilación.
                # No es un fallo de conexión ni de la aplicación.
                if (
                    "ORA-24344" not in warning_text
                    and "DPY-7000" not in warning_text
                ):
                    raise

            cursor.execute(
                """
                SELECT status
                FROM dba_objects
                WHERE owner = 'MAINT_DEMO'
                  AND object_name = :object_name
                  AND object_type = :object_type
                """,
                {
                    "object_name": object_name,
                    "object_type": object_type,
                },
            )

            row = cursor.fetchone()

            status = (
                row[0]
                if row
                else "UNKNOWN"
            )

            return {
                "success": status == "VALID",
                "owner": owner,
                "object_name": object_name,
                "object_type": object_type,
                "status": status,
                "message": (
                    "Objeto recompilado correctamente."
                    if status == "VALID"
                    else
                    "La recompilación se ejecutó, "
                    "pero el objeto continúa INVALID. "
                    "Revise sus errores de compilación."
                ),
            }

    finally:
        connection.close()

def get_container_name() -> str:
    """Devuelve el contenedor Oracle de la conexión activa."""

    connection = get_connection()

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT SYS_CONTEXT('USERENV', 'CON_NAME')
                FROM dual
                """
            )

            row = cursor.fetchone()

            return row[0].upper()

    finally:
        connection.close()