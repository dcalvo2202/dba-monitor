import oracledb

from app.core.config import settings


def build_dsn() -> str:
    return oracledb.makedsn(
        settings.db_host,
        settings.db_port,
        service_name=settings.db_service,
    )


def get_connection():
    if not settings.db_user:
        raise ValueError("DB_USER no está configurado.")

    if not settings.db_password:
        raise ValueError("DB_PASSWORD no está configurado.")

    if not settings.db_service:
        raise ValueError("DB_SERVICE no está configurado.")

    return oracledb.connect(
        user=settings.db_user,
        password=settings.db_password,
        dsn=build_dsn(),
    )