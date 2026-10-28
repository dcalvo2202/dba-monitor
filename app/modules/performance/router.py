import logging
from collections.abc import Callable
from typing import Any

import oracledb
from fastapi import APIRouter, HTTPException

from app.modules.performance import service


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/performance",
    tags=["Rendimiento"],
)


def _run(operation: Callable[[], Any], description: str) -> Any:
    """Traduce errores de configuración y Oracle en respuestas 503 legibles."""
    try:
        return operation()
    except (ValueError, OSError) as error:
        logger.exception("Error de configuración al consultar %s", description)
        raise HTTPException(
            status_code=503,
            detail=(
                f"No se pudo consultar {description}: {error} "
                "Revise el perfil de conexión y los archivos SQL del módulo."
            ),
        ) from error
    except oracledb.Error as error:
        logger.exception("Error de Oracle al consultar %s", description)
        oracle_error = error.args[0] if error.args else None
        code = getattr(oracle_error, "full_code", "desconocido")
        raise HTTPException(
            status_code=503,
            detail=(
                f"No se pudo consultar {description} en Oracle ({code}). "
                "Verifique la conexión y los permisos de DBA_MONITOR."
            ),
        ) from error


@router.get("/sessions")
def read_active_sessions():
    return _run(service.get_active_sessions_data, "las sesiones activas")


@router.get("/blocked-sessions")
def read_blocked_sessions():
    return _run(service.get_blocked_sessions_data, "las sesiones bloqueadas")


@router.get("/top-sql")
def read_top_sql():
    return _run(service.get_top_sql_data, "las consultas SQL de mayor consumo")


@router.get("/query-times")
def read_query_times():
    return _run(service.get_query_times_data, "los tiempos de ejecución SQL")


@router.get("/resource-usage")
def read_resource_usage():
    return _run(service.get_resource_usage_data, "el consumo de CPU y memoria")