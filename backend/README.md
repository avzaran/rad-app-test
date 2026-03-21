# Backend

## Run locally

1. Install Go 1.23+
2. `go mod tidy`
3. `go run ./cmd/api`

Default port: `8080`.

Current implementation keeps core business entities in memory for local bootstrap, while the AI knowledge subsystem can use Postgres when `KNOWLEDGE_DATABASE_URL` is set.
