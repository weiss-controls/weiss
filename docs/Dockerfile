FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS builder

WORKDIR /docs

COPY pyproject.toml uv.lock ./
RUN uv sync --locked

COPY src/ ./src/
RUN uv run --locked sphinx-build -b html src /build/html


FROM nginx:alpine

COPY --from=builder /build/html /usr/share/nginx/html

EXPOSE 80
