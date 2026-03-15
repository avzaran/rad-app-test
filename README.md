# rad-app-test

## Поэтапный план реализации фундамента MVP (Frontend/Backend/DB/Auth/Deploy)

### Summary
Ниже пошаговый execution-ready план без бизнес-фич (пациенты/протоколы/шаблоны как продуктовая логика), с фокусом на платформенный фундамент: web-клиент, Go API, AI Gateway, БД, S3, безопасность и CI/CD.

### Этап 0. Инициализация репозитория и стандартов (0.5-1 день)
- Создать монорепо-структуру: `frontend`, `backend`, `ai-gateway`, `deploy`, `.github/workflows`.
- Добавить базовые `README` для каждого сервиса и корневой `Makefile`/скрипты команд.
- Зафиксировать coding conventions: линтеры, форматтеры, правила ветвления и PR-checklist.
- Добавить `.env.example` для всех сервисов и политику именования переменных.

### Этап 1. Frontend foundation (1-1.5 недели)
- Инициализировать `React + TypeScript + Vite`.
- Подключить: `React Router`, `TanStack Query`, `Zustand`, выбранную UI-библиотеку.
- Внедрить app-структуру: `app/pages/features/entities/shared`.
- Реализовать базовые страницы:
  - `Login`
  - `Dashboard` (заглушка)
  - `Access Denied`
- Реализовать инфраструктуру:
  - API client с interceptor’ами и refresh flow
  - auth store (access token in-memory, refresh-cookie стратегия)
  - role-based route guards
  - global error boundary + fallback UI
  - i18n scaffold с русским словарем
- Добавить unit/integration тесты: auth store, guard’ы, refresh сценарии.

### Этап 2. Backend foundation на Go (1.5-2 недели)
- Инициализировать Go-сервис с выбранным стеком (`Gin` или `Fiber`, `pgx`, `zap`, `viper`).
- Ввести слои: `transport`, `service`, `repository`, `domain`.
- Подключить middleware:
  - request-id
  - structured logging
  - rate limit
  - JWT auth
  - RBAC (`admin`, `doctor`)
- Реализовать API:
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `POST /auth/2fa/verify`
  - `GET /me`
  - `GET /healthz`
- Добавить unit/integration тесты для auth/RBAC и цепочки middleware.

### Этап 3. Data layer и storage (1-1.5 недели)
- Поднять `PostgreSQL` и `MinIO` для `dev/stage`.
- Создать миграции:
  - `users`
  - `roles`
  - `user_roles`
  - `audit_events`
  - `files`
- Реализовать репозитории users/roles/audit/files.
- Реализовать файловый сервис:
  - выдача pre-signed URL (upload/download)
  - валидация mime/type/size
  - TTL/lifecycle для временных объектов
- Добавить migration tests и интеграционные тесты upload/download контракта.

### Этап 4. Auth & Security hardening (1-1.5 недели)
- Реализовать JWT access/refresh с ротацией refresh token.
- Внедрить безопасный password hashing (`Argon2id` или `bcrypt` с актуальными параметрами).
- Реализовать TOTP для `admin`:
  - enrollment (secret + QR)
  - verify challenge
  - backup codes (одноразовые)
- Добавить security audit events:
  - login success/fail
  - token refresh
  - 2FA enable/disable
  - role change
- Проверить policy хранения секретов и маскирование чувствительных данных в логах.

### Этап 5. AI Gateway (платформенный, без бизнес-промптов) (1 неделя)
- Поднять отдельный сервис `ai-gateway` с единым API-контрактом вызова LLM.
- Внедрить resiliency:
  - timeout
  - retry с backoff
  - circuit breaker
- Внедрить безопасное логирование (без ПДн).
- Реализовать mock/provider adapter для dev и interface для production-провайдера.
- Добавить smoke/integration тесты на отказоустойчивость gateway.

### Этап 6. Deploy, CI/CD, окружения (1-1.5 недели)
- Подготовить Dockerfile для `frontend`, `backend`, `ai-gateway`.
- Подготовить `docker compose` для локальной и stage-среды (включая Postgres/MinIO/Redis при необходимости).
- Настроить CI:
  - lint
  - unit/integration tests
  - build images
  - security scan
  - push image в registry
- Настроить CD:
  - auto deploy в `dev`
  - manual approval для `stage/prod`
- Настроить environment separation: переменные, секреты, конфиги per env.

### Этап 7. Финальная стабилизация и приемка (0.5-1 неделя)
- Прогнать end-to-end smoke: login -> refresh -> `/me` -> role access -> storage -> health checks.
- Проверить readiness-критерии по каждому окружению (`dev/stage/prod`).
- Провести минимальный security review (auth flows, токены, 2FA, secret handling).
- Зафиксировать release checklist и operational runbook.

### Публичные интерфейсы/контракты (фиксируем заранее)
- Auth API: `/auth/login`, `/auth/refresh`, `/auth/2fa/verify`, `/me`.
- Gateway API: единый endpoint inference (request/response schema versioned).
- Storage API: pre-signed upload/download контракт + ограничение размера/типа.
- RBAC policy: ровно две роли (`admin`, `doctor`) на этом этапе.

### Test Plan (с привязкой к этапам)
- Этап 1: unit/integration frontend auth & routing.
- Этап 2: unit/integration backend auth, middleware, RBAC.
- Этап 3: migration tests + storage contract tests.
- Этап 5: gateway resiliency tests (timeout/retry/circuit breaker).
- Этап 6-7: CI gate + cross-service smoke per environment.

### Assumptions
- Бизнес-фичи протоколов исключены из текущего этапа.
- Язык интерфейса пока русский.
- `dev/stage` на MinIO, `prod` может перейти на managed S3 без смены публичного контракта.
- AI Gateway реализуется как инфраструктурный слой с mock/adapters, без финальной медицинской prompt-логики.
