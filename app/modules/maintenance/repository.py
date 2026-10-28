"""
Módulo 6 - Mantenimiento Preventivo.

Responsabilidades:
- Consultar objetos inválidos.
- Consultar estadísticas de tablas.
- Actualizar estadísticas.
- Recompilar objetos.
- Verificar resultados.

Utiliza el perfil Oracle activo de DBA Monitor.
"""

import re
from pathlib import Path
from typing import Any

from app.database.connection import get_connection


# Carpeta de consultas SQL del módulo 6.
SQL_DIR = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "maintenance"
)

# Tipos de objetos que permitiremos recompilar.
COMPILE_COMMANDS = {
    "PROCEDURE": "ALTER PROCEDURE",
    "FUNCTION": "ALTER FUNCTION",
    "PACKAGE": "ALTER PACKAGE",
    "PACKAGE BODY": "ALTER PACKAGE",
    "TRIGGER": "ALTER TRIGGER",
    "VIEW": "ALTER VIEW",
}

# Validación de identificadores Oracle convencionales.
IDENTIFIER_PATTERN = re.compile(
    r"^[A-Za-z][A-Za-z0-9_$#]{0,127}$"
)


def _load_sql(filename: str) -> str:
    """
    Lee una consulta desde sql/oracle/maintenance.
    """

    path = SQL_DIR / filename

    if not path.is_file():
        raise FileNotFoundError(
            f"No se encontró la consulta SQL: {path}"
        )

    # Evita terminadores SQL*Plus al ejecutar con python-oracledb.
    return path.read_text(
        encoding="utf-8"
    ).strip().removesuffix(";").strip()


def _fetch_all(filename: str) -> list[dict[str, Any]]:
    """
    Ejecuta una consulta SELECT y devuelve diccionarios.
    """

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
    """
    Consulta los objetos inválidos visibles
    para el usuario conectado.
    """

    return _fetch_all("get_invalid_objects.sql")


def get_table_statistics() -> list[dict]:
    """
    Consulta las estadísticas actuales
    de las tablas visibles.
    """

    return _fetch_all("get_table_statistics.sql")


def _validate_identifier(value: str) -> str:
    """
    Valida identificadores antes de incorporarlos
    a sentencias DDL.
    """

    if not isinstance(value, str):
        raise ValueError("El identificador debe ser texto.")

    value = value.strip().upper()

    if not IDENTIFIER_PATTERN.fullmatch(value):
        raise ValueError(
            f"Identificador Oracle no permitido: {value}"
        )

    return value


def _current_schema(cursor) -> str:
    """
    Obtiene el usuario de la sesión Oracle.
    """

    cursor.execute(
        """
        SELECT SYS_CONTEXT('USERENV', 'SESSION_USER')
        FROM dual
        """
    )

    return cursor.fetchone()[0].upper()


def update_table_statistics(
    owner: str,
    table_name: str
) -> dict:
    """
    Actualiza las estadísticas de una tabla
    mediante DBMS_STATS.

    Solo permite tablas del usuario conectado.
    """

    owner = _validate_identifier(owner)
    table_name = _validate_identifier(table_name)

    connection = get_connection()

    try:
        with connection.cursor() as cursor:

            session_user = _current_schema(cursor)

            if owner != session_user:
                raise PermissionError(
                    "Solo se permite actualizar estadísticas "
                    "de tablas del usuario conectado."
                )

            cursor.execute(
                """
                SELECT COUNT(*)
                FROM user_tables
                WHERE table_name = :table_name
                """,
                {"table_name": table_name}
            )

            if cursor.fetchone()[0] == 0:
                raise ValueError(
                    f"La tabla {owner}.{table_name} "
                    "no existe o no es accesible."
                )

            cursor.execute(
                """
                BEGIN
                    DBMS_STATS.GATHER_TABLE_STATS(
                        ownname => :owner,
                        tabname => :table_name,
                        cascade => TRUE
                    );
                END;
                """,
                {
                    "owner": owner,
                    "table_name": table_name
                }
            )

            cursor.execute(
                """
                SELECT last_analyzed
                FROM user_tab_statistics
                WHERE table_name = :table_name
                  AND object_type = 'TABLE'
                  AND partition_name IS NULL
                """,
                {"table_name": table_name}
            )

            row = cursor.fetchone()

            connection.commit()

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
                    "Actualización de estadísticas ejecutada."
                )
            }

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


def recompile_object(
    owner: str,
    object_name: str,
    object_type: str
) -> dict:
    """
    Recompila un objeto inválido del usuario conectado.

    Verifica su estado después de ejecutar COMPILE.
    """

    owner = _validate_identifier(owner)
    object_name = _validate_identifier(object_name)
    object_type = object_type.strip().upper()

    if object_type not in COMPILE_COMMANDS:
        raise ValueError(
            f"Tipo de objeto no admitido: {object_type}"
        )

    connection = get_connection()

    try:
        with connection.cursor() as cursor:

            session_user = _current_schema(cursor)

            if owner != session_user:
                raise PermissionError(
                    "Solo se permite recompilar objetos "
                    "del usuario conectado."
                )

            cursor.execute(
                """
                SELECT COUNT(*)
                FROM user_objects
                WHERE object_name = :object_name
                  AND object_type = :object_type
                """,
                {
                    "object_name": object_name,
                    "object_type": object_type
                }
            )

            if cursor.fetchone()[0] == 0:
                raise ValueError(
                    "El objeto no existe en el esquema conectado."
                )

            command = COMPILE_COMMANDS[object_type]

            if object_type == "PACKAGE BODY":
                sql = (
                    f"{command} {owner}.{object_name} "
                    "COMPILE BODY"
                )

            else:
                sql = (
                    f"{command} {owner}.{object_name} "
                    "COMPILE"
                )

            cursor.execute(sql)

            cursor.execute(
                """
                SELECT status
                FROM user_objects
                WHERE object_name = :object_name
                  AND object_type = :object_type
                """,
                {
                    "object_name": object_name,
                    "object_type": object_type
                }
            )

            row = cursor.fetchone()

            status = row[0] if row else "UNKNOWN"

            return {
                "success": status == "VALID",
                "owner": owner,
                "object_name": object_name,
                "object_type": object_type,
                "status": status,
                "message": (
                    "Objeto recompilado correctamente."
                    if status == "VALID"
                    else "La recompilación terminó, "
                         "pero el objeto continúa inválido."
                )
            }

    finally:
        connection.close()