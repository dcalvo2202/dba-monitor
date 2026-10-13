"""Lógica de negocio del Módulo 3 - Gestión del almacenamiento.

Toma las filas que entrega `repository.py` y las convierte en información
útil para el administrador:

- Convierte los tamaños de bytes a megabytes.
- Calcula el uso de cada tablespace sobre su tamaño MÁXIMO (considerando la
  autoextensión) y marca los que están cerca de llenarse.
- Resume el tamaño de la base de datos (asignado frente a usado).
- Compara las mediciones del historial para calcular el crecimiento, su
  ritmo diario y una estimación de cuándo se llenaría el espacio.
"""

from collections import defaultdict
from datetime import datetime
from typing import Any

import oracledb

from app.modules.storage import repository


# Uso de un tablespace permanente respecto de su tamaño máximo.
TABLESPACE_WARNING_PERCENT = 85
TABLESPACE_CRITICAL_PERCENT = 95

# Objetos de mayor tamaño devueltos por defecto y máximo permitido.
DEFAULT_LARGE_OBJECTS = 20
MAX_LARGE_OBJECTS = 200

# Antigüedad del historial consultado por defecto y máxima, en días.
DEFAULT_HISTORY_DAYS = 90
MAX_HISTORY_DAYS = 3650

# Separación mínima entre la primera y la última medición para calcular un
# ritmo diario. Con mediciones de minutos de diferencia, extrapolar a un día
# multiplicaría cualquier variación pequeña y daría cifras sin sentido.
MIN_DAYS_FOR_RATE = 1

CONTENTS_LABELS = {
    "PERMANENT": "Permanente",
    "UNDO": "Undo",
    "TEMPORARY": "Temporal",
}

# ORA-00942: la tabla del historial no existe en el contenedor consultado.
_TABLE_NOT_FOUND = "ORA-00942"


def _to_mb(value: float | None) -> float | None:
    """Convierte bytes a megabytes con dos decimales (None se conserva)."""
    if value is None:
        return None

    return round(value / 1024 / 1024, 2)


def _percent(part: float | None, whole: float | None) -> float | None:
    """Porcentaje con un decimal; None si no se puede calcular."""
    if part is None or not whole:
        return None

    return round(part / whole * 100, 1)


def tablespace_state(contents: str, max_used_percent: float | None) -> str:
    """Estado del tablespace: 'ok', 'warning' o 'critical'.

    Solo se alerta sobre los tablespaces PERMANENTES. En UNDO y TEMPORARY un
    uso alto es normal: Oracle conserva el undo vencido y los segmentos
    temporales para reutilizarlos, y los libera cuando hace falta.
    """
    if contents != "PERMANENT" or max_used_percent is None:
        return "ok"

    if max_used_percent >= TABLESPACE_CRITICAL_PERCENT:
        return "critical"

    if max_used_percent >= TABLESPACE_WARNING_PERCENT:
        return "warning"

    return "ok"


def _build_tablespace(row: dict[str, Any]) -> dict[str, Any]:
    """Convierte una fila de get_tablespace_usage.sql para la interfaz."""
    used = row["used_bytes"]
    total = row["total_bytes"]
    maximum = row["max_bytes"]
    max_used_percent = _percent(used, maximum)

    return {
        "tablespace_name": row["tablespace_name"],
        "contents": row["contents"],
        "contents_label": CONTENTS_LABELS.get(row["contents"], row["contents"]),
        "status": row["status"],
        "total_mb": _to_mb(total),
        "used_mb": _to_mb(used),
        "free_mb": _to_mb(row["free_bytes"]),
        "max_mb": _to_mb(maximum),
        "used_percent": _percent(used, total),
        "max_used_percent": max_used_percent,
        "file_count": row["file_count"],
        "autoextensible": row["autoextensible"] == "YES",
        "state": tablespace_state(row["contents"], max_used_percent),
    }


