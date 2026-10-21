from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.deps import solo_bioquimico, solo_paciente, usuario_actual
from app.models import Usuario
from app.security import create_access_token


def credenciales(token):
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_sin_token_es_401():
    with pytest.raises(HTTPException) as error:
        usuario_actual(None, Mock())

    assert error.value.status_code == 401


def test_token_invalido_es_401():
    with pytest.raises(HTTPException) as error:
        usuario_actual(credenciales("basura"), Mock())

    assert error.value.status_code == 401


def test_token_valido_devuelve_el_usuario_de_la_base():
    sesion = Mock()
    sesion.get.return_value = SimpleNamespace(id=7, rol="paciente")
    token = create_access_token({"sub": "7", "rol": "paciente"})

    usuario = usuario_actual(credenciales(token), sesion)

    assert usuario.id == 7
    sesion.get.assert_called_once_with(Usuario, 7)


def test_token_de_un_usuario_borrado_es_401():
    sesion = Mock()
    sesion.get.return_value = None
    token = create_access_token({"sub": "7", "rol": "paciente"})

    with pytest.raises(HTTPException) as error:
        usuario_actual(credenciales(token), sesion)

    assert error.value.status_code == 401


def test_un_paciente_no_pasa_por_la_puerta_del_bioquimico():
    with pytest.raises(HTTPException) as error:
        solo_bioquimico(SimpleNamespace(rol="paciente"))

    assert error.value.status_code == 403


def test_un_bioquimico_no_pasa_por_la_puerta_del_paciente():
    with pytest.raises(HTTPException) as error:
        solo_paciente(SimpleNamespace(rol="bioquimico"))

    assert error.value.status_code == 403
def test_un_bioquimico_pasa_por_la_puerta_del_bioquimico():
    usuario = SimpleNamespace(rol="bioquimico")

    assert solo_bioquimico(usuario) is usuario


def test_un_paciente_pasa_por_la_puerta_del_paciente():
    usuario = SimpleNamespace(rol="paciente")

    assert solo_paciente(usuario) is usuario