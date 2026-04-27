# This file is for use as a devcontainer and a runtime container
#
# The devcontainer should use the build target and run as root with podman
# or docker with user namespaces.
#
FROM docker.io/library/python:3.14.4-slim-trixie as build

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Add any system dependencies for the developer/build environment here
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY . /project
WORKDIR /project

# make the wheel outside of the venv so 'build' does not dirty requirements.txt
RUN pip install --upgrade pip build && \
    # comment the following line if building locally/with a detached head/Git errors pop up during build
    export SOURCE_DATE_EPOCH=$(git log -1 --pretty=%ct) && \
    python -m build

# set up a virtual environment and put it in PATH
RUN python -m venv /venv
ENV PATH=/venv/bin:$PATH
ENV TOX_DIRECT=1

# install the wheel and generate the requirements file
RUN pip install --upgrade pip && \
    pip install dist/*.whl && \
    mkdir -p lockfiles && \
    pip freeze  > lockfiles/requirements.txt && \
    # we don't want to include our own wheel in requirements - remove with sed
    # and replace with a comment to avoid a zero length asset upload later
    sed -i '/file:/s/^/# Requirements for /' lockfiles/requirements.txt

FROM docker.io/library/python:3.14.4-slim-trixie as runtime

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