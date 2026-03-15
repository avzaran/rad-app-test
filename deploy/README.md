# Deploy

`docker-compose.yml` starts:

- frontend (port 5173)
- backend (port 8080)
- ai-gateway (port 8090)
- postgres (port 5432)
- minio API (port 9000) and console (9001)
- redis (port 6379)

Run:

```bash
docker compose up -d --build
```
