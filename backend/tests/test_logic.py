from datetime import date, datetime
from unittest.mock import Mock

import pytest

from app.logic import es_pdf, horarios_del_dia, reservar_turno, validar_horario_turno, validar_password

JUEVES = (2026, 10, 22)
SABADO = (2026, 10, 24)


@pytest.mark.parametrize(
    "content_type,nombre,esperado",
    [
        ("application/pdf", "estudio.pdf", True),
        ("application/pdf", "ESTUDIO.PDF", True),
        ("image/png", "estudio.pdf", False),
        ("application/pdf", "estudio.txt", False),
        (None, None, False),
    ],
)
def test_solo_se_aceptan_pdf_reales(content_type, nombre, esperado):
    assert es_pdf(content_type, nombre) == esperado


def test_password_corta_es_rechazada_y_dice_el_minimo():
    motivo = validar_password("123")

    assert motivo is not None
    assert "6" in motivo


def test_password_que_supera_72_bytes_es_rechazada():
    password = "ñ" * 40  # 40 caracteres pero 80 bytes: bcrypt solo admite 72

    assert "72" in validar_password(password)


def test_password_valida_no_devuelve_motivo():
    assert validar_password("123456") is None


def test_turno_en_fin_de_semana_es_rechazado():
    motivo = validar_horario_turno(datetime(*SABADO, 10, 0))

    assert "lunes a viernes" in motivo


@pytest.mark.parametrize(
    "hora,minuto,valido",
    [(7, 30, False), (8, 0, True), (17, 30, True), (18, 0, False)],
)
def test_franja_horaria_incluye_los_bordes(hora, minuto, valido):
    motivo = validar_horario_turno(datetime(*JUEVES, hora, minuto))

    assert (motivo is None) == valido


def test_turno_fuera_de_la_grilla_de_30_minutos_es_rechazado():
    assert validar_horario_turno(datetime(*JUEVES, 10, 15)) is not None


def test_dia_habil_tiene_20_horarios_de_8_a_17_30():
    horarios = horarios_del_dia(date(*JUEVES))

    assert len(horarios) == 20
    assert horarios[0] == datetime(*JUEVES, 8, 0)
    assert horarios[-1] == datetime(*JUEVES, 17, 30)


def test_fin_de_semana_no_tiene_horarios():
    assert horarios_del_dia(date(*SABADO)) == []


def test_reservar_turno_guarda_una_sola_vez():
    repo = Mock()
    repo.ocupados.return_value = []
    horario = datetime(*JUEVES, 10, 0)

    reservar_turno(repo, 2, 1, horario)

    repo.guardar.assert_called_once_with(2, 1, horario)


def test_reservar_turno_solapado_no_guarda_nada():
    horario = datetime(*JUEVES, 10, 0)
    repo = Mock()
    repo.ocupados.return_value = [horario]

    with pytest.raises(ValueError, match="ya tiene un turno"):
        reservar_turno(repo, 2, 1, horario)

    repo.guardar.assert_not_called()


def test_reservar_turno_fuera_de_horario_ni_consulta_la_agenda():
    repo = Mock()

    with pytest.raises(ValueError):
        reservar_turno(repo, 2, 1, datetime(*SABADO, 10, 0))

    repo.ocupados.assert_not_called()