def get_tablespaces() -> list[dict[str, Any]]:
    """Tablespaces ordenados del más cercano a llenarse al menos.

    Raises:
        oracledb.Error: Si Oracle no está disponible o faltan privilegios.
    """
    tablespaces = [_build_tablespace(row) for row in repository.get_tablespace_usage()]

    return sorted(
        tablespaces,
        key=lambda tablespace: tablespace["max_used_percent"] or 0,
        reverse=True,
    )


def get_database_size() -> dict[str, Any]:
    """Tamaño asignado en disco, espacio usado por objetos y máximo posible."""
    row = repository.get_database_size()

    return {
        "container_name": row["container_name"],
        "allocated_mb": _to_mb(row["datafile_bytes"]),
        "used_mb": _to_mb(row["segment_bytes"]),
        "tempfile_mb": _to_mb(row["tempfile_bytes"]),
        "max_mb": _to_mb(row["datafile_max_bytes"]),
        "used_percent": _percent(row["segment_bytes"], row["datafile_bytes"]),
    }


def get_datafiles() -> list[dict[str, Any]]:
    """Archivos de datos y temporales con su tamaño y capacidad de crecer."""
    return [
        {
            "file_type": row["file_type"],
            "file_id": row["file_id"],
            "file_name": row["file_name"],
            "tablespace_name": row["tablespace_name"],
            "size_mb": _to_mb(row["bytes"]),
            "max_mb": _to_mb(row["max_bytes"]),
            "increment_mb": _to_mb(row["increment_bytes"]),
            "autoextensible": row["autoextensible"] == "YES",
            "status": row["status"],
        }
        for row in repository.get_datafiles()
    ]


def get_large_objects(
    include_oracle: bool = False,
    max_rows: int = DEFAULT_LARGE_OBJECTS,
) -> list[dict[str, Any]]:
    """Objetos (segmentos) de mayor tamaño."""
    return [
        {
            "owner": row["owner"],
            "segment_name": row["segment_name"],
            "partition_name": row["partition_name"],
            "segment_type": row["segment_type"],
            "tablespace_name": row["tablespace_name"],
            "size_mb": _to_mb(row["bytes"]),
            "extents": row["extents"],
            "oracle_maintained": row["oracle_maintained"] == "Y",
        }
        for row in repository.get_large_objects(include_oracle, max_rows)
    ]


def _days_between(later: datetime, earlier: datetime) -> float:
    """Días (con decimales) entre dos fechas."""
    return (later - earlier).total_seconds() / 86_400


