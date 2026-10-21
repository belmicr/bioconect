from app.security import create_access_token, decode_token, hash_password, verify_password


def test_el_hash_no_es_el_texto_plano_y_verifica():
    hash_ = hash_password("secreto1")

    assert hash_ != "secreto1"
    assert verify_password("secreto1", hash_)
    assert not verify_password("otra-clave", hash_)


def test_el_token_conserva_usuario_y_rol():
    token = create_access_token({"sub": "7", "rol": "paciente"})

    contenido = decode_token(token)

    assert contenido["sub"] == "7"
    assert contenido["rol"] == "paciente"


def test_un_token_adulterado_no_se_acepta():
    assert decode_token("esto.no.es-un-token") is None