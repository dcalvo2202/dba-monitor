from app.modules.performance.repository import (
    get_active_sessions,
    get_blocked_sessions,
    get_top_sql,
)


def get_active_sessions_data():
    rows = get_active_sessions()

    sessions = []

    for row in rows:
        sessions.append(
            {
                "sid": row[0],
                "serial_number": row[1],
                "username": row[2],
                "status": row[3],
                "machine": row[4],
                "program": row[5],
                "logon_time": row[6],
            }
        )

    return sessions


def get_blocked_sessions_data():
    rows = get_blocked_sessions()

    sessions = []

    for row in rows:
        sessions.append(
            {
                "sid": row[0],
                "serial_number": row[1],
                "username": row[2],
                "status": row[3],
                "machine": row[4],
                "program": row[5],
                "blocking_session": row[6],
                "event": row[7],
                "seconds_in_wait": row[8],
            }
        )

    return sessions


def get_top_sql_data():
    rows = get_top_sql()

    queries = []

    for row in rows:
        queries.append(
            {
                "sql_id": row[0],
                "sql_text": row[1],
                "executions": row[2],
                "cpu_time_seconds": row[3],
                "elapsed_time_seconds": row[4],
                "buffer_gets": row[5],
                "disk_reads": row[6],
            }
        )

    return queries
