"""Lógica de negocio del Módulo 4 - Respaldo y recuperación.

Toma las filas que entrega `repository.py` y las convierte en información
útil para el administrador:

- Traduce el tipo y el estado de cada trabajo RMAN a un texto legible
  (ej. 'DB INCR' + nivel 0 -> "Incremental nivel 0 (base completa)").
- Identifica el último respaldo exitoso de la base y de los archived logs
  y calcula su antigüedad.
- Calcula el uso real de la Fast Recovery Area (FRA).
- Evalúa el riesgo de no poder recuperar la base de datos (OK,
  ADVERTENCIA o CRITICO) y explica cada hallazgo.

Todas las antigüedades se calculan con la hora del servidor Oracle
(SYSDATE), la misma referencia con la que RMAN registra sus fechas.
"""

from datetime import datetime
from typing import Any

from app.modules.backup import repository


# Niveles de la evaluación. INFO aporta contexto y no cambia el nivel general.
LEVEL_OK = "OK"
LEVEL_INFO = "INFO"
LEVEL_WARNING = "ADVERTENCIA"
LEVEL_CRITICAL = "CRITICO"

# Nivel general cuando el contenedor consultado no permite ver los respaldos
# (ver assess_recovery_risk): no se puede afirmar que haya o no riesgo.
LEVEL_NO_DATA = "SIN_DATOS"

_SEVERITY = {
    LEVEL_INFO: 0,
    LEVEL_OK: 0,
    LEVEL_WARNING: 1,
    LEVEL_CRITICAL: 2,
}

LEVEL_SUMMARIES = {
    LEVEL_OK: "La base de datos puede recuperarse con los respaldos existentes.",
    LEVEL_WARNING: "Hay situaciones que conviene corregir para garantizar la recuperación.",
    LEVEL_CRITICAL: "La base de datos no podría recuperarse de forma confiable ante una falla.",
    LEVEL_NO_DATA: (
        "El historial de respaldos no es visible desde este contenedor. "
        "Seleccione el perfil CDB$ROOT para evaluar la recuperación."
    ),
}

# Historial devuelto por defecto y máximo permitido por la API.
DEFAULT_HISTORY_LIMIT = 50
MAX_HISTORY_LIMIT = 500

# Antigüedad máxima del último respaldo de la base. Un respaldo diario es la
# práctica mínima habitual; 7 días coincide además con el tiempo que Oracle
# conserva por defecto el historial en el archivo de control
# (CONTROL_FILE_RECORD_KEEP_TIME).
DATABASE_BACKUP_WARNING_HOURS = 24
DATABASE_BACKUP_CRITICAL_HOURS = 7 * 24

# Antigüedad máxima del último respaldo de archived logs (en ARCHIVELOG).
ARCHIVELOG_BACKUP_WARNING_HOURS = 24

# Uso de la FRA. Son los mismos umbrales con los que Oracle escribe sus
# propias alertas de espacio en el alert log (85 % y 97 %).
FRA_WARNING_PERCENT = 85
FRA_CRITICAL_PERCENT = 97

# Estados de V$RMAN_BACKUP_JOB_DETAILS agrupados por resultado.
ERROR_STATUSES = frozenset({"FAILED", "COMPLETED WITH ERRORS"})
RUNNING_STATUSES = frozenset({"RUNNING", "RUNNING WITH WARNINGS", "RUNNING WITH ERRORS"})

STATUS_LABELS = {
    "COMPLETED": "Completado",
    "COMPLETED WITH WARNINGS": "Completado con advertencias",
    "COMPLETED WITH ERRORS": "Completado con errores",
    "FAILED": "Fallido",
    "RUNNING": "En ejecución",
    "RUNNING WITH WARNINGS": "En ejecución con advertencias",
    "RUNNING WITH ERRORS": "En ejecución con errores",
}

INPUT_TYPE_LABELS = {
    "DB FULL": "Completo de la base",
    "DB INCR": "Incremental de la base",
    "ARCHIVELOG": "Archived logs",
    "DATAFILE FULL": "Datafile completo",
    "DATAFILE INCR": "Datafile incremental",
    "CONTROLFILE": "Archivo de control",
    "SPFILE": "Archivo de parámetros (SPFILE)",
    "RECVR AREA": "Fast Recovery Area",
    "BACKUPSET": "Copia de respaldos existentes",
}

