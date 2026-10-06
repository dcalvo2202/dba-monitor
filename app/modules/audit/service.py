"""Lógica de negocio del Módulo 5 - Auditoría.

Toma las filas que entrega `repository.py` y las convierte en información
útil para el administrador:

- Resume la cantidad de usuarios, roles y objetos inválidos.
- Detecta situaciones de riesgo de seguridad en cada cuenta (rol DBA,
  privilegios "ANY", cuentas expiradas o bloqueadas...).
- Agrupa los errores de compilación bajo el objeto al que pertenecen y
  explica por qué está inválido.

Las cuentas mantenidas por Oracle (SYS, SYSTEM, etc.) tienen por diseño
privilegios administrativos amplios; por eso las reglas de riesgo de
privilegios solo se aplican a las cuentas creadas por el administrador.
"""

from collections import defaultdict
from typing import Any

from app.modules.audit import repository


# Niveles de riesgo usados en la interfaz, de mayor a menor gravedad.
RISK_HIGH = "ALTO"
RISK_MEDIUM = "MEDIO"
RISK_INFO = "INFO"

# Límite por defecto de privilegios devueltos por consulta (ver
# get_user_privileges.sql: SYS supera los 90 000 privilegios de objeto).
DEFAULT_PRIVILEGE_LIMIT = 200


class UserNotFoundError(Exception):
    """El usuario solicitado no existe en la base de datos."""


def _risk(level: str, message: str) -> dict[str, str]:
    """Crea un hallazgo de riesgo con su nivel y una explicación legible."""
    return {"level": level, "message": message}


def _assess_user(user: dict[str, Any]) -> list[dict[str, str]]:
    """Evalúa una cuenta y devuelve la lista de hallazgos de seguridad.

    Args:
        user: Fila de get_users.sql.

    Returns:
        Lista de hallazgos ordenada de mayor a menor gravedad; vacía si la
        cuenta no presenta observaciones.
    """
    risks = []
    status = user["account_status"] or ""
    is_custom_account = user["oracle_maintained"] == "N"

    if is_custom_account and user["has_dba_role"] == "Y":
        risks.append(_risk(
            RISK_HIGH,
            "Tiene el rol DBA: control total de la base de datos.",
        ))

    if is_custom_account and user["any_privilege_count"]:
        risks.append(_risk(
            RISK_MEDIUM,
            f"Tiene {user['any_privilege_count']} privilegio(s) ANY, que "
            "actúan sobre objetos de cualquier esquema.",
        ))

    # ACCOUNT_STATUS puede combinar estados, ej. "EXPIRED & LOCKED".
    if "EXPIRED" in status:
        risks.append(_risk(
            RISK_MEDIUM,
            "La contraseña expiró; el usuario debe cambiarla para ingresar.",
        ))

    if "LOCKED" in status:
        risks.append(_risk(RISK_INFO, "La cuenta está bloqueada."))

    if user["authentication_type"] == "NONE":
        risks.append(_risk(
            RISK_INFO,
            "Cuenta sin contraseña (schema-only): no permite iniciar sesión.",
        ))

    return risks


def get_users_report(include_oracle: bool) -> dict[str, Any]:
    """Listado de usuarios con hallazgos de riesgo y resumen de estados.

    Args:
        include_oracle: Si True incluye las cuentas internas de Oracle.

    Returns:
        {"summary": {...conteos...}, "users": [...usuarios con "risks"...]}
    """
    users = repository.get_users(include_oracle)

    for user in users:
        user["risks"] = _assess_user(user)

    def count(condition) -> int:
        return sum(1 for user in users if condition(user))

    summary = {
        "total": len(users),
        "open": count(lambda u: u["account_status"] == "OPEN"),
        "locked": count(lambda u: "LOCKED" in (u["account_status"] or "")),
        "expired": count(lambda u: "EXPIRED" in (u["account_status"] or "")),
        "with_dba_role": count(lambda u: u["has_dba_role"] == "Y"),
        "with_any_privileges": count(lambda u: u["any_privilege_count"] > 0),
        "with_high_risk": count(
            lambda u: any(r["level"] == RISK_HIGH for r in u["risks"])
        ),
    }

    return {"summary": summary, "users": users}


