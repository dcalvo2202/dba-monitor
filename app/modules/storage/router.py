"""Endpoints HTTP del Módulo 3 - Gestión del almacenamiento.

Expone la información de almacenamiento bajo el prefijo /api/storage.
Esta capa valida parámetros, delega en service.py y traduce errores
a respuestas HTTP comprensibles.

Endpoints:
    GET  /api/storage
    GET  /api/storage/tablespaces
    GET  /api/storage/database-size
    GET  /api/storage/datafiles
    GET  /api/storage/large-objects
    GET  /api/storage/growth
    POST /api/storage/snapshot
"""

import logging
from collections.abc import Callable
from typing import Any

import oracledb
from fastapi import APIRouter, HTTPException, Query

from app.modules.storage import service


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/storage",
    tags=["Almacenamiento"],
)

INCLUDE_ORACLE_DESCRIPTION = (
    "Incluir los objetos internos de Oracle "
    "(SYS, SYSTEM, XDB...)."
)

MAX_OBJECTS_DESCRIPTION = (
    "Cantidad de objetos de mayor tamaño a devolver."
)

DAYS_DESCRIPTION = (
    "Antigüedad máxima de las mediciones del "
    "historial, en días."
)


def _run(
    operation: Callable[[], Any],
    description: str,
) -> Any:
    """Ejecuta una operación y traduce errores.

    Raises:
        HTTPException 409:
            La operación no está disponible en el
            contenedor seleccionado.

        HTTPException 503:
            Oracle no está disponible, faltan privilegios
            o existe un problema de configuración.
    """
    try:
        return operation()

    except service.StorageHistoryUnavailableError as error:
        raise HTTPException(
            status_code=409,
            detail=str(error),
        ) from error

    except (ValueError, OSError) as error:
        logger.exception(
            "Error de configuración al consultar %s",
            description,
        )

        raise HTTPException(
            status_code=503,
            detail=(
                f"No se pudo consultar {description}: "
                f"{error} "
                "Revise el archivo .env y la instalación "
                "del proyecto."
            ),
        ) from error

    except oracledb.Error as error:
        logger.exception(
            "Error de Oracle al consultar %s",
            description,
        )

        oracle_error = (
            error.args[0]
            if error.args
            else None
        )

        code = getattr(
            oracle_error,
            "full_code",
            "desconocido",
        )

        raise HTTPException(
            status_code=503,
            detail=(
                f"No se pudo consultar {description} "
                f"en Oracle ({code}). "
                "Verifique la conexión y que se "
                "ejecutaron los scripts de "
                "sql/oracle/storage/setup/."
            ),
        ) from error


@router.get("")
def read_storage_summary(
    include_oracle: bool = Query(
        False,
        description=INCLUDE_ORACLE_DESCRIPTION,
    ),
    max_objects: int = Query(
        service.DEFAULT_LARGE_OBJECTS,
        ge=1,
        le=service.MAX_LARGE_OBJECTS,
        description=MAX_OBJECTS_DESCRIPTION,
    ),
    days: int = Query(
        service.DEFAULT_HISTORY_DAYS,
        ge=1,
        le=service.MAX_HISTORY_DAYS,
        description=DAYS_DESCRIPTION,
    ),
):
    """Resumen completo de almacenamiento."""
    return _run(
        lambda: service.get_storage_summary(
            include_oracle,
            max_objects,
            days,
        ),
        "el almacenamiento",
    )


@router.get("/tablespaces")
def read_tablespaces():
    """Uso de cada tablespace."""
    return _run(
        service.get_tablespaces,
        "los tablespaces",
    )


@router.get("/database-size")
def read_database_size():
    """Tamaño de la base de datos."""
    return _run(
        service.get_database_size,
        "el tamaño de la base de datos",
    )


@router.get("/datafiles")
def read_datafiles():
    """Archivos de datos y temporales."""
    return _run(
        service.get_datafiles,
        "los archivos de datos",
    )


@router.get("/large-objects")
def read_large_objects(
    include_oracle: bool = Query(
        False,
        description=INCLUDE_ORACLE_DESCRIPTION,
    ),
    max_rows: int = Query(
        service.DEFAULT_LARGE_OBJECTS,
        ge=1,
        le=service.MAX_LARGE_OBJECTS,
        description=MAX_OBJECTS_DESCRIPTION,
    ),
):
    """Objetos que más almacenamiento consumen."""
    return _run(
        lambda: service.get_large_objects(
            include_oracle,
            max_rows,
        ),
        "los objetos de mayor tamaño",
    )


@router.get("/growth")
def read_storage_growth(
    days: int = Query(
        service.DEFAULT_HISTORY_DAYS,
        ge=1,
        le=service.MAX_HISTORY_DAYS,
        description=DAYS_DESCRIPTION,
    ),
):
    """Mediciones históricas y crecimiento."""
    return _run(
        lambda: service.get_storage_growth(days),
        "el historial de almacenamiento",
    )


@router.post("/snapshot")
def create_storage_snapshot():
    """Registra una medición del almacenamiento.

    La operación solo está disponible en XEPDB1,
    donde reside DBA_MONITOR_HIST.
    """
    return _run(
        service.create_storage_snapshot,
        "el registro de la medición",
    )