# Categorías: solo un respaldo de TODA la base permite restaurarla.
CATEGORY_DATABASE = "BASE_DATOS"
CATEGORY_ARCHIVELOG = "ARCHIVELOG"
CATEGORY_OTHER = "OTRO"

CDB_ROOT = "CDB$ROOT"


def _finding(level: str, message: str) -> dict[str, str]:
    """Crea un hallazgo de la evaluación con su nivel y explicación."""
    return {"level": level, "message": message}


def _to_mb(value: float | None) -> float | None:
    """Convierte bytes a megabytes con dos decimales (None se conserva)."""
    if value is None:
        return None

    return round(value / 1024 / 1024, 2)


def _hours_between(later: datetime, earlier: datetime) -> float:
    """Horas transcurridas entre dos fechas."""
    return (later - earlier).total_seconds() / 3600


def describe_backup_type(input_type: str | None, incremental_level: int | None) -> str:
    """Nombre legible del tipo de respaldo.

    Args:
        input_type: Valor de V$RMAN_BACKUP_JOB_DETAILS.INPUT_TYPE.
        incremental_level: 0 o 1 en respaldos incrementales; None en el resto.

    Ejemplos:
        ('DB INCR', 0)  -> 'Incremental nivel 0 (base completa)'
        ('DB INCR', 1)  -> 'Incremental nivel 1'
        ('ARCHIVELOG', None) -> 'Archived logs'
    """
    if input_type == "DB INCR" and incremental_level is not None:
        if incremental_level == 0:
            # Un nivel 0 contiene todos los bloques: equivale a un completo,
            # pero sirve de base para los niveles 1 siguientes.
            return "Incremental nivel 0 (base completa)"

        return f"Incremental nivel {incremental_level}"

    if input_type == "DATAFILE INCR" and incremental_level is not None:
        return f"Datafile incremental nivel {incremental_level}"

    return INPUT_TYPE_LABELS.get(input_type, input_type or "Desconocido")


def backup_category(input_type: str | None) -> str:
    """Clasifica un trabajo: respaldo de la base, de archived logs u otro."""
    if input_type in ("DB FULL", "DB INCR"):
        return CATEGORY_DATABASE

    if input_type == "ARCHIVELOG":
        return CATEGORY_ARCHIVELOG

    return CATEGORY_OTHER


def job_state(status: str | None) -> str:
    """Estado visual de un trabajo: 'ok', 'warning', 'error' o 'running'."""
    if status == "COMPLETED":
        return "ok"

    if status in ERROR_STATUSES:
        return "error"

    if status in RUNNING_STATUSES:
        return "running"

    # COMPLETED WITH WARNINGS u otro estado no documentado.
    return "warning"


def format_duration(seconds: float | None) -> str | None:
    """Duración legible: '45 s', '3 min 05 s' o '1 h 05 min'."""
    if seconds is None:
        return None

    total = int(round(seconds))

    if total < 60:
        return f"{total} s"

    minutes, secs = divmod(total, 60)

    if minutes < 60:
        return f"{minutes} min {secs:02d} s"

    hours, minutes = divmod(minutes, 60)

    return f"{hours} h {minutes:02d} min"


def format_age(hours: float) -> str:
    """Antigüedad legible: 'hace 15 min', 'hace 3 h' o 'hace 2 días'."""
    if hours < 1:
        return f"hace {max(int(hours * 60), 0)} min"

    if hours < 48:
        return f"hace {int(hours)} h"

    return f"hace {int(hours // 24)} días"


