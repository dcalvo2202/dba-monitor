"""Endpoints HTTP de los perfiles de conexión.

Endpoints:
    GET /api/connections          Perfiles disponibles y perfil activo.
    PUT /api/connections/active   Cambia el perfil activo, validándolo antes.

Nunca se envían contraseñas al navegador: solo se indica si cada perfil
tiene su contraseña configurada en el archivo .env.
"""

import logging

import oracledb
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core import connection_profiles
from app.database.connection import test_connection


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/connections",
    tags=["Conexiones"],
)


class ActiveProfileRequest(BaseModel):
    """Cuerpo de PUT /api/connections/active."""

    name: str = Field(..., min_length=1, description="Nombre del perfil a activar.")


@router.get("")
def read_connections():
    """Perfiles configurados (sin contraseñas) y cuál está activo."""
    active = connection_profiles.get_active_profile()

    return {
        "active": active.name,
        "source": (
            "config/connections.json"
            if connection_profiles.uses_profiles_file()
            else ".env"
        ),
        "profiles": [
            profile.to_public_dict()
            for profile in connection_profiles.get_profiles()
        ],
    }


@router.put("/active")
def change_active_connection(request: ActiveProfileRequest):
    """Activa otro perfil, solo si se puede conectar con él.

    Primero se prueba la conexión; si falla, se mantiene el perfil anterior
    para que la aplicación siga funcionando.

    Raises:
        HTTPException 404: El perfil no existe.
        HTTPException 503: No fue posible conectarse con el perfil.
    """
    try:
        profile = connection_profiles.get_profile(request.name)

    except connection_profiles.ProfileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=f'El perfil "{request.name}" no existe.',
        ) from error

    try:
        connection_info = test_connection(profile)

    except ValueError as error:
        # Falta configuración: usuario, servicio o contraseña en .env.
        raise HTTPException(
            status_code=503,
            detail=f"No se puede usar el perfil: {error}",
        ) from error

    except oracledb.Error as error:
        logger.exception("No se pudo conectar con el perfil %s", profile.name)

        oracle_error = error.args[0] if error.args else None
        code = getattr(oracle_error, "full_code", "desconocido")

        raise HTTPException(
            status_code=503,
            detail=(
                f'No se pudo conectar con el perfil "{profile.label}" ({code}). '
                "Se mantiene la conexión anterior."
            ),
        ) from error

    connection_profiles.set_active_profile(profile.name)

    return {
        "active": profile.name,
        "profile": profile.to_public_dict(),
        "connection": connection_info,
    }
