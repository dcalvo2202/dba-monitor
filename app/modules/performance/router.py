from fastapi import APIRouter

from app.modules.performance.service import get_active_sessions_data


router = APIRouter(
    prefix="/api/performance",
    tags=["Rendimiento"],
)


@router.get("/sessions")
def read_active_sessions():
    return get_active_sessions_data()