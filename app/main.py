from fastapi import FastAPI

app = FastAPI(
    title="DBA Monitor",
    description="Herramienta de monitoreo y administración de Oracle Database",
    version="0.1.0"
)


@app.get("/")
def root():
    return {"message": "DBA Monitor funcionando"}