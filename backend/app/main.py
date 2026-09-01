import shutil
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from sqlmodel import SQLModel
from app.database import engine

app = FastAPI(title="BioConect API")

UPLOAD_DIR = Path("uploads/estudios")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/estudios")
async def cargar_estudio(archivo: UploadFile = File(...)):
    if archivo.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    destino = UPLOAD_DIR / archivo.filename
    with destino.open("wb") as buffer:
        shutil.copyfileobj(archivo.file, buffer)

    return {"filename": archivo.filename, "status": "cargado"}