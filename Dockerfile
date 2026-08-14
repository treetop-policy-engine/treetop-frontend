FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:stable-alpine-slim AS runtime

ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="Treetop Workbench" \
      org.opencontainers.image.description="Schema-aware browser workbench for Treetop REST" \
      org.opencontainers.image.source="https://github.com/treetop-policy-engine/treetop-frontend" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$REVISION"

RUN apk add --no-cache jq \
    && rm -rf /usr/share/nginx/html/*

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/entrypoint.sh /usr/local/bin/treetop-entrypoint
COPY --from=build --chown=nginx:nginx /app/dist/ /usr/share/nginx/html/
RUN chmod 0644 /etc/nginx/nginx.conf \
    && chmod 0755 /usr/local/bin/treetop-entrypoint

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["treetop-entrypoint"]
CMD ["nginx", "-g", "daemon off;"]
