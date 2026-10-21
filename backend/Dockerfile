# ---- Etapa 1: build de dependencias (con compilador) ----
FROM python:3.12-slim AS build
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
# ---- Etapa 2: tests (parte del build: ya tiene las dependencias) ----
FROM build AS test
ENV PATH=/root/.local/bin:$PATH
COPY requirements-dev.txt pytest.ini .coveragerc ./
RUN pip install --no-cache-dir --user -r requirements-dev.txt && mkdir -p /out
COPY app ./app
COPY tests ./tests
ENTRYPOINT ["pytest", "--cov", "--cov-report=term-missing", "--cov-report=xml:/out/coverage.xml", "--cov-report=html:/out/htmlcov", "--junitxml=/out/tests.xml", "--cov-fail-under=90"]


# ---- Etapa 3: runtime (sin herramientas de build) ----
FROM python:3.12-slim AS final
WORKDIR /app
ENV PATH=/root/.local/bin:$PATH
COPY --from=build /root/.local /root/.local
COPY app ./app
EXPOSE 8000
ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]