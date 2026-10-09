FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS build

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY pyproject.toml uv.lock ./

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

ENV UV_PROJECT_ENVIRONMENT=/venv
RUN uv sync --locked --no-dev --no-install-project

COPY . .

FROM docker.io/library/python:3.14.4-slim-trixie AS runtime

WORKDIR /app
COPY --from=build /venv/ /venv/
COPY --from=build /app/ /app/

ENV PATH=/venv/bin:$PATH

ENV EPICS_DEFAULT_PROTOCOL=pva
ENV EPICS_CA_ADDR_LIST=localhost
ENV EPICS_PVA_ADDR_LIST=localhost
ENV EPICS_MAX_UPDATE_RATE_HZ=30
ENV EPICS_MAX_CLIENT_QUEUE=1000

EXPOSE 8080

CMD ["python", "epicsWS.py"]
