import os
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import Session, SQLModel, select

from app.database import engine, get_session
from app.deps import solo_bioquimico, solo_paciente, usuario_actual
from app.logic import es_pdf, horarios_del_dia, reservar_turno, validar_password
from app.models import ChatMensaje, Estudio, PedidoMedico, Turno, Usuario
from app.security import create_access_token, hash_password, verify_password

app = FastAPI(title="BioConect API")

UPLOADS = Path(os.environ.get("UPLOAD_DIR", "uploads"))
MAX_PDF_BYTES = 10 * 1024 * 1024
ESTADOS_TURNO = ("pendiente", "confirmado", "cancelado")


@app.on_event("startup")
def on_startup():
    (UPLOADS / "estudios").mkdir(parents=True, exist_ok=True)
    (UPLOADS / "pedidos").mkdir(parents=True, exist_ok=True)
    SQLModel.metadata.create_all(engine)


@app.get("/health")
def health():
    # "commit" lo va a usar el pipeline (TP6/TP7) para saber qué versión corre
    return {"status": "ok", "commit": os.environ.get("GIT_SHA", "dev")}


# ---------- Helpers ----------

def publico(u: Usuario) -> dict:
    """Datos del usuario que se pueden mostrar. Nunca el password_hash."""
    return {
        "id": u.id,
        "email": u.email,
        "rol": u.rol,
        "nombre": u.nombre,
        "apellido": u.apellido,
        "dni": u.dni,
        "matricula": u.matricula,
        "bioquimico_id": u.bioquimico_id,
    }


async def guardar_pdf(archivo: UploadFile, carpeta: str) -> str:
    if not es_pdf(archivo.content_type, archivo.filename):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")
    contenido = await archivo.read()
    if len(contenido) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="El PDF supera los 10 MB")
    nombre = f"{uuid.uuid4().hex}.pdf"
    (UPLOADS / carpeta / nombre).write_bytes(contenido)
    return nombre


def enviar_pdf(carpeta: str, nombre: str, descarga: str) -> FileResponse:
    ruta = UPLOADS / carpeta / nombre
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="El archivo ya no está disponible")
    return FileResponse(ruta, media_type="application/pdf", filename=descarga)


def paciente_de(bioq: Usuario, paciente_id: int, session: Session) -> Usuario:
    p = session.get(Usuario, paciente_id)
    if not p or p.rol != "paciente" or p.bioquimico_id != bioq.id:
        raise HTTPException(status_code=404, detail="Paciente no encontrado")
    return p


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


class PacienteRequest(BaseModel):
    email: str
    password: str
    nombre: str
    apellido: str
    dni: Optional[str] = None
    fecha_nacimiento: Optional[date] = None


class ChatRequest(BaseModel):
    contraparte_id: int
    contenido: str


class TurnoRequest(BaseModel):
    fecha_hora: datetime  # sin zona horaria: "2026-10-22T10:00:00"
    paciente_id: Optional[int] = None  # solo lo manda el bioquímico


class EstadoRequest(BaseModel):
    estado: str


class IndicacionesRequest(BaseModel):
    indicaciones: str


# ---------- Autenticación ----------

