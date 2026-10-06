"""Creación de conexiones a Oracle Database.

Todos los módulos obtienen sus conexiones con get_connection(). La conexión
se abre con el perfil activo (ver app/core/connection_profiles.py), por lo
que cambiar de instancia o contenedor desde la interfaz no requiere tocar el
código de ningún módulo.
"""

import oracledb

from app.core.connection_profiles import ConnectionProfile, get_active_profile


# Tiempo máximo (segundos) para establecer la conexión TCP con el listener.
# Evita que la aplicación quede esperando si el host del perfil no responde.
CONNECT_TIMEOUT_SECONDS = 10


def build_dsn(profile: ConnectionProfile) -> str:
    """Cadena de conexión (DSN) host:puerto/servicio del perfil."""
    return oracledb.makedsn(
        profile.host,
        profile.port,
        service_name=profile.service,
    )


def get_connection(profile: ConnectionProfile | None = None):
    """Abre una conexión nueva a Oracle.

    Args:
        profile: Perfil a usar; si se omite, el perfil activo.

    Raises:
        ValueError: Si al perfil le falta usuario, servicio o contraseña
            (por ejemplo, la variable de entorno de la contraseña no existe).
        oracledb.Error: Si Oracle rechaza la conexión.
    """
    profile = profile or get_active_profile()

    if not profile.user:
        raise ValueError(f'El perfil "{profile.label}" no tiene usuario configurado.')

    if not profile.password:
        raise ValueError(
            f"{profile.password_env} no está configurado en el archivo .env "
            f'(contraseña del perfil "{profile.label}").'
        )

    if not profile.service:
        raise ValueError(f'El perfil "{profile.label}" no tiene servicio configurado.')

    return oracledb.connect(
        user=profile.user,
        password=profile.password,
        dsn=build_dsn(profile),
        tcp_connect_timeout=CONNECT_TIMEOUT_SECONDS,
    )


def test_connection(profile: ConnectionProfile) -> dict:
    """Comprueba que el perfil puede conectarse e identifica el contenedor.

    Usa SYS_CONTEXT('USERENV', ...), que no requiere ningún privilegio
    adicional: sirve para validar un perfil antes de activarlo.

    Returns:
        {"database_name", "container_name", "session_user"}

    Raises:
        ValueError, oracledb.Error: Igual que get_connection().
    """
    connection = get_connection(profile)

    try:
        cursor = connection.cursor()

        try:
            cursor.execute(
                """
                SELECT SYS_CONTEXT('USERENV', 'DB_NAME'),
                       SYS_CONTEXT('USERENV', 'CON_NAME'),
                       SYS_CONTEXT('USERENV', 'SESSION_USER')
                FROM   dual
                """
            )
            database_name, container_name, session_user = cursor.fetchone()

        finally:
            cursor.close()

    finally:
        connection.close()

    return {
        "database_name": database_name,
        "container_name": container_name,
        "session_user": session_user,
    }
