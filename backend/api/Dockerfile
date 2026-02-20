FROM python:3.12-slim

ARG APP_USER=weiss
RUN useradd -m -s /bin/bash $APP_USER

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/home/$APP_USER

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=$APP_USER:$APP_USER . ./api

RUN pip install --upgrade pip \
&& pip install -r api/requirements.txt

EXPOSE 8000

USER $APP_USER

CMD python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
