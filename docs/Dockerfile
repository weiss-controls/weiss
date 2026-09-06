FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS builder

WORKDIR /docs

COPY requirements.txt .
RUN uv pip install --system -r requirements.txt

COPY src/ ./src/
RUN sphinx-build -b html src /build/html


FROM nginx:alpine

COPY --from=builder /build/html /usr/share/nginx/html

EXPOSE 80
