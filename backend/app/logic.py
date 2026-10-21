from datetime import date, datetime, time, timedelta
from typing import Optional

HORA_INICIO = time(8, 0)
HORA_FIN = time(17, 30)


def es_pdf(content_type: Optional[str], filename: Optional[str]) -> bool:
    return (
        content_type == "application/pdf"
        and bool(filename)
        and filename.lower().endswith(".pdf")
    )


def validar_password(password: str) -> Optional[str]:
    """Devuelve None si es válida, o el motivo del rechazo."""
    if len(password) < 6:
        return "La contraseña debe tener al menos 6 caracteres"
    if len(password.encode("utf-8")) > 72:
        return "La contraseña no puede superar los 72 bytes"
    return None


def validar_horario_turno(fecha_hora: datetime) -> Optional[str]:
    """Devuelve None si el horario es válido, o el motivo del rechazo."""
    if fecha_hora.weekday() >= 5:
        return "Los turnos son de lunes a viernes"
    if fecha_hora.minute not in (0, 30) or fecha_hora.second != 0:
        return "Los turnos son cada 30 minutos (en punto o y media)"
    if not (HORA_INICIO <= fecha_hora.time() <= HORA_FIN):
        return "Los turnos son entre las 08:00 y las 17:30"
    return None


def horarios_del_dia(dia: date) -> list[datetime]:
    """Todos los horarios posibles de un día (vacío si es fin de semana)."""
    if dia.weekday() >= 5:
        return []
    horarios = []
    actual = datetime.combine(dia, HORA_INICIO)
    fin = datetime.combine(dia, HORA_FIN)
    while actual <= fin:
        horarios.append(actual)
        actual += timedelta(minutes=30)
    return horarios

def reservar_turno(repo, paciente_id: int, bioquimico_id: int, fecha_hora: datetime):
    """Regla de negocio de reservar un turno. 'repo' entra desde afuera (inyección de dependencias)."""
    motivo = validar_horario_turno(fecha_hora)
    if motivo:
        raise ValueError(motivo)
    if fecha_hora in repo.ocupados(bioquimico_id):
        raise ValueError("El bioquímico ya tiene un turno en ese horario")
    return repo.guardar(paciente_id, bioquimico_id, fecha_hora)