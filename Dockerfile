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
ARG NEWSNOW_BUILD_COMMIT=local
ENV HOST=0.0.0.0 PORT=4444 NODE_ENV=production NEWSNOW_BUILD_COMMIT=${NEWSNOW_BUILD_COMMIT}
EXPOSE $PORT
CMD ["node", "output/server/index.mjs"]
