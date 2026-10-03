from fastapi import FastAPI

from app.modules.instance.router import router as instance_router
from app.modules.performance.router import router as performance_router


app = FastAPI(
    title="DBA Monitor",
    description="Herramienta de monitoreo y administraciÃ³n de Oracle Database",
    version="0.1.0",
)

app.include_router(instance_router)
app.include_router(performance_router)


@app.get("/")
def root():
    return {"message": "DBA Monitor funcionando"}