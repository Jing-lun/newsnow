FROM node:20.12.2-alpine AS builder
WORKDIR /usr/src
COPY . .
RUN corepack enable
RUN pnpm install
RUN pnpm run build

FROM node:20.12.2-alpine
WORKDIR /usr/app
RUN apk add --no-cache curl
COPY --from=builder /usr/src/dist/output ./output
ARG NEWSNOW_DECLARED_REVISION
ENV HOST=0.0.0.0 PORT=4444 NODE_ENV=production NEWSNOW_DECLARED_REVISION=${NEWSNOW_DECLARED_REVISION}
EXPOSE $PORT
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD curl -fsS "http://127.0.0.1:${PORT}/api/ready" || exit 1
CMD ["node", "output/server/index.mjs"]
