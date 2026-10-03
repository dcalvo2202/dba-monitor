from app.modules.instance.repository import (
    get_instance_info,
    get_memory_info,
    get_pdbs,
)


def format_uptime(total_seconds: int) -> str:
    days, remainder = divmod(total_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, seconds = divmod(remainder, 60)

    return f"{days}d {hours}h {minutes}m {seconds}s"

def bytes_to_mb(value: int) -> float:
    return round(value / (1024 * 1024), 2)

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
        database_name,
        container_name,
        service_name,
    ) = row

    return {
    "dbms": "Oracle Database",
    "instance_name": instance_name,
    "host_name": host_name,
    "version": version,
    "status": status,
    "startup_time": startup_time,
    "uptime_seconds": uptime_seconds,
    "uptime": format_uptime(uptime_seconds),
    "database_name": database_name,
    "container_name": container_name,
    "service_name": service_name,
    }

def get_memory_status():
    row = get_memory_info()

    if row is None:
        return None

    (
        sga_allocated_bytes,
        sga_free_bytes,
        pga_allocated_bytes,
        pga_inuse_bytes,
    ) = row

    sga_used_estimated_bytes = sga_allocated_bytes - sga_free_bytes

    total_allocated_bytes = ( 
        sga_allocated_bytes + pga_allocated_bytes 
    )
    
    total_used_estimated_bytes = (
        sga_used_estimated_bytes + pga_inuse_bytes
    )

    return {
        "sga_allocated_mb": bytes_to_mb(sga_allocated_bytes),
        "sga_free_mb": bytes_to_mb(sga_free_bytes),
        "sga_used_estimated_mb": bytes_to_mb(sga_used_estimated_bytes),
        "pga_allocated_mb": bytes_to_mb(pga_allocated_bytes),
        "pga_inuse_mb": bytes_to_mb(pga_inuse_bytes),
        "total_allocated_mb": bytes_to_mb(total_allocated_bytes),
        "total_used_estimated_mb": bytes_to_mb(total_used_estimated_bytes),
    }

def get_pdb_status():
    rows = get_pdbs()

    return [
        {
            "name": name,
            "open_mode": open_mode,
            "restricted": restricted,
        }
        for name, open_mode, restricted in rows
    ]

def get_instance_overview():
    instance_status = get_instance_status()
    memory_status = get_memory_status()
    pdbs = get_pdb_status()

    if instance_status is None:
        return None

    return {
        **instance_status,
        "memory": memory_status,
        "pdbs": pdbs,
    }