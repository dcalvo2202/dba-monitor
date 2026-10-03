from pathlib import Path

from app.database.connection import get_connection


ACTIVE_SESSIONS_SQL_FILE = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "performance"
    / "get_active_sessions.sql"
)


def get_active_sessions():
    sql = ACTIVE_SESSIONS_SQL_FILE.read_text(encoding="utf-8")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            return cursor.fetchall()
