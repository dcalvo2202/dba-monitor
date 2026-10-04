from fastapi import APIRouter

from app.modules.performance.service import (
    get_active_sessions_data,
    get_blocked_sessions_data,
    get_top_sql_data,
)


router = APIRouter(
    prefix="/api/performance",
    tags=["Rendimiento"],
)


@router.get("/sessions")
def read_active_sessions():
    return get_active_sessions_data()


@router.get("/blocked-sessions")
def read_blocked_sessions():
    return get_blocked_sessions_data()


@router.get("/top-sql")
def read_top_sql():
    return get_top_sql_data()