def get_user_privileges_report(
    username: str,
    privilege_type: str | None = None,
    max_rows: int = DEFAULT_PRIVILEGE_LIMIT,
) -> dict[str, Any]:
    """Detalle de seguridad de un usuario: datos, roles y privilegios.

    Args:
        username: Nombre del usuario (se normaliza a mayúsculas, como lo
            almacena Oracle cuando se crea sin comillas).
        privilege_type: 'SISTEMA', 'OBJETO' o None para ambos.
        max_rows: Máximo de privilegios devueltos.

    Raises:
        UserNotFoundError: Si el usuario no existe.
    """
    normalized_username = username.strip().upper()

    user = repository.get_user(normalized_username)

    if user is None:
        raise UserNotFoundError(normalized_username)

    roles = repository.get_user_roles(normalized_username)
    privileges = repository.get_user_privileges(
        normalized_username,
        privilege_type,
        max_rows,
    )

    # total_rows se repite en cada fila (función analítica); se extrae una
    # sola vez y se elimina de cada privilegio para no duplicarlo.
    total_privileges = privileges[0]["total_rows"] if privileges else 0

    for privilege in privileges:
        privilege.pop("total_rows", None)
        privilege["is_inherited"] = privilege["origin"] != "DIRECTO"

    return {
        "user": user,
        "roles": roles,
        "privileges": privileges,
        "privilege_filter": privilege_type,
        "total_privileges": total_privileges,
        "returned_privileges": len(privileges),
        "is_truncated": total_privileges > len(privileges),
        "summary": {
            "direct_roles": sum(1 for r in roles if r["grant_level"] == 1),
            "inherited_roles": sum(1 for r in roles if r["grant_level"] > 1),
            "direct_privileges": sum(
                1 for p in privileges if not p["is_inherited"]
            ),
            "inherited_privileges": sum(
                1 for p in privileges if p["is_inherited"]
            ),
            "with_admin_option": sum(
                1 for p in privileges if p["admin_option"] == "YES"
            ),
        },
    }


def get_roles_report(include_oracle: bool) -> dict[str, Any]:
    """Listado de roles con el total de roles y de roles sin asignar.

    Un rol propio sin usuarios ni roles beneficiarios suele ser un rol
    olvidado; conviene revisarlo o eliminarlo.
    """
    roles = repository.get_roles(include_oracle)

    for role in roles:
        role["is_unused"] = (
            role["user_grantees"] == 0 and role["role_grantees"] == 0
        )

    return {
        "summary": {
            "total": len(roles),
            "custom": sum(1 for r in roles if r["oracle_maintained"] == "N"),
            "unused": sum(1 for r in roles if r["is_unused"]),
        },
        "roles": roles,
    }


def get_invalid_objects_report() -> dict[str, Any]:
    """Objetos inválidos con sus errores de compilación y un diagnóstico.

    Returns:
        {"summary": {...}, "objects": [...]} donde cada objeto incluye la
        lista "errors" y un "diagnosis" que explica la causa probable.
    """
    objects = repository.get_invalid_objects()
    errors = repository.get_compilation_errors()

    # Agrupa los errores por objeto (owner, nombre, tipo) en una sola
    # pasada, para asociarlos sin consultar Oracle una vez por objeto.
    errors_by_object = defaultdict(list)

    for error in errors:
        key = (error["owner"], error["name"], error["type"])
        errors_by_object[key].append({
            "line": error["line"],
            "position": error["position"],
            "text": error["text"],
            "attribute": error["attribute"],
        })

    for obj in objects:
        key = (obj["owner"], obj["object_name"], obj["object_type"])
        obj["errors"] = errors_by_object.get(key, [])

        if obj["error_count"] > 0:
            obj["diagnosis"] = (
                "Error de compilación: el código fuente o una dependencia "
                "produce errores al compilar."
            )
        else:
            # Oracle solo registra errores en DBA_ERRORS al intentar
            # compilar; sin errores, la causa típica es una dependencia
            # modificada o eliminada.
            obj["diagnosis"] = (
                "Inválido por dependencia: un objeto del que depende cambió "
                "o fue eliminado y aún no se ha recompilado."
            )

    return {
        "summary": {
            "total": len(objects),
            "with_errors": sum(1 for o in objects if o["error_count"] > 0),
            "without_errors": sum(1 for o in objects if o["error_count"] == 0),
            "oracle_maintained": sum(
                1 for o in objects if o["oracle_maintained"] == "Y"
            ),
        },
        "objects": objects,
    }
