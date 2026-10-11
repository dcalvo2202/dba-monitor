from pathlib import Path

from app.database.connection import get_connection


# Ruta donde se encuentran las consultas SQL del módulo.
SQL_DIR = Path(__file__).resolve().parents[3] / "sql" / "storage"


def _load_sql(filename: str) -> str:
    """
    Lee una consulta SQL desde la carpeta sql/storage.
    """
    sql_path = SQL_DIR / filename

    if not sql_path.exists():
        raise FileNotFoundError(
            f"No se encontró el archivo SQL: {sql_path}"
        )

    return sql_path.read_text(encoding="utf-8").strip()


def _execute_query(filename: str) -> list[dict]:
    """
    Ejecuta una consulta SELECT y devuelve los resultados
    como una lista de diccionarios.
    """
    sql = _load_sql(filename)

    connection = get_connection()

    try:
        cursor = connection.cursor()

        try:
            cursor.execute(sql)

            columns = [
                column[0].lower()
                for column in cursor.description
            ]

            rows = cursor.fetchall()

            return [
                dict(zip(columns, row))
                for row in rows
            ]

        finally:
            cursor.close()

    finally:
        connection.close()


def get_tablespace_usage() -> list[dict]:
    """
    Obtiene el espacio total, utilizado y disponible
    de los tablespaces.
    """
    return _execute_query("get_tablespace_usage.sql")


def get_database_size() -> dict:
    """
    Obtiene el tamaño total de la base de datos.
    """
    rows = _execute_query("get_database_size.sql")

    if not rows:
        return {}

    return rows[0]


def get_datafiles() -> list[dict]:
    """
    Obtiene información de los datafiles de Oracle.
    """
    return _execute_query("get_datafiles.sql")


def get_large_objects() -> list[dict]:
    """
    Obtiene los objetos/segmentos que utilizan
    mayor cantidad de almacenamiento.
    """
    return _execute_query("get_large_objects.sql")


def get_storage_history() -> list[dict]:
    """
    Obtiene las mediciones históricas de almacenamiento.
    """
    return _execute_query("get_storage_history.sql")


def insert_storage_snapshot() -> int:
    """
    Registra una nueva medición del uso de almacenamiento.

    Retorna la cantidad de filas insertadas.
    """
    sql = _load_sql("insert_storage_snapshot.sql")

    connection = get_connection()

    try:
        cursor = connection.cursor()

        try:
            cursor.execute(sql)

            rows_inserted = cursor.rowcount

            connection.commit()

            return rows_inserted

        except Exception:
            connection.rollback()
            raise

        finally:
            cursor.close()

    finally:
        connection.close()