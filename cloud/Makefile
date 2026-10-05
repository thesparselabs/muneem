# Muneem cloud (Go / Echo). Local infra: `docker compose up -d` from the repo root.
export DATABASE_URL ?= postgres://muneem:muneem@localhost:5433/muneem?sslmode=disable
export JWT_SECRET   ?= dev-only-change-me
export PORT         ?= 8080
export MUNEEM_S3_ENDPOINT   ?= http://localhost:9000
export MUNEEM_S3_BUCKET     ?= muneem-snapshots
export MUNEEM_S3_ACCESS_KEY ?= muneem
export MUNEEM_S3_SECRET_KEY ?= muneem-dev-secret
export MUNEEM_S3_REGION     ?= us-east-1
export MUNEEM_BACKUP_MASTER_KEY ?= AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=  # dev only: wraps escrowed backup keys (8f)
OPENAPI := ../packages/contracts/openapi/muneem-v1.yaml

.PHONY: gen build run test lint migrate-up migrate-down db-roles smoke

gen:              ## regenerate api/openapi.gen.go from the shared OpenAPI document
	go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.1 -generate types,echo-server -package api -o api/openapi.gen.go $(OPENAPI)

build: gen
	go build -o bin/muneem-api ./cmd/api
	go build -o bin/verify-fixture ./cmd/verify-fixture

run: gen
	go run ./cmd/api

test: gen
	go test ./...

lint: gen
	go vet ./...

migrate-up: gen
	go run ./cmd/api migrate-up

migrate-down: gen
	go run ./cmd/api migrate-down

# Dev only: a login role that inherits muneem_api so RLS policies actually apply to the API connection.
db-roles:
	psql "$(DATABASE_URL)" -v ON_ERROR_STOP=1 -c "DO \$$\$$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='muneem_app') THEN CREATE ROLE muneem_app LOGIN PASSWORD 'muneem_app'; END IF; END \$$\$$;" -c "GRANT muneem_api TO muneem_app;"
