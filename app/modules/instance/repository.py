from pathlib import Path

from app.database.connection import get_connection


SQL_FILE = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "instance"
    / "get_instance_info.sql"
)


def get_instance_info():
    query = SQL_FILE.read_text(encoding="utf-8")

    connection = get_connection()

    try:
        cursor = connection.cursor()

        try:
            cursor.execute(query)
            return cursor.fetchone()

        finally:
            cursor.close()

    finally:
        connection.close()