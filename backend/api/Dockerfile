FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git openssh-client \
    && rm -rf /var/lib/apt/lists/*

COPY . ./api

RUN pip install --upgrade pip \
    && pip install -r api/requirements.txt

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
