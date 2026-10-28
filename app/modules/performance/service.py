"""Transformaciones y presentación de datos de rendimiento."""

from typing import Any

from app.modules.performance import repository


def get_active_sessions_data() -> list[dict[str, Any]]:
    return repository.get_active_sessions()


def get_blocked_sessions_data() -> list[dict[str, Any]]:
    return repository.get_blocked_sessions()


def get_top_sql_data() -> list[dict[str, Any]]:
    return repository.get_top_sql()


def get_query_times_data() -> list[dict[str, Any]]:
    return repository.get_query_times()


def get_resource_usage_data() -> list[dict[str, Any]]:
    return repository.get_resource_usage()
