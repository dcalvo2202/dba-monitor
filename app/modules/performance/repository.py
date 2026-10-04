from pathlib import Path

from app.database.connection import get_connection


SQL_DIR = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "performance"
)

ACTIVE_SESSIONS_SQL_FILE = SQL_DIR / "get_active_sessions.sql"
BLOCKED_SESSIONS_SQL_FILE = SQL_DIR / "get_blocked_sessions.sql"
TOP_SQL_FILE = SQL_DIR / "get_top_sql.sql"


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


def get_top_sql():
    query = TOP_SQL_FILE.read_text(encoding="utf-8")

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