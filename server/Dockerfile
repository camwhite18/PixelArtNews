# Builds the web front end and the Go server into one small image.
# Build context: the repository root (see docker-compose.yml).

FROM node:22-alpine AS web
WORKDIR /src/web
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ ./
COPY schema/ /src/schema/
RUN pnpm build

FROM golang:1.27-alpine AS server
WORKDIR /src/server
COPY server/go.mod server/go.sum* ./
COPY server/ ./
# go.sum is generated here on the first build if it isn't committed yet;
# commit the one `go mod tidy` produces to pin exact module hashes.
RUN go mod tidy && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.20
# The media dir is created here so a fresh named volume inherits the owner.
RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D -u 10001 app \
    && mkdir -p /data/media && chown app /data/media
COPY --from=server /out/server /app/server
COPY --from=web /src/web/dist /app/web
USER app
ENV WEB_DIR=/app/web MEDIA_DIR=/data/media HTTP_ADDR=:8080
EXPOSE 8080
ENTRYPOINT ["/app/server"]