def _summarize_growth(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Agrupa las mediciones y compara la primera con la última.

    Cada medición tiene una fila por tablespace con la misma fecha
    (captured_at); se suman para obtener el total de la base.
    """
    by_date: dict[datetime, list[dict[str, Any]]] = defaultdict(list)

    for row in rows:
        by_date[row["captured_at"]].append(row)

    snapshots = [
        {
            "captured_at": captured_at,
            "used_mb": _to_mb(sum(row["used_bytes"] for row in group)),
            "total_mb": _to_mb(sum(row["total_bytes"] for row in group)),
            "max_mb": _to_mb(sum(row["max_bytes"] for row in group)),
            "tablespaces": len(group),
        }
        for captured_at, group in sorted(by_date.items())
    ]

    result: dict[str, Any] = {
        "available": True,
        "snapshots": snapshots,
        "comparison": None,
        "by_tablespace": [],
    }

    # Comparar necesita al menos dos mediciones.
    if len(snapshots) < 2:
        result["message"] = (
            "Se necesitan al menos dos mediciones para calcular el crecimiento. "
            "Use «Registrar medición» o espere la medición diaria automática."
        )
        return result

    first, last = snapshots[0], snapshots[-1]
    days = _days_between(last["captured_at"], first["captured_at"])
    growth_mb = round(last["used_mb"] - first["used_mb"], 2)
    mb_per_day = round(growth_mb / days, 2) if days >= MIN_DAYS_FOR_RATE else None

    # Proyección lineal: días hasta ocupar el tamaño máximo con el ritmo
    # actual. Solo tiene sentido si la base está creciendo.
    days_to_full = None
    if mb_per_day and mb_per_day > 0:
        days_to_full = int((last["max_mb"] - last["used_mb"]) / mb_per_day)

    result["comparison"] = {
        "from": first["captured_at"],
        "to": last["captured_at"],
        "days": round(days, 1),
        "used_from_mb": first["used_mb"],
        "used_to_mb": last["used_mb"],
        "growth_mb": growth_mb,
        "growth_percent": _percent(growth_mb, first["used_mb"]),
        "mb_per_day": mb_per_day,
        "days_to_full": days_to_full,
    }

    # Crecimiento de cada tablespace entre la primera y la última medición.
    first_rows = {row["tablespace_name"]: row for row in by_date[first["captured_at"]]}
    last_rows = {row["tablespace_name"]: row for row in by_date[last["captured_at"]]}

    result["by_tablespace"] = sorted(
        (
            {
                "tablespace_name": name,
                "used_from_mb": _to_mb(first_rows[name]["used_bytes"]),
                "used_to_mb": _to_mb(row["used_bytes"]),
                "growth_mb": _to_mb(row["used_bytes"] - first_rows[name]["used_bytes"]),
            }
            for name, row in last_rows.items()
            if name in first_rows
        ),
        key=lambda item: item["growth_mb"],
        reverse=True,
    )

    return result


def get_storage_growth(days: int = DEFAULT_HISTORY_DAYS) -> dict[str, Any]:
    """Historial de mediciones y comparación del crecimiento.

    Si la tabla del historial no existe en el contenedor consultado (por
    ejemplo, desde CDB$ROOT, o si no se ejecutó create_storage_history.sql)
    se devuelve available=False con una explicación, sin fallar el resto
    del módulo.

    Raises:
        oracledb.Error: Cualquier otro error de Oracle.
    """
    try:
        rows = repository.get_storage_history(days)

    except oracledb.DatabaseError as error:
        oracle_error = error.args[0] if error.args else None

        if getattr(oracle_error, "full_code", None) != _TABLE_NOT_FOUND:
            raise

        return {
            "available": False,
            "snapshots": [],
            "comparison": None,
            "by_tablespace": [],
            "message": (
                "El historial de crecimiento no está disponible en este contenedor. "
                "Se registra en XEPDB1: seleccione ese perfil o ejecute "
                "sql/oracle/storage/setup/create_storage_history.sql."
            ),
        }

    return _summarize_growth(rows)


def create_storage_snapshot() -> dict[str, Any]:
    """Registra una medición y devuelve el historial actualizado."""
    repository.record_storage_snapshot()

    return {
        "message": "Medición de almacenamiento registrada correctamente.",
        "growth": get_storage_growth(),
    }


def get_storage_summary(
    include_oracle: bool = False,
    max_objects: int = DEFAULT_LARGE_OBJECTS,
    days: int = DEFAULT_HISTORY_DAYS,
) -> dict[str, Any]:
    """Resumen completo del módulo para la página /almacenamiento.

    Returns:
        database_size, tablespaces, datafiles, large_objects, growth y
        alerts (conteo de tablespaces permanentes en advertencia o
        críticos).
    """
    tablespaces = get_tablespaces()

    return {
        "database_size": get_database_size(),
        "tablespaces": tablespaces,
        "datafiles": get_datafiles(),
        "large_objects": get_large_objects(include_oracle, max_objects),
        "growth": get_storage_growth(days),
        "alerts": {
            "warning": sum(1 for item in tablespaces if item["state"] == "warning"),
            "critical": sum(1 for item in tablespaces if item["state"] == "critical"),
        },
    }
