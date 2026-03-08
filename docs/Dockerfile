FROM python:3.12-slim AS builder

WORKDIR /docs

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
RUN sphinx-build -b html src /build/html


FROM nginx:alpine

COPY --from=builder /build/html /usr/share/nginx/html

EXPOSE 80
