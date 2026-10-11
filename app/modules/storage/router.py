from fastapi import APIRouter, HTTPException

from app.modules.storage import service


router = APIRouter(
    prefix="/api/storage",
    tags=["Storage"]
)


@router.get("")
def get_storage():
    """
    Obtiene el resumen general del almacenamiento.

    Incluye:
    - Tamaño de la base de datos
    - Uso de tablespaces
    - Datafiles
    - Objetos más grandes
    """
    try:
        return service.get_storage_summary()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar el almacenamiento: {error}"
        )


@router.get("/tablespaces")
def get_tablespaces():
    """
    Obtiene el uso de los tablespaces.
    """
    try:
        return service.get_tablespaces()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar los tablespaces: {error}"
        )


@router.get("/database-size")
def get_database_size():
    """
    Obtiene el tamaño actual de la base de datos.
    """
    try:
        return service.get_database_size()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar el tamaño de la base de datos: {error}"
        )


@router.get("/datafiles")
def get_datafiles():
    """
    Obtiene información de los datafiles.
    """
    try:
        return service.get_datafiles()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar los datafiles: {error}"
        )


@router.get("/large-objects")
def get_large_objects():
    """
    Obtiene los objetos que consumen más almacenamiento.
    """
    try:
        return service.get_large_objects()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar los objetos más grandes: {error}"
        )


@router.get("/growth")
def get_storage_growth():
    """
    Obtiene el historial de crecimiento del almacenamiento.
    """
    try:
        return service.get_storage_history()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al consultar el historial de almacenamiento: {error}"
        )


@router.post("/snapshot")
def create_storage_snapshot():
    """
    Registra una nueva medición del almacenamiento.
    """
    try:
        return service.create_storage_snapshot()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al registrar la medición de almacenamiento: {error}"
        )