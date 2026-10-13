"""Endpoints HTTP del Módulo 4 - Respaldo y recuperación.

Expone la información de respaldos bajo el prefijo /api/backup. Esta capa
solo valida los parámetros de entrada, delega en `service.py` y traduce los
errores a respuestas HTTP con mensajes comprensibles para el usuario.

Endpoints:
    GET /api/backup            Estado de los respaldos, evaluación de riesgo
                               e historial.
    GET /api/backup/history    Solo el historial de trabajos RMAN.
"""

import logging
from collections.abc import Callable
from typing import Any

import oracledb
from fastapi import APIRouter, HTTPException, Query

from app.modules.backup import service


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/backup",
    tags=["Respaldo y recuperación"],
)

MAX_ROWS_DESCRIPTION = "Máximo de trabajos RMAN a devolver, del más reciente al más antiguo."


def _run(operation: Callable[[], Any], description: str) -> Any:
    """Ejecuta una operación del servicio y convierte los errores de Oracle.

    Args:
        operation: Función sin argumentos que realiza la consulta.
        description: Qué se intentaba consultar; se incluye en el mensaje.

    Raises:
        HTTPException 503: Oracle no está disponible o rechazó la consulta
            (por ejemplo, ORA-00942 si no se ejecutó
            sql/oracle/backup/setup/grants.sql), o la aplicación no está
            configurada correctamente.
    """
    try:
        return operation()

    except (ValueError, OSError) as error:
        # ValueError: get_connection() detectó variables faltantes en .env.
        # OSError: no se pudo leer el archivo .sql de la consulta.
        logger.exception("Error de configuración al consultar %s", description)

        raise HTTPException(
            status_code=503,
            detail=(
                f"No se pudo consultar {description}: {error} "
                "Revise el archivo .env y la instalación del proyecto."
            ),
        ) from error

    except oracledb.Error as error:
        # El detalle técnico completo queda en el log del servidor; al
        # cliente se le envía un mensaje claro con el código de Oracle.
        logger.exception("Error de Oracle al consultar %s", description)

        oracle_error = error.args[0] if error.args else None
        code = getattr(oracle_error, "full_code", "desconocido")

        raise HTTPException(
            status_code=503,
            detail=(
                f"No se pudo consultar {description} en Oracle ({code}). "
                "Verifique la conexión y que se ejecutó "
                "sql/oracle/backup/setup/grants.sql."
            ),
        ) from error


@router.get("")
def read_backup_status(
    max_rows: int = Query(
        service.DEFAULT_HISTORY_LIMIT,
        ge=1,
        le=service.MAX_HISTORY_LIMIT,
        description=MAX_ROWS_DESCRIPTION,
    ),
):
    """Último respaldo exitoso, modo de archivado, FRA, riesgo e historial."""
    return _run(
        lambda: service.get_backup_report(max_rows),
        "el estado de los respaldos",
    )


@router.get("/history")
def read_backup_history(
    max_rows: int = Query(
        service.DEFAULT_HISTORY_LIMIT,
        ge=1,
        le=service.MAX_HISTORY_LIMIT,
        description=MAX_ROWS_DESCRIPTION,
    ),
):
    """Historial de trabajos de respaldo RMAN."""
    return _run(
        lambda: service.get_backup_history(max_rows),
        "el historial de respaldos",
    )
