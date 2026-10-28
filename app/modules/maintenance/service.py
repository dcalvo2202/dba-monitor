"""
Módulo 6 - Mantenimiento Preventivo
Capa de servicios.

Gestiona las consultas y operaciones de mantenimiento.
"""

from app.modules.maintenance import repository


def get_invalid_objects():
    """
    Obtiene los objetos inválidos visibles para el usuario Oracle.
    """
    objects = repository.get_invalid_objects()

    return {
        "total": len(objects),
        "objects": objects
    }


def get_table_statistics():
    """
    Obtiene las estadísticas de las tablas.
    """
    statistics = repository.get_table_statistics()

    return {
        "total": len(statistics),
        "tables": statistics
    }


def update_statistics(owner: str, table_name: str):
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
