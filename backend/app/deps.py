from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.database import get_session
from app.models import Usuario
from app.security import decode_token

bearer = HTTPBearer(auto_error=False)


def usuario_actual(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    session: Session = Depends(get_session),
) -> Usuario:
    if cred is None:
        raise HTTPException(status_code=401, detail="No autenticado")
    payload = decode_token(cred.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido o vencido")
    usuario = session.get(Usuario, int(payload["sub"]))
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario inexistente")
    return usuario


def solo_bioquimico(u: Usuario = Depends(usuario_actual)) -> Usuario:
    if u.rol != "bioquimico":
        raise HTTPException(status_code=403, detail="Solo para bioquímicos")
    return u


def solo_paciente(u: Usuario = Depends(usuario_actual)) -> Usuario:
    if u.rol != "paciente":
        raise HTTPException(status_code=403, detail="Solo para pacientes")
    return u