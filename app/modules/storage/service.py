from app.modules.storage import repository


def get_storage_summary() -> dict:

    database_size = repository.get_database_size()
    tablespaces = repository.get_tablespace_usage()
    datafiles = repository.get_datafiles()
    large_objects = repository.get_large_objects()

    return {
        "database_size": database_size,
        "tablespaces": tablespaces,
        "datafiles": datafiles,
        "large_objects": large_objects,
    }


def get_tablespaces() -> list[dict]:

    return repository.get_tablespace_usage()


def get_database_size() -> dict:

    return repository.get_database_size()


def get_datafiles() -> list[dict]:
    """
    Obtiene los archivos de datos de Oracle.
    """
    return repository.get_datafiles()


def get_large_objects() -> list[dict]:
    """
    Obtiene los objetos que consumen más almacenamiento.
    """
    return repository.get_large_objects()


def get_storage_history() -> list[dict]:
    """
    Obtiene el historial de mediciones del almacenamiento.
    """
    return repository.get_storage_history()


def create_storage_snapshot() -> dict:
    """
    Registra una nueva medición del almacenamiento.
    """
    rows_inserted = repository.insert_storage_snapshot()

    return {
        "message": "Medición de almacenamiento registrada correctamente",
        "rows_inserted": rows_inserted,
    }
