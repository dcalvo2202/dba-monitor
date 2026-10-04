from app.modules.performance.repository import (
    get_active_sessions,
    get_blocked_sessions,
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
