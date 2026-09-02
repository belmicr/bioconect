import shutil
from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from sqlmodel import SQLModel, Session, select
from pydantic import BaseModel

from app.database import engine, get_session
from app.models import Usuario
from app.security import hash_password, verify_password, create_access_token

app = FastAPI(title="BioConect API")

UPLOAD_DIR = Path("uploads/estudios")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(engine)


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------- Esquemas de entrada ----------

class RegistroRequest(BaseModel):
    email: str
    password: str
    rol: str  # "bioquimico" o "paciente"
    nombre: str
    apellido: str
    dni: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    matricula: Optional[str] = None
    bioquimico_id: Optional[int] = None


class LoginRequest(BaseModel):
    email: str
    password: str


# ---------- Endpoints de autenticación ----------

@app.post("/registro")
def registro(datos: RegistroRequest, session: Session = Depends(get_session)):
    if datos.rol not in ("bioquimico", "paciente"):
        raise HTTPException(status_code=400, detail="Rol inválido")

    existente = session.exec(select(Usuario).where(Usuario.email == datos.email)).first()
    if existente:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    nuevo_usuario = Usuario(
        email=datos.email,
        password_hash=hash_password(datos.password),
        rol=datos.rol,
        nombre=datos.nombre,
        apellido=datos.apellido,
        dni=datos.dni,
        fecha_nacimiento=datos.fecha_nacimiento,
        matricula=datos.matricula,
        bioquimico_id=datos.bioquimico_id,
    )
    session.add(nuevo_usuario)
    session.commit()
    session.refresh(nuevo_usuario)

    return {"id": nuevo_usuario.id, "email": nuevo_usuario.email, "rol": nuevo_usuario.rol}


@app.post("/login")
def login(datos: LoginRequest, session: Session = Depends(get_session)):
    usuario = session.exec(select(Usuario).where(Usuario.email == datos.email)).first()
    if not usuario or not verify_password(datos.password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")

    token = create_access_token({"sub": str(usuario.id), "rol": usuario.rol})
    return {"access_token": token, "token_type": "bearer", "rol": usuario.rol}


# ---------- Estudios ----------

@app.post("/estudios")
async def cargar_estudio(archivo: UploadFile = File(...)):
    if archivo.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    destino = UPLOAD_DIR / archivo.filename
    with destino.open("wb") as buffer:
        shutil.copyfileobj(archivo.file, buffer)

    return {"filename": archivo.filename, "status": "cargado"}