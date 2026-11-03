"""
Módulo 6 - Mantenimiento Preventivo
Capa de servicios.

Gestiona las consultas y operaciones de mantenimiento.
"""

from app.modules.maintenance import repository
SUPPORTED_CONTAINER = "XEPDB1"


class MaintenanceUnavailableError(Exception):
    """El mantenimiento no está disponible en el contenedor actual."""

def _ensure_supported_container():
    container = repository.get_container_name()

    if container != SUPPORTED_CONTAINER:
        raise MaintenanceUnavailableError(
            "El mantenimiento preventivo está disponible únicamente "
            "en XEPDB1. Seleccione el perfil XEPDB1 para consultar "
            "estadísticas o ejecutar operaciones de mantenimiento."
        )
    
def get_invalid_objects():
    _ensure_supported_container()

    """
    Obtiene los objetos inválidos visibles para el usuario Oracle.
    """
    objects = repository.get_invalid_objects()

    return {
        "total": len(objects),
        "objects": objects
    }


def get_table_statistics():
    _ensure_supported_container()

    """
    Obtiene las estadísticas de las tablas.
    """
    statistics = repository.get_table_statistics()

    return {
        "total": len(statistics),
        "tables": statistics
    }


def update_statistics(owner: str, table_name: str):
    _ensure_supported_container()

    """
    Solicita la actualización de estadísticas de una tabla.
    """

    if not owner or not owner.strip():
        raise ValueError("Debe indicar el propietario de la tabla.")

    if not table_name or not table_name.strip():
        raise ValueError("Debe indicar el nombre de la tabla.")

    return repository.update_table_statistics(
        owner=owner.strip(),
        table_name=table_name.strip()
    )


def recompile_object(
    owner: str,
    object_name: str,
    object_type: str
):
    _ensure_supported_container()
    """
    Solicita la recompilación de un objeto Oracle.
    """

    if not owner or not owner.strip():
        raise ValueError("Debe indicar el propietario del objeto.")

    if not object_name or not object_name.strip():
        raise ValueError("Debe indicar el nombre del objeto.")

    if not object_type or not object_type.strip():
        raise ValueError("Debe indicar el tipo de objeto.")

    return repository.recompile_object(
        owner=owner.strip(),
        object_name=object_name.strip(),
        object_type=object_type.strip()
    )
