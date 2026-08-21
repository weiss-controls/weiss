FROM mambaorg/micromamba:2.5.0

WORKDIR /app

COPY --chown=$MAMBA_USER:$MAMBA_USER . .

RUN micromamba install -y -n base -f environment.yml && \
    micromamba clean --all --yes

ARG MAMBA_DOCKERFILE_ACTIVATE=1

ENV EPICS_DEFAULT_PROTOCOL=pva
ENV EPICS_CA_ADDR_LIST=localhost
ENV EPICS_PVA_ADDR_LIST=localhost
ENV EPICS_MAX_UPDATE_RATE_HZ=30

ENV PYTHONUNBUFFERED=1
EXPOSE 8080

CMD ["python", "epicsWS.py"]
