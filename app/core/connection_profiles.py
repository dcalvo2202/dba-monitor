"""Perfiles de conexión a Oracle.

Permite monitorear distintas instancias o contenedores (por ejemplo, la PDB
XEPDB1 y la raíz CDB$ROOT) y cambiar entre ellos desde la interfaz, sin
modificar el código fuente.

Origen de los perfiles:
    1. Si existe `config/connections.json` (archivo local, NO se sube a Git),
       se leen los perfiles definidos ahí. La plantilla está en
       `config/connections.example.json`.
    2. Si no existe, se crea un único perfil con las variables DB_* del
       archivo .env. Así la aplicación funciona igual que antes para quien
       no configure perfiles.

Seguridad: las contraseñas NUNCA se escriben en el JSON. Cada perfil indica
el nombre de la variable de entorno (.env) que contiene su contraseña.

El perfil activo se guarda en memoria del proceso: es una herramienta local
de un solo administrador, por lo que no se necesita persistirlo por usuario.
Al reiniciar el servidor vuelve a ser el primer perfil de la lista.
"""

import json
import os
import threading
from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings


# <raíz del proyecto>/config/connections.json
PROFILES_FILE = Path(__file__).resolve().parents[2] / "config" / "connections.json"

# Campos obligatorios de cada perfil en el JSON.
REQUIRED_FIELDS = ("name", "label", "host", "port", "service", "user", "password_env")


class ProfileNotFoundError(Exception):
    """El perfil solicitado no está definido."""


class ProfileConfigError(ValueError):
    """El archivo de perfiles tiene un formato inválido."""


@dataclass(frozen=True)
class ConnectionProfile:
    """Datos para conectarse a una instancia o contenedor de Oracle.

    Attributes:
        name: Identificador único (ej. "xepdb1"); se usa en la API.
        label: Nombre visible en la interfaz (ej. "XEPDB1 - aplicación").
        host, port, service: Dirección del listener y servicio de Oracle.
        user: Usuario de base de datos con el que se conecta la aplicación.
        password_env: Nombre de la variable de entorno con la contraseña.
    """

    name: str
    label: str
    host: str
    port: int
    service: str
    user: str
    password_env: str

    @property
    def password(self) -> str:
        """Contraseña leída del entorno en el momento de usarla ("" si falta)."""
        return os.getenv(self.password_env, "")

    def to_public_dict(self) -> dict:
        """Datos del perfil que pueden enviarse al navegador (sin contraseña)."""
        return {
            "name": self.name,
            "label": self.label,
            "host": self.host,
            "port": self.port,
            "service": self.service,
            "user": self.user,
            # Solo se informa si la contraseña está configurada, no su valor.
            "has_password": bool(self.password),
        }


def _profile_from_env() -> ConnectionProfile:
    """Perfil único construido con las variables DB_* del archivo .env."""
    return ConnectionProfile(
        name="default",
        label=f"{settings.db_service or 'Sin servicio'} ({settings.db_user or 'sin usuario'})",
        host=settings.db_host,
        port=settings.db_port,
        service=settings.db_service,
        user=settings.db_user,
        password_env="DB_PASSWORD",
    )


def _load_profiles_file(path: Path) -> list[ConnectionProfile]:
    """Lee y valida config/connections.json.

    Raises:
        ProfileConfigError: Si el JSON es inválido, está vacío, falta algún
            campo o hay nombres repetidos. Se prefiere fallar con un mensaje
            claro a conectarse con datos incompletos.
    """
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ProfileConfigError(
            f"{path.name} no es un JSON válido (línea {error.lineno}): {error.msg}"
        ) from error

    entries = data.get("profiles") if isinstance(data, dict) else None

    if not isinstance(entries, list) or not entries:
        raise ProfileConfigError(
            f'{path.name} debe contener una lista "profiles" con al menos un perfil.'
        )

    profiles = []
    seen_names = set()

    for index, entry in enumerate(entries, start=1):
        missing = [field for field in REQUIRED_FIELDS if not entry.get(field)]

        if missing:
            raise ProfileConfigError(
                f"El perfil {index} de {path.name} no tiene: {', '.join(missing)}."
            )

        if entry["name"] in seen_names:
            raise ProfileConfigError(
                f'El nombre de perfil "{entry["name"]}" está repetido en {path.name}.'
            )

        seen_names.add(entry["name"])

        profiles.append(ConnectionProfile(
            name=str(entry["name"]),
            label=str(entry["label"]),
            host=str(entry["host"]),
            port=int(entry["port"]),
            service=str(entry["service"]),
            user=str(entry["user"]),
            password_env=str(entry["password_env"]),
        ))

    return profiles


def _load_profiles() -> list[ConnectionProfile]:
    """Perfiles desde el JSON si existe; si no, el perfil único del .env."""
    if PROFILES_FILE.exists():
        return _load_profiles_file(PROFILES_FILE)

    return [_profile_from_env()]


# Se cargan una sola vez al iniciar la aplicación: un error de formato en el
# JSON se detecta al arrancar el servidor y no en medio de una consulta.
_profiles: list[ConnectionProfile] = _load_profiles()
_active_name: str = _profiles[0].name

# Las peticiones HTTP se atienden en varios hilos; el candado evita que dos
# cambios de perfil simultáneos dejen un estado inconsistente.
_lock = threading.Lock()


def get_profiles() -> list[ConnectionProfile]:
    """Todos los perfiles disponibles, en el orden del archivo."""
    return list(_profiles)


def get_profile(name: str) -> ConnectionProfile:
    """Perfil por nombre.

    Raises:
        ProfileNotFoundError: Si no existe un perfil con ese nombre.
    """
    for profile in _profiles:
        if profile.name == name:
            return profile

    raise ProfileNotFoundError(name)


def get_active_profile() -> ConnectionProfile:
    """Perfil con el que se abren actualmente las conexiones."""
    with _lock:
        return get_profile(_active_name)


def set_active_profile(name: str) -> ConnectionProfile:
    """Cambia el perfil activo.

    Raises:
        ProfileNotFoundError: Si no existe un perfil con ese nombre.
    """
    global _active_name

    profile = get_profile(name)

    with _lock:
        _active_name = profile.name

    return profile


def uses_profiles_file() -> bool:
    """True si los perfiles provienen de config/connections.json."""
    return PROFILES_FILE.exists()
