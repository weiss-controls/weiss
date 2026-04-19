# Dev environment
FROM node:20-alpine AS dev
WORKDIR /app
COPY . .
# set /app as safe to allow git interaction on mounted folder
RUN apk add --no-cache git \
 && git config --global --add safe.directory /app
RUN npm install --global corepack@latest && corepack enable pnpm
RUN pnpm install

CMD pnpm run dev --host

# Production build
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_DEMO_MODE
ENV VITE_DEMO_MODE=${VITE_DEMO_MODE}
COPY . .
RUN apk add --no-cache git
RUN npm install --global corepack@latest && corepack enable pnpm
RUN pnpm install && pnpm run build

# Production image
FROM nginx:1.25-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html

COPY ./nginx/default.http.template  /etc/nginx/conf.d/default.http.template
COPY ./nginx/default.https.template /etc/nginx/conf.d/default.https.template
COPY ./nginx/default.docs.template  /etc/nginx/conf.d/default.docs.template

COPY ./nginx/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
