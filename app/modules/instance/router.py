from fastapi import APIRouter, HTTPException

from app.modules.instance.service import get_instance_status


router = APIRouter(
    prefix="/api/instance",
    tags=["Instancia"],
)


@router.get("")
def read_instance_status():
    instance_status = get_instance_status()

    if instance_status is None:
        raise HTTPException(
            status_code=404,
            detail="No se pudo obtener información de la instancia.",
        )

    return instance_status