def _build_job(row: dict[str, Any]) -> dict[str, Any]:
    """Convierte una fila de RMAN en un trabajo listo para la interfaz."""
    status = row.get("status")
    compression = row.get("compression_ratio")
    elapsed = row.get("elapsed_seconds")

    return {
        "session_key": row.get("session_key"),
        "input_type": row.get("input_type"),
        "type_label": describe_backup_type(
            row.get("input_type"),
            row.get("incremental_level"),
        ),
        "category": backup_category(row.get("input_type")),
        "incremental_level": row.get("incremental_level"),
        "status": status,
        "status_label": STATUS_LABELS.get(status, status),
        "state": job_state(status),
        "start_time": row.get("start_time"),
        "end_time": row.get("end_time"),
        "elapsed_seconds": None if elapsed is None else int(round(elapsed)),
        "duration": format_duration(elapsed),
        "input_mb": _to_mb(row.get("input_bytes")),
        "output_mb": _to_mb(row.get("output_bytes")),
        "compression_ratio": None if compression is None else round(compression, 2),
        "device": row.get("output_device_type"),
    }


def _build_last_backup(row: dict[str, Any] | None, now: datetime) -> dict[str, Any] | None:
    """Último respaldo exitoso de una categoría, con su antigüedad."""
    if row is None:
        return None

    backup = _build_job(row)
    age_hours = _hours_between(now, row["end_time"])

    backup["age_hours"] = round(age_hours, 1)
    backup["age_label"] = format_age(age_hours)

    return backup


def _build_recovery_area(config: dict[str, Any]) -> dict[str, Any] | None:
    """Uso de la Fast Recovery Area; None si no es visible o no existe.

    El uso "real" descuenta el espacio recuperable: son archivos que RMAN
    ya considera obsoletos y que Oracle borra solo cuando necesita espacio.
    """
    limit = config.get("fra_limit_bytes")

    if not limit:
        return None

    used = config.get("fra_used_bytes") or 0
    reclaimable = config.get("fra_reclaimable_bytes") or 0
    effective_used = max(used - reclaimable, 0)

    return {
        "path": config.get("fra_path"),
        "limit_mb": _to_mb(limit),
        "used_mb": _to_mb(used),
        "reclaimable_mb": _to_mb(reclaimable),
        "usage_percent": round(effective_used / limit * 100, 1),
        "files": config.get("fra_files"),
    }


def _assess_database_backup(last_database: dict[str, Any] | None) -> dict[str, str]:
    """Hallazgo sobre el último respaldo exitoso de la base completa."""
    if last_database is None:
        return _finding(
            LEVEL_CRITICAL,
            "No hay ningún respaldo exitoso de la base de datos registrado. "
            "Ante la pérdida de un datafile, los datos no podrían recuperarse.",
        )

    age_hours = last_database["age_hours"]
    description = f"{last_database['type_label']}, {last_database['age_label']}"

    if age_hours > DATABASE_BACKUP_CRITICAL_HOURS:
        return _finding(
            LEVEL_CRITICAL,
            f"El último respaldo exitoso de la base ({description}) supera los "
            f"{DATABASE_BACKUP_CRITICAL_HOURS // 24} días. Una recuperación "
            "perdería o tendría que reconstruir todos los cambios posteriores.",
        )

    if age_hours > DATABASE_BACKUP_WARNING_HOURS:
        return _finding(
            LEVEL_WARNING,
            f"El último respaldo exitoso de la base ({description}) tiene más de "
            f"{DATABASE_BACKUP_WARNING_HOURS} horas. Se recomienda al menos un "
            "respaldo diario.",
        )

    return _finding(
        LEVEL_OK,
        f"La base tiene un respaldo exitoso reciente ({description}).",
    )


