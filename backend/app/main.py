from fastapi import FastAPI
from sqlmodel import SQLModel
from app.database import engine

app = FastAPI(title="BioConect API")

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)

@app.get("/health")
def health():
    return {"status": "ok"}