@app.post("/registro")
def registro(datos: RegistroRequest, session: Session = Depends(get_session)):
    # OJO: registro abierto, útil para crear el primer bioquímico.
    # En producción real hay que cerrarlo (lo dejamos anotado).
    if datos.rol not in ("bioquimico", "paciente"):
        raise HTTPException(status_code=400, detail="Rol inválido")
    error = validar_password(datos.password)
    if error:
        raise HTTPException(status_code=400, detail=error)
    if session.exec(select(Usuario).where(Usuario.email == datos.email)).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    nuevo = Usuario(
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
    session.add(nuevo)
    session.commit()
    session.refresh(nuevo)
    return {"id": nuevo.id, "email": nuevo.email, "rol": nuevo.rol}


@app.post("/login")
def login(datos: LoginRequest, session: Session = Depends(get_session)):
    usuario = session.exec(select(Usuario).where(Usuario.email == datos.email)).first()
    if not usuario or not verify_password(datos.password, usuario.password_hash):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    token = create_access_token({"sub": str(usuario.id), "rol": usuario.rol})
    return {
        "access_token": token,
        "token_type": "bearer",
        "rol": usuario.rol,
        "usuario": publico(usuario),
    }


@app.get("/me")
def me(u: Usuario = Depends(usuario_actual)):
    return publico(u)


# ---------- Pacientes (los gestiona el bioquímico) ----------

@app.get("/pacientes")
def listar_pacientes(bioq: Usuario = Depends(solo_bioquimico), session: Session = Depends(get_session)):
    pacientes = session.exec(
        select(Usuario).where(Usuario.rol == "paciente", Usuario.bioquimico_id == bioq.id)
    ).all()
    return [publico(p) for p in pacientes]


@app.post("/pacientes")
def crear_paciente(
    datos: PacienteRequest,
    bioq: Usuario = Depends(solo_bioquimico),
    session: Session = Depends(get_session),
):
    error = validar_password(datos.password)
    if error:
        raise HTTPException(status_code=400, detail=error)
    if session.exec(select(Usuario).where(Usuario.email == datos.email)).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    p = Usuario(
        email=datos.email,
        password_hash=hash_password(datos.password),
        rol="paciente",
        nombre=datos.nombre,
        apellido=datos.apellido,
        dni=datos.dni,
        fecha_nacimiento=datos.fecha_nacimiento,
        bioquimico_id=bioq.id,
    )
    session.add(p)
    session.commit()
    session.refresh(p)
    return publico(p)


# ---------- Estudios ----------

@app.post("/estudios")
async def cargar_estudio(
    paciente_id: int = Form(...),
    descripcion: Optional[str] = Form(None),
    archivo: UploadFile = File(...),
    bioq: Usuario = Depends(solo_bioquimico),
    session: Session = Depends(get_session),
):
    paciente_de(bioq, paciente_id, session)
    nombre = await guardar_pdf(archivo, "estudios")
    estudio = Estudio(
        paciente_id=paciente_id,
        bioquimico_id=bioq.id,
        archivo=nombre,
        descripcion=descripcion,
    )
    session.add(estudio)
    session.commit()
    session.refresh(estudio)
    return estudio


@app.get("/estudios")
def listar_estudios(u: Usuario = Depends(usuario_actual), session: Session = Depends(get_session)):
    campo = Estudio.paciente_id if u.rol == "paciente" else Estudio.bioquimico_id
    return session.exec(
        select(Estudio).where(campo == u.id).order_by(Estudio.fecha_carga.desc())
    ).all()


@app.get("/estudios/{estudio_id}/pdf")
def descargar_estudio(
    estudio_id: int,
    u: Usuario = Depends(usuario_actual),
    session: Session = Depends(get_session),
):
    e = session.get(Estudio, estudio_id)
    if not e or u.id not in (e.paciente_id, e.bioquimico_id):
        raise HTTPException(status_code=404, detail="Estudio no encontrado")
    return enviar_pdf("estudios", e.archivo, f"estudio-{e.id}.pdf")


# ---------- Chat ----------

def par_chat(u: Usuario, otro_id: int, session: Session) -> tuple[int, int]:
    """Devuelve (paciente_id, bioquimico_id) validando que el usuario pueda hablar con 'otro'."""
    if u.rol == "paciente":
        if u.bioquimico_id != otro_id:
            raise HTTPException(status_code=403, detail="Solo podés chatear con tu bioquímico")
        return u.id, otro_id
    paciente_de(u, otro_id, session)
    return otro_id, u.id


@app.post("/chat")
def enviar_mensaje(
    datos: ChatRequest,
    u: Usuario = Depends(usuario_actual),
    session: Session = Depends(get_session),
):
    if not datos.contenido.strip():
        raise HTTPException(status_code=400, detail="El mensaje está vacío")
    paciente_id, bioquimico_id = par_chat(u, datos.contraparte_id, session)
    mensaje = ChatMensaje(
        paciente_id=paciente_id,
        bioquimico_id=bioquimico_id,
        emisor=u.rol,
        contenido=datos.contenido.strip(),
    )
    session.add(mensaje)
    session.commit()
    session.refresh(mensaje)
    return mensaje


@app.get("/chat/{otro_id}")
def historial_chat(
    otro_id: int,
    u: Usuario = Depends(usuario_actual),
    session: Session = Depends(get_session),
):
    paciente_id, bioquimico_id = par_chat(u, otro_id, session)
    return session.exec(
        select(ChatMensaje)
        .where(ChatMensaje.paciente_id == paciente_id, ChatMensaje.bioquimico_id == bioquimico_id)
        .order_by(ChatMensaje.fecha_envio)
    ).all()


# ---------- Pedidos médicos ----------

@app.post("/pedidos")
async def cargar_pedido(
    archivo: UploadFile = File(...),
    p: Usuario = Depends(solo_paciente),
    session: Session = Depends(get_session),
):
    if not p.bioquimico_id:
        raise HTTPException(status_code=400, detail="No tenés un bioquímico asignado")
    nombre = await guardar_pdf(archivo, "pedidos")
    pedido = PedidoMedico(paciente_id=p.id, bioquimico_id=p.bioquimico_id, archivo=nombre)
    session.add(pedido)
    session.commit()
    session.refresh(pedido)
    return pedido


@app.get("/pedidos")
def listar_pedidos(u: Usuario = Depends(usuario_actual), session: Session = Depends(get_session)):
    campo = PedidoMedico.paciente_id if u.rol == "paciente" else PedidoMedico.bioquimico_id
    return session.exec(
        select(PedidoMedico).where(campo == u.id).order_by(PedidoMedico.fecha_carga.desc())
    ).all()


@app.get("/pedidos/{pedido_id}/pdf")
def descargar_pedido(
    pedido_id: int,
    u: Usuario = Depends(usuario_actual),
    session: Session = Depends(get_session),
):
    p = session.get(PedidoMedico, pedido_id)
    if not p or u.id not in (p.paciente_id, p.bioquimico_id):
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return enviar_pdf("pedidos", p.archivo, f"pedido-{p.id}.pdf")


@app.put("/pedidos/{pedido_id}/indicaciones")
def responder_pedido(
    pedido_id: int,
    datos: IndicacionesRequest,
    bioq: Usuario = Depends(solo_bioquimico),
    session: Session = Depends(get_session),
):
    pedido = session.get(PedidoMedico, pedido_id)
    if not pedido or pedido.bioquimico_id != bioq.id:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if not datos.indicaciones.strip():
        raise HTTPException(status_code=400, detail="Las indicaciones están vacías")
    pedido.indicaciones = datos.indicaciones.strip()
    pedido.estado = "respondido"
    session.add(pedido)
    session.commit()
    session.refresh(pedido)
    return pedido


# ---------- Turnos ----------

def ocupados_de(bioquimico_id: int, session: Session) -> list[datetime]:
    return session.exec(
        select(Turno.fecha_hora).where(
            Turno.bioquimico_id == bioquimico_id, Turno.estado != "cancelado"
        )
    ).all()

   class RepoTurnos:
       """Acceso a datos de turnos: es la dependencia que reservar_turno recibe desde afuera."""

       def __init__(self, session: Session):
           self.session = session

       def ocupados(self, bioquimico_id: int) -> list[datetime]:
           return ocupados_de(bioquimico_id, self.session)

       def guardar(self, paciente_id: int, bioquimico_id: int, fecha_hora: datetime) -> Turno:
           turno = Turno(paciente_id=paciente_id, bioquimico_id=bioquimico_id, fecha_hora=fecha_hora)
           self.session.add(turno)
           self.session.commit()
           self.session.refresh(turno)
           return turno

@app.get("/turnos/disponibles")
def turnos_disponibles(
    dia: date,
    u: Usuario = Depends(usuario_actual),
    session: Session = Depends(get_session),
):
    bioquimico_id = u.bioquimico_id if u.rol == "paciente" else u.id
    if not bioquimico_id:
        raise HTTPException(status_code=400, detail="No tenés un bioquímico asignado")
    ocupados = ocupados_de(bioquimico_id, session)
    return [h.isoformat() for h in horarios_del_dia(dia) if h not in ocupados]


@app.post("/turnos")
def crear_turno(
    datos: TurnoRequest,
    u: Usuario = Depends(usuario_actual),
    session: Session = Depends(get_session),
):
    if u.rol == "paciente":
        if not u.bioquimico_id:
            raise HTTPException(status_code=400, detail="No tenés un bioquímico asignado")
        paciente_id, bioquimico_id = u.id, u.bioquimico_id
    else:
        if not datos.paciente_id:
            raise HTTPException(status_code=400, detail="Falta el paciente")
        paciente_de(u, datos.paciente_id, session)
        paciente_id, bioquimico_id = datos.paciente_id, u.id

       try:
           return reservar_turno(RepoTurnos(session), paciente_id, bioquimico_id, datos.fecha_hora)
       except ValueError as error:
           raise HTTPException(status_code=400, detail=str(error))
   


@app.get("/turnos")
def listar_turnos(u: Usuario = Depends(usuario_actual), session: Session = Depends(get_session)):
    campo = Turno.paciente_id if u.rol == "paciente" else Turno.bioquimico_id
    return session.exec(select(Turno).where(campo == u.id).order_by(Turno.fecha_hora)).all()


@app.put("/turnos/{turno_id}/estado")
def cambiar_estado_turno(
    turno_id: int,
    datos: EstadoRequest,
    u: Usuario = Depends(usuario_actual),
    session: Session = Depends(get_session),
):
    turno = session.get(Turno, turno_id)
    if not turno or u.id not in (turno.paciente_id, turno.bioquimico_id):
        raise HTTPException(status_code=404, detail="Turno no encontrado")
    if datos.estado not in ESTADOS_TURNO:
        raise HTTPException(status_code=400, detail="Estado inválido")
    if u.rol == "paciente" and datos.estado != "cancelado":
        raise HTTPException(status_code=403, detail="Solo podés cancelar tus turnos")
    turno.estado = datos.estado
    session.add(turno)
    session.commit()
    session.refresh(turno)
    return turno