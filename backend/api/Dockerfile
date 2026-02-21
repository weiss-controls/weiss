FROM python:3.12-slim

ARG APP_USER=weiss
ARG APP_UID=1000
ARG APP_GID=1000

ENV APP_USER=${APP_USER}

RUN groupadd -g $APP_GID $APP_USER \
    && useradd -m -u $APP_UID -g $APP_GID -s /bin/bash $APP_USER

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=$APP_USER:$APP_USER . ./api

RUN pip install --upgrade pip \
    && pip install -r api/requirements.txt

RUN mkdir -p /app/storage \
    && chown -R $APP_USER:$APP_USER /app/storage

COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

CMD python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
