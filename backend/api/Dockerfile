FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS build

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY . .

RUN uv build

# Create a virtual environment and install the built wheel
RUN uv venv /venv
ENV PATH=/venv/bin:$PATH
RUN uv pip install dist/*.whl

FROM docker.io/library/python:3.14.4-slim-trixie AS runtime

ARG APP_USER=weiss
ARG APP_UID=1001
ARG APP_GID=1001

RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends git

RUN groupadd -g $APP_GID $APP_USER && \
    adduser --system --no-create-home --uid $APP_UID $APP_USER

RUN mkdir -p /app/storage \
    && chown -R $APP_USER:$APP_USER /app/storage

# copy the virtual environment from the build stage and put it in PATH
COPY --from=build /venv/ /venv/
ENV PATH=/venv/bin:$PATH

USER $APP_UID

ENTRYPOINT ["uvicorn"]
CMD ["api.main:app", "--host", "0.0.0.0", "--port", "8000"]