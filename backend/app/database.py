import os
from sqlmodel import create_engine, Session

# Sin DATABASE_URL definida (como ahora, corriendo local) → usa SQLite.
# Cuando exista docker-compose, esta misma variable va a apuntar a Postgres.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./local.db")
engine = create_engine(DATABASE_URL, echo=False)

def get_session():
    with Session(engine) as session:
        yield session