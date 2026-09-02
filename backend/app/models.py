from datetime import datetime, date
from typing import Optional
from sqlmodel import SQLModel, Field


class Usuario(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    rol: str  # "bioquimico" o "paciente"
    nombre: str
    apellido: str
    fecha_registro: datetime = Field(default_factory=datetime.utcnow)

    # Campos específicos de paciente (quedan vacíos si rol="bioquimico")
    dni: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    bioquimico_id: Optional[int] = Field(default=None, foreign_key="usuario.id")

    # Campo específico de bioquímico (queda vacío si rol="paciente")
    matricula: Optional[str] = None