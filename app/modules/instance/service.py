from app.modules.instance.repository import get_instance_info


def get_instance_status():
    row = get_instance_info()

    if row is None:
        return None

    instance_name, host_name, version, status, startup_time = row

    return {
        "instance_name": instance_name,
        "host_name": host_name,
        "version": version,
        "status": status,
        "startup_time": startup_time,
    }