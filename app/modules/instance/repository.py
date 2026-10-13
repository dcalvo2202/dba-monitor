from pathlib import Path

from app.database.connection import get_connection


SQL_FILE = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "instance"
    / "get_instance_info.sql"
)

MEMORY_SQL_FILE = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "instance"
    / "get_memory_info.sql"
)

PDBS_SQL_FILE = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "instance"
    / "get_pdbs.sql"
)

# Composición de la SGA por componente (gráfico del Módulo 1).
SGA_COMPONENTS_SQL_FILE = (
    Path(__file__).resolve().parents[3]
    / "sql"
    / "oracle"
    / "instance"
    / "get_sga_components.sql"
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

def get_memory_info():
    query = MEMORY_SQL_FILE.read_text(encoding="utf-8")

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

def get_pdbs():
    query = PDBS_SQL_FILE.read_text(encoding="utf-8")

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

def get_sga_components():
    """Filas (nombre, bytes) de V$SGA, de mayor a menor tamaño."""
    query = SGA_COMPONENTS_SQL_FILE.read_text(encoding="utf-8")

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
