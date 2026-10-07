from app.modules.instance.repository import get_instance_info


def format_uptime(total_seconds: int) -> str:
    days, remainder = divmod(total_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, seconds = divmod(remainder, 60)

    return f"{days}d {hours}h {minutes}m {seconds}s"


def get_instance_status():
    row = get_instance_info()

    if row is None:
        return None

    (
        instance_name,
        host_name,
        version,
        status,
        startup_time,
        uptime_seconds,
    ) = row

    return {
        "instance_name": instance_name,
        "host_name": host_name,
        "version": version,
        "status": status,
        "startup_time": startup_time,
        "uptime_seconds": uptime_seconds,
        "uptime": format_uptime(uptime_seconds),
    }