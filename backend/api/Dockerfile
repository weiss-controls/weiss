FROM python:3.12-slim

ARG APP_USER=weiss
RUN useradd -m -s /bin/bash $APP_USER

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/home/$APP_USER

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git openssh-client \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/$APP_USER/.ssh \
    && chown -R $APP_USER:$APP_USER /home/$APP_USER/.ssh \
    && chmod 700 /home/$APP_USER/.ssh

COPY --chown=$APP_USER:$APP_USER . ./api

RUN pip install --upgrade pip \
&& pip install -r api/requirements.txt

EXPOSE 8000

USER $APP_USER

ENTRYPOINT ["/app/api/docker-entrypoint.sh"]
