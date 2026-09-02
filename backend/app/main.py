import shutil
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from sqlmodel import SQLModel, Session, select
from pydantic import BaseModel

from app.database import engine, get_session
from app.models import Usuario, Turno, Estudio, ChatMensaje, PedidoMedico
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
# ---------- Esquemas de Turno ----------

class TurnoRequest(BaseModel):
    paciente_id: int
    bioquimico_id: int
    fecha_hora: datetime


# ---------- Endpoints de Turno ----------

@app.post("/turnos")
def crear_turno(datos: TurnoRequest, session: Session = Depends(get_session)):
    paciente = session.get(Usuario, datos.paciente_id)
    bioquimico = session.get(Usuario, datos.bioquimico_id)

    if not paciente or paciente.rol != "paciente":
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    if not bioquimico or bioquimico.rol != "bioquimico":
        raise HTTPException(status_code=404, detail="Bioquímico no encontrado")

    # Validar solapamiento (el bug #documentado en TP3, lo resolvemos acá)
    solapado = session.exec(
        select(Turno).where(
            Turno.bioquimico_id == datos.bioquimico_id,
            Turno.fecha_hora == datos.fecha_hora,
            Turno.estado != "cancelado",
        )
    ).first()
    if solapado:
        raise HTTPException(status_code=400, detail="El bioquímico ya tiene un turno en ese horario")

    nuevo_turno = Turno(
        paciente_id=datos.paciente_id,
        bioquimico_id=datos.bioquimico_id,
        fecha_hora=datos.fecha_hora,
    )
    session.add(nuevo_turno)
    session.commit()
    session.refresh(nuevo_turno)
    return nuevo_turno


@app.get("/turnos/paciente/{paciente_id}")
def turnos_de_paciente(paciente_id: int, session: Session = Depends(get_session)):
    turnos = session.exec(select(Turno).where(Turno.paciente_id == paciente_id)).all()
    return turnos
# ---------- Esquemas de Estudio ----------

class EstudioRequest(BaseModel):
    paciente_id: int
    bioquimico_id: int
    descripcion: Optional[str] = None


# ---------- Endpoints de Estudio (histórico) ----------

@app.get("/estudios/paciente/{paciente_id}")
def estudios_de_paciente(paciente_id: int, session: Session = Depends(get_session)):
    estudios = session.exec(select(Estudio).where(Estudio.paciente_id == paciente_id)).all()
    return estudios


@app.get("/estudios/bioquimico/{bioquimico_id}")
def historial_bioquimico(bioquimico_id: int, session: Session = Depends(get_session)):
    estudios = session.exec(select(Estudio).where(Estudio.bioquimico_id == bioquimico_id)).all()
    return estudios


# ---------- Esquemas de Chat ----------

class ChatMensajeRequest(BaseModel):
    paciente_id: int
    bioquimico_id: int
    emisor: str  # "paciente" o "bioquimico"
    contenido: str


# ---------- Endpoints de Chat ----------

@app.post("/chat")
def enviar_mensaje(datos: ChatMensajeRequest, session: Session = Depends(get_session)):
    if datos.emisor not in ("paciente", "bioquimico"):
        raise HTTPException(status_code=400, detail="Emisor inválido")

    mensaje = ChatMensaje(
        paciente_id=datos.paciente_id,
        bioquimico_id=datos.bioquimico_id,
        emisor=datos.emisor,
        contenido=datos.contenido,
    )
    session.add(mensaje)
    session.commit()
    session.refresh(mensaje)
    return mensaje


@app.get("/chat/{paciente_id}/{bioquimico_id}")
def historial_chat(paciente_id: int, bioquimico_id: int, session: Session = Depends(get_session)):
    mensajes = session.exec(
        select(ChatMensaje)
        .where(ChatMensaje.paciente_id == paciente_id, ChatMensaje.bioquimico_id == bioquimico_id)
        .order_by(ChatMensaje.fecha_envio)
    ).all()
    return mensajes


# ---------- Esquemas de Pedido Médico ----------

class PedidoIndicacionesRequest(BaseModel):
    indicaciones: str


# ---------- Endpoints de Pedido Médico ----------

@app.post("/pedidos")
async def cargar_pedido(
    paciente_id: int,
    bioquimico_id: int,
    archivo: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    if archivo.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    destino = Path("uploads/pedidos")
    destino.mkdir(parents=True, exist_ok=True)
    ruta_archivo = destino / archivo.filename
    with ruta_archivo.open("wb") as buffer:
        shutil.copyfileobj(archivo.file, buffer)

    pedido = PedidoMedico(
        paciente_id=paciente_id,
        bioquimico_id=bioquimico_id,
        archivo=archivo.filename,
    )
    session.add(pedido)
    session.commit()
    session.refresh(pedido)
    return pedido


@app.put("/pedidos/{pedido_id}/indicaciones")
def responder_pedido(pedido_id: int, datos: PedidoIndicacionesRequest, session: Session = Depends(get_session)):
    pedido = session.get(PedidoMedico, pedido_id)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    pedido.indicaciones = datos.indicaciones
    pedido.estado = "respondido"
    session.add(pedido)
    session.commit()
    session.refresh(pedido)
    return pedido