"""
Módulo 6 - Mantenimiento Preventivo
Router de FastAPI.

Endpoints:
- Consultar objetos inválidos.
- Consultar estadísticas.
- Actualizar estadísticas.
- Recompilar objetos.
"""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.modules.maintenance import service


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/maintenance",
    tags=["Mantenimiento Preventivo"]
)


# ==========================================
# MODELOS DE ENTRADA
# ==========================================

class UpdateStatisticsRequest(BaseModel):
    """
    Datos necesarios para actualizar
    las estadísticas de una tabla.
    """

    owner: str = Field(
        ...,
        min_length=1,
        description="Propietario de la tabla"
    )

    table_name: str = Field(
        ...,
        min_length=1,
        description="Nombre de la tabla"
    )

    confirm: bool = Field(
        ...,
        description="Confirmación de la operación"
    )


class RecompileObjectRequest(BaseModel):
    """
    Datos necesarios para recompilar
    un objeto inválido.
    """

    owner: str = Field(
        ...,
        min_length=1,
        description="Propietario del objeto"
    )

    object_name: str = Field(
        ...,
        min_length=1,
        description="Nombre del objeto"
    )

    object_type: str = Field(
        ...,
        min_length=1,
        description="Tipo de objeto Oracle"
    )

    confirm: bool = Field(
        ...,
        description="Confirmación de la operación"
    )


# ==========================================
# MANEJO DE ERRORES
# ==========================================

def handle_error(exc: Exception):
    """
    Convierte errores conocidos en respuestas HTTP.
    """

    if isinstance(exc, PermissionError):
        raise HTTPException(
            status_code=403,
            detail=str(exc)
        ) from exc

    if isinstance(exc, ValueError):
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        ) from exc

    if isinstance(exc, FileNotFoundError):
        logger.exception("Archivo SQL no encontrado")

        raise HTTPException(
            status_code=500,
            detail="No se encontró una consulta SQL del módulo."
        ) from exc

    logger.exception("Error en Mantenimiento Preventivo")

    raise HTTPException(
        status_code=500,
        detail="Ocurrió un error al ejecutar la operación en Oracle."
    ) from exc


# ==========================================
# CONSULTAR OBJETOS INVÁLIDOS
# ==========================================

@router.get("/invalid-objects")
def get_invalid_objects():
    """
    Devuelve los objetos inválidos
    visibles para el usuario Oracle.
    """

    try:
        return service.get_invalid_objects()

    except Exception as exc:
        handle_error(exc)


# ==========================================
# CONSULTAR ESTADÍSTICAS
# ==========================================

@router.get("/statistics")
def get_table_statistics():
    """
    Devuelve las estadísticas
    de las tablas de Oracle.
    """

    try:
        return service.get_table_statistics()

    except Exception as exc:
        handle_error(exc)


# ==========================================
# ACTUALIZAR ESTADÍSTICAS
# ==========================================

@router.post("/update-statistics")
def update_statistics(
    request: UpdateStatisticsRequest
):
    """
    Ejecuta DBMS_STATS sobre una tabla.

    Requiere confirmación explícita.
    """

    if not request.confirm:
        raise HTTPException(
            status_code=400,
            detail="Debe confirmar la actualización de estadísticas."
        )

    try:
        return service.update_statistics(
            owner=request.owner,
            table_name=request.table_name
        )

    except Exception as exc:
        handle_error(exc)


# ==========================================
# RECOMPILAR OBJETO
# ==========================================

@router.post("/recompile")
def recompile_object(
    request: RecompileObjectRequest
):
    """
    Recompila un objeto Oracle.

    Requiere confirmación explícita.
    """

    if not request.confirm:
        raise HTTPException(
            status_code=400,
            detail="Debe confirmar la recompilación del objeto."
        )

    try:
        return service.recompile_object(
            owner=request.owner,
            object_name=request.object_name,
            object_type=request.object_type
        )

    except Exception as exc:
        handle_error(exc)