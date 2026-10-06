"""Endpoints HTTP del Módulo 5 - Auditoría.

Expone la información de auditoría bajo el prefijo /api/audit. Esta capa
solo valida los parámetros de entrada, delega en `service.py` y traduce los
errores a respuestas HTTP con mensajes comprensibles para el usuario.

Endpoints:
    GET /api/audit/users                          Usuarios registrados.
    GET /api/audit/users/{username}/privileges    Roles y privilegios de un usuario.
    GET /api/audit/roles                          Roles disponibles.
    GET /api/audit/invalid-objects                Objetos inválidos y errores.
"""

import logging
from collections.abc import Callable
from typing import Any, Literal

import oracledb
from fastapi import APIRouter, HTTPException, Query

from app.modules.audit import service


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/audit",
    tags=["Auditoría"],
)


def _run(operation: Callable[[], Any], description: str) -> Any:
    """Ejecuta una operación del servicio y convierte los errores de Oracle.

    Args:
        operation: Función sin argumentos que realiza la consulta.
        description: Qué se intentaba consultar; se incluye en el mensaje.

    Raises:
        HTTPException 503: Oracle no está disponible o rechazó la consulta
            (por ejemplo, falta un privilegio: ORA-00942).
    """
    try:
        return operation()

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
                "Verifique la conexión y los privilegios de DBA_MONITOR."
            ),
        ) from error


@router.get("/users")
def read_users(
    include_oracle: bool = Query(
        False,
        description="Incluir las cuentas internas de Oracle (SYS, SYSTEM...).",
    ),
):
    """Usuarios registrados con su estado y hallazgos de seguridad."""
    return _run(
        lambda: service.get_users_report(include_oracle),
        "los usuarios",
    )


@router.get("/users/{username}/privileges")
def read_user_privileges(
    username: str,
    privilege_type: Literal["SISTEMA", "OBJETO"] | None = Query(
        None,
        description="Filtrar por tipo de privilegio; vacío = ambos.",
    ),
    max_rows: int = Query(
        service.DEFAULT_PRIVILEGE_LIMIT,
        ge=1,
        le=2000,
        description="Máximo de privilegios a devolver.",
    ),
):
    """Roles y privilegios efectivos (directos y heredados) de un usuario."""
    try:
        return _run(
            lambda: service.get_user_privileges_report(
                username,
                privilege_type,
                max_rows,
            ),
            "los privilegios del usuario",
        )

    except service.UserNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=f"El usuario {error} no existe en la base de datos.",
        ) from error


@router.get("/roles")
def read_roles(
    include_oracle: bool = Query(
        False,
        description="Incluir los roles predefinidos de Oracle (DBA, CONNECT...).",
    ),
):
    """Roles disponibles con su resumen de asignaciones."""
    return _run(
        lambda: service.get_roles_report(include_oracle),
        "los roles",
    )


@router.get("/invalid-objects")
def read_invalid_objects():
    """Objetos inválidos con sus errores de compilación y diagnóstico."""
    return _run(
        service.get_invalid_objects_report,
        "los objetos inválidos",
    )
