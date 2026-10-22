import os
from sqlmodel import create_engine, Session

# Sin DATABASE_URL (desarrollo local sin Docker) usa SQLite.
# pool_pre_ping prueba la conexión antes de usarla: Neon (serverless) cierra las
# inactivas y sin esto la primera consulta después de un rato falla con
# "SSL connection has been closed unexpectedly". pool_recycle evita conexiones viejas.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./local.db")
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=300,
)


def get_session():
    with Session(engine) as session:
        yield session