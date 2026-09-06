from fastapi import FastAPI

from app.modules.instance.router import router as instance_router


app = FastAPI(
    title="DBA Monitor",
    description="Herramienta de monitoreo y administración de Oracle Database",
    version="0.1.0",
)

app.include_router(instance_router)


@app.get("/")
def root():
    return {"message": "DBA Monitor funcionando"}