def _assess_latest_job(jobs: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Hallazgos sobre el trabajo más reciente y los fallos del historial."""
    if not jobs:
        return []

    findings = []
    latest = jobs[0]
    description = f"{latest['type_label']}, iniciado el {latest['start_time']:%d/%m/%Y %H:%M}"

    if latest["state"] == "error":
        findings.append(_finding(
            LEVEL_WARNING,
            f"El trabajo más reciente ({description}) terminó con estado "
            f"«{latest['status_label']}». Revise la salida de RMAN para conocer la causa.",
        ))
    elif latest["state"] == "warning":
        findings.append(_finding(
            LEVEL_WARNING,
            f"El trabajo más reciente ({description}) terminó con advertencias.",
        ))
    elif latest["state"] == "running":
        findings.append(_finding(
            LEVEL_INFO,
            f"Hay un respaldo en ejecución ({description}).",
        ))

    # Fallos anteriores: ya no son el estado actual, pero conviene saberlos.
    older_failures = sum(1 for job in jobs[1:] if job["state"] == "error")

    if older_failures:
        findings.append(_finding(
            LEVEL_INFO,
            f"El historial mostrado tiene {older_failures} trabajo(s) fallido(s) anteriores.",
        ))

    return findings


def _assess_archiving(
    log_mode: str | None,
    last_archivelog: dict[str, Any] | None,
) -> dict[str, str]:
    """Hallazgo sobre el modo de archivado y el respaldo de archived logs."""
    if log_mode != "ARCHIVELOG":
        return _finding(
            LEVEL_WARNING,
            "La base está en modo NOARCHIVELOG: solo puede recuperarse hasta el "
            "último respaldo (se pierden los cambios posteriores) y RMAN no "
            "puede respaldarla mientras está abierta.",
        )

    if last_archivelog is None:
        return _finding(
            LEVEL_WARNING,
            "La base está en ARCHIVELOG, pero los archived logs nunca se han "
            "respaldado. Si se pierde el disco de la FRA, los cambios posteriores "
            "al último respaldo no podrían recuperarse.",
        )

    if last_archivelog["age_hours"] > ARCHIVELOG_BACKUP_WARNING_HOURS:
        return _finding(
            LEVEL_WARNING,
            f"El último respaldo de archived logs es de {last_archivelog['age_label']}. "
            f"Se recomienda respaldarlos al menos cada {ARCHIVELOG_BACKUP_WARNING_HOURS} horas.",
        )

    return _finding(
        LEVEL_OK,
        "Modo ARCHIVELOG activo y archived logs respaldados "
        f"{last_archivelog['age_label']}: la base puede recuperarse hasta el "
        "último cambio confirmado.",
    )


def _assess_recovery_area(
    recovery_area: dict[str, Any] | None,
    container_name: str | None,
) -> dict[str, str]:
    """Hallazgo sobre el espacio disponible en la Fast Recovery Area."""
    if recovery_area is None:
        if container_name != CDB_ROOT:
            return _finding(
                LEVEL_INFO,
                f"La Fast Recovery Area no es visible desde {container_name}. "
                "Seleccione el perfil CDB$ROOT para consultarla.",
            )

        return _finding(
            LEVEL_INFO,
            "No hay una Fast Recovery Area configurada: RMAN guarda los "
            "respaldos en su ruta por defecto y Oracle no controla su espacio.",
        )

    usage = recovery_area["usage_percent"]

    # Coma decimal, igual que el resto de la interfaz (formato es-CR).
    usage_text = f"{usage:.1f}".replace(".", ",")

    if usage >= FRA_CRITICAL_PERCENT:
        return _finding(
            LEVEL_CRITICAL,
            f"La Fast Recovery Area está al {usage_text} % de su límite. Si se llena, "
            "Oracle no puede archivar los redo logs y la base de datos se detiene.",
        )

    if usage >= FRA_WARNING_PERCENT:
        return _finding(
            LEVEL_WARNING,
            f"La Fast Recovery Area está al {usage_text} % de su límite. Conviene "
            "eliminar respaldos obsoletos o ampliar DB_RECOVERY_FILE_DEST_SIZE.",
        )

    return _finding(
        LEVEL_OK,
        f"La Fast Recovery Area usa el {usage_text} % de su límite.",
    )


def assess_recovery_risk(
    jobs: list[dict[str, Any]],
    last_database: dict[str, Any] | None,
    last_archivelog: dict[str, Any] | None,
    log_mode: str | None,
    recovery_area: dict[str, Any] | None,
    container_name: str | None,
) -> dict[str, Any]:
    """Evalúa el riesgo de no poder recuperar la base de datos.

    Returns:
        {"level": "OK" | "ADVERTENCIA" | "CRITICO" | "SIN_DATOS",
         "summary": explicación general,
         "findings": [{"level", "message"}, ...]} ordenados de más a menos
        grave. El nivel general es el del hallazgo más grave.
    """
    # Oracle no muestra el historial RMAN desde una PDB (verificado en XE 21c:
    # V$RMAN_BACKUP_JOB_DETAILS queda vacía en XEPDB1 aunque existan
    # respaldos). Afirmar "no hay respaldos" sería un diagnóstico falso, así
    # que solo se evalúa lo que sí es visible: el modo de archivado y la FRA.
    if not jobs and container_name != CDB_ROOT:
        findings = [
            _finding(
                LEVEL_INFO,
                "Los respaldos RMAN se registran a nivel de CDB y Oracle no "
                f"muestra su historial desde {container_name}. Seleccione el "
                "perfil CDB$ROOT para ver los respaldos y su antigüedad.",
            ),
            _assess_recovery_area(recovery_area, container_name),
        ]

        if log_mode != "ARCHIVELOG":
            findings.insert(0, _assess_archiving(log_mode, None))

        return {
            "level": LEVEL_NO_DATA,
            "summary": LEVEL_SUMMARIES[LEVEL_NO_DATA],
            "findings": findings,
        }

    findings = [
        _assess_database_backup(last_database),
        *_assess_latest_job(jobs),
        _assess_archiving(log_mode, last_archivelog),
        _assess_recovery_area(recovery_area, container_name),
    ]

    # sort() es estable: a igual gravedad se conserva el orden de arriba.
    findings.sort(key=lambda finding: _SEVERITY[finding["level"]], reverse=True)

    worst = max(_SEVERITY[finding["level"]] for finding in findings)
    level = {0: LEVEL_OK, 1: LEVEL_WARNING, 2: LEVEL_CRITICAL}[worst]

    return {
        "level": level,
        "summary": LEVEL_SUMMARIES[level],
        "findings": findings,
    }


def _summarize_jobs(jobs: list[dict[str, Any]], total_jobs: int) -> dict[str, int]:
    """Conteo de los trabajos mostrados según su resultado."""
    return {
        "total_jobs": total_jobs,
        "shown": len(jobs),
        "completed": sum(1 for job in jobs if job["state"] == "ok"),
        "warnings": sum(1 for job in jobs if job["state"] == "warning"),
        "failed": sum(1 for job in jobs if job["state"] == "error"),
        "running": sum(1 for job in jobs if job["state"] == "running"),
    }


def get_backup_history(max_rows: int = DEFAULT_HISTORY_LIMIT) -> dict[str, Any]:
    """Historial de trabajos RMAN, del más reciente al más antiguo.

    Raises:
        oracledb.Error: Si Oracle no está disponible o faltan privilegios.
    """
    rows = repository.get_backup_jobs(max_rows)
    jobs = [_build_job(row) for row in rows]
    total_jobs = rows[0]["total_rows"] if rows else 0

    return {
        "jobs": jobs,
        "summary": _summarize_jobs(jobs, total_jobs),
    }


def get_backup_report(max_rows: int = DEFAULT_HISTORY_LIMIT) -> dict[str, Any]:
    """Estado completo de los respaldos y su evaluación de riesgo.

    Returns:
        Diccionario con:
            database_name, container_name, log_mode, checked_at
            last_backup: {"database": ..., "archivelog": ...} (None si no hay)
            recovery_area: uso de la FRA (None si no es visible)
            assessment: nivel de riesgo y hallazgos
            jobs, summary: historial y su conteo por resultado

    Raises:
        oracledb.Error: Si Oracle no está disponible o faltan privilegios.
    """
    config = repository.get_recovery_config()
    history = get_backup_history(max_rows)
    last_rows = {
        row["category"]: row
        for row in repository.get_last_successful_backups()
    }

    now = config["current_time"]
    last_database = _build_last_backup(last_rows.get(CATEGORY_DATABASE), now)
    last_archivelog = _build_last_backup(last_rows.get(CATEGORY_ARCHIVELOG), now)
    recovery_area = _build_recovery_area(config)

    return {
        "database_name": config["database_name"],
        "container_name": config["container_name"],
        "log_mode": config["log_mode"],
        "checked_at": now,
        "last_backup": {
            "database": last_database,
            "archivelog": last_archivelog,
        },
        "recovery_area": recovery_area,
        "assessment": assess_recovery_risk(
            history["jobs"],
            last_database,
            last_archivelog,
            config["log_mode"],
            recovery_area,
            config["container_name"],
        ),
        **history,
    }
