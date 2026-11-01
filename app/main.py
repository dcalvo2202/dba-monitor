from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

from app.modules.audit.router import router as audit_router
from app.modules.backup.router import router as backup_router
from app.modules.connections.router import router as connections_router
from app.modules.instance.router import router as instance_router
from app.modules.maintenance.router import router as maintenance_router
from app.modules.performance.router import router as performance_router
from app.modules.storage.router import router as storage_router


BASE_DIR = Path(__file__).resolve().parent

templates = Jinja2Templates(
    directory=str(BASE_DIR / "templates")
)


app = FastAPI(
    title="DBA Monitor",
    description="Herramienta de monitoreo y administración de Oracle Database",
    version="0.1.0",
)

app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static",
)


@app.middleware("http")
async def revalidate_static_files(request: Request, call_next):
    """Obliga al navegador a revalidar CSS y JavaScript en cada carga.

    Sin esta cabecera el navegador puede seguir usando una copia vieja de un
    archivo después de un `git pull`. Con "no-cache" pregunta al servidor si
    cambió: si no cambió responde 304 (sin volver a descargarlo), y si cambió
    entrega la versión nueva.
    """
    response = await call_next(request)

    if request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache"

    return response


app.include_router(connections_router)
app.include_router(instance_router)
app.include_router(performance_router)
app.include_router(storage_router)
app.include_router(backup_router)
app.include_router(audit_router)
app.include_router(maintenance_router)


@app.get("/")
def root(request: Request):
    """Página del Módulo 1 (Estado general de la instancia)."""
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"active_module": "instance"},
    )


@app.get("/rendimiento")
def performance_page(request: Request):
    """Página del Módulo 2 (Rendimiento de Oracle)."""
    return templates.TemplateResponse(
        request=request,
        name="performance.html",
        context={"active_module": "performance"},
    )


@app.get("/almacenamiento")
def storage_page(request: Request):
    """Página del Módulo 3 (Gestión del almacenamiento)."""
    return templates.TemplateResponse(
        request=request,
        name="storage.html",
        context={"active_module": "storage"},
    )


@app.get("/respaldos")
def backup_page(request: Request):
    """Página del Módulo 4 (Respaldo y recuperación)."""
    return templates.TemplateResponse(
        request=request,
        name="backup.html",
        context={"active_module": "backup"},
    )


@app.get("/auditoria")
def audit_page(request: Request):
    """Página del Módulo 5 (Auditoría)."""
    return templates.TemplateResponse(
        request=request,
        name="audit.html",
        context={"active_module": "audit"},
    )


@app.get("/mantenimiento")
def maintenance_page(request: Request):
    """Página del Módulo 6 (Mantenimiento preventivo)."""
    return templates.TemplateResponse(
        request=request,
        name="maintenance.html",
        context={"active_module": "maintenance"},
    )