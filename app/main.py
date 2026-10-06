from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

from app.modules.audit.router import router as audit_router
from app.modules.instance.router import router as instance_router


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

app.include_router(instance_router)
app.include_router(audit_router)


@app.get("/")
def root(request: Request):
    """Página del Módulo 1 (Estado general de la instancia).

    `active_module` le indica a base.html qué enlace del menú lateral
    debe marcarse como activo.
    """
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"active_module": "instance"},
    )


@app.get("/auditoria")
def audit_page(request: Request):
    """Página del Módulo 5 (Auditoría).

    La plantilla solo contiene la estructura; los datos se cargan desde
    /api/audit/* mediante static/js/audit.js.
    """
    return templates.TemplateResponse(
        request=request,
        name="audit.html",
        context={"active_module": "audit"},
    )