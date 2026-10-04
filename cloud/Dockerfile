# syntax=docker/dockerfile:1
# Build from the repo root, since the API is generated from packages/contracts/openapi:
#   docker build -f cloud/Dockerfile -t muneem-api .
FROM golang:1.26-bookworm AS build
# On a shared machine, cap the compile: --build-arg GOFLAGS=-p=2
ARG GOFLAGS=""
ENV GOFLAGS=${GOFLAGS}
WORKDIR /src/cloud
COPY cloud/go.mod cloud/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY packages/contracts/openapi/ /src/packages/contracts/openapi/
COPY cloud/ ./
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    make gen && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
ARG VERSION=dev
LABEL org.opencontainers.image.title="muneem-api" \
      org.opencontainers.image.source="https://github.com/thesparselabs/muneem" \
      org.opencontainers.image.version="${VERSION}"
COPY --from=build /out/api /api
USER nonroot:nonroot
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=6s --start-period=20s --retries=3 CMD ["/api", "healthcheck"]
ENTRYPOINT ["/api"]
