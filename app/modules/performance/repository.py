from pathlib import Path

from app.database.connection import get_connection


ACTIVE_SESSIONS_SQL_FILE = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "performance"
    / "get_active_sessions.sql"
)

BLOCKED_SESSIONS_SQL_FILE = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "performance"
    / "get_blocked_sessions.sql"
)


def get_active_sessions():
    query = ACTIVE_SESSIONS_SQL_FILE.read_text(encoding="utf-8")

    connection = get_connection()

    try:
        cursor = connection.cursor()

        try:
            cursor.execute(query)
            return cursor.fetchall()

        finally:
            cursor.close()

    finally:
        connection.close()


def get_blocked_sessions():
    query = BLOCKED_SESSIONS_SQL_FILE.read_text(encoding="utf-8")

    connection = get_connection()

    try:
        cursor = connection.cursor()

        try:
            cursor.execute(query)
            return cursor.fetchall()

        finally:
            cursor.close()

    finally:
        connection.close()