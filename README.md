# CronFlow v2

> Production-grade workflow automation platform built with NestJS, Prisma, BullMQ, and Redis.

---

## What's New in v2

| Feature | Details |
|---------|---------|
| **Swagger** | Auto-generated docs at `/docs` |
| **API Rate Limiting** | Global throttling via `@nestjs/throttler` |
| **Structured Logging** | JSON logs via `nestjs-pino` / Pino |
| **Cron Automation** | Scheduler engine auto-registers workflows on boot |
| **API Keys** | `cf_`-prefixed keys, bcrypt-stored, `x-api-key` header |
| **Scheduler Engine** | Dynamic `CronJob` registry; pause/resume syncs live |
| **Workflow Pause/Resume** | `PATCH /workflows/:id/pause` and `/resume` |
| **Webhook Triggers** | `POST /webhooks/:token/trigger` — no auth needed |
| **Metrics Endpoint** | Aggregated stats, per-workflow metrics, health check |
| **Dashboard** | Standalone `dashboard.html` — no build step |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      NestJS App                          │
│                                                          │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐   │
│  │  Auth   │ │Workflows │ │Executions│ │  Metrics  │   │
│  └─────────┘ └──────────┘ └──────────┘ └───────────┘   │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐   │
│  │API Keys │ │Scheduler │ │ Webhooks │ │  Queues   │   │
│  └─────────┘ └──────────┘ └──────────┘ └───────────┘   │
│                                                          │
│  Cross-cutting: ThrottlerGuard · Pino Logger · Swagger   │
└─────────────────────────────────────────────────────────┘
         │                              │
   PostgreSQL                         Redis
   (Prisma ORM)                   (BullMQ queues)
```

### Module Map

```
src/
├── auth/            JWT register/login, Passport strategy
├── workflows/       CRUD + pause/resume + scheduler sync
├── executions/      Manual trigger, history, pagination
├── queues/          BullMQ queue + workflow processor worker
├── scheduler/       @nestjs/schedule cron engine, dynamic jobs
├── webhooks/        Token-based trigger (no auth required)
├── api-keys/        Key generation (bcrypt), listing, revocation
├── metrics/         Health, global stats, per-workflow metrics
├── common/          Guards, filters, interceptors
└── database/        Prisma service
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| PostgreSQL | ≥ 14 |
| Redis | ≥ 6 |
| npm | ≥ 9 |

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, REDIS_URL

# 3. Run migrations
npx prisma migrate deploy
npx prisma generate

# 4. Start (development)
npm run start:dev

# 5. Open Swagger docs
open http://localhost:3000/docs

# 6. Open Dashboard (no server needed — just open the file)
open dashboard.html
```

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3000` | No | HTTP port |
| `DATABASE_URL` | — | **Yes** | PostgreSQL connection string |
| `JWT_SECRET` | — | **Yes** | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | `7d` | No | JWT expiry |
| `REDIS_URL` | `redis://localhost:6379` | **Yes** | Redis connection |
| `REDIS_HOST` | `localhost` | No | Redis host (fallback) |
| `REDIS_PORT` | `6379` | No | Redis port (fallback) |
| `THROTTLE_TTL` | `60000` | No | Rate limit window (ms) |
| `THROTTLE_LIMIT` | `100` | No | Requests per window |
| `LOG_LEVEL` | `info` | No | `trace`/`debug`/`info`/`warn`/`error` |
| `NODE_ENV` | `development` | No | Enables pino-pretty in dev |

---

## API Quick Reference

### Auth
```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret"}'

# Login → get token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret"}'
```

### Workflows
```bash
TOKEN="eyJ..."

# Create workflow (auto-registers with scheduler)
curl -X POST http://localhost:3000/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Ping",
    "cronExpression": "0 8 * * *",
    "steps": [
      { "stepOrder": 1, "type": "HTTP", "config": { "url": "https://httpbin.org/post", "method": "POST" } }
    ]
  }'

# List workflows
curl http://localhost:3000/workflows -H "Authorization: Bearer $TOKEN"

# Pause / Resume
curl -X PATCH http://localhost:3000/workflows/<id>/pause  -H "Authorization: Bearer $TOKEN"
curl -X PATCH http://localhost:3000/workflows/<id>/resume -H "Authorization: Bearer $TOKEN"

# Delete
curl -X DELETE http://localhost:3000/workflows/<id> -H "Authorization: Bearer $TOKEN"
```

### Executions
```bash
# Manual trigger
curl -X POST http://localhost:3000/executions/<workflowId>/trigger \
  -H "Authorization: Bearer $TOKEN"

# View execution + logs
curl http://localhost:3000/executions/<executionId> -H "Authorization: Bearer $TOKEN"

# Paginated list for a workflow
curl "http://localhost:3000/workflows/<id>/executions?limit=20&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

### Webhooks
```bash
# Trigger via webhook token (no auth needed — token is the secret)
curl -X POST http://localhost:3000/webhooks/<webhookToken>/trigger \
  -H "Content-Type: application/json" \
  -d '{"event": "deploy", "branch": "main"}'
```

### API Keys
```bash
# Create key (JWT required for creation)
curl -X POST http://localhost:3000/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "CI Key"}'

# Use API key (instead of JWT)
curl http://localhost:3000/workflows -H "x-api-key: cf_abc123..."

# List keys
curl http://localhost:3000/api-keys -H "Authorization: Bearer $TOKEN"

# Revoke
curl -X DELETE http://localhost:3000/api-keys/<id> -H "Authorization: Bearer $TOKEN"
```

### Metrics
```bash
# Health (no auth)
curl http://localhost:3000/metrics/health

# Global metrics
curl http://localhost:3000/metrics -H "Authorization: Bearer $TOKEN"

# Per-workflow metrics
curl http://localhost:3000/metrics/workflows/<id> -H "Authorization: Bearer $TOKEN"
```

### Scheduler
```bash
# View active cron jobs + next run times
curl http://localhost:3000/scheduler/jobs -H "Authorization: Bearer $TOKEN"
```

---

## Workflow Steps

### HTTP Step
Makes an outbound HTTP request. Supports retry and timeout.

```json
{
  "stepOrder": 1,
  "type": "HTTP",
  "config": {
    "url": "https://api.example.com/hook",
    "method": "POST"
  }
}
```

### DELAY Step
Pauses execution for a fixed duration (useful for sequencing).

```json
{
  "stepOrder": 2,
  "type": "DELAY",
  "config": { "duration": 3000 }
}
```

### Step defaults (configurable per step)

| Field | Default | Description |
|-------|---------|-------------|
| `retryCount` | `3` | Max retry attempts on failure |
| `timeout` | `30000` ms | Per-step timeout |

---

## Dashboard

`dashboard.html` is a **fully standalone** single HTML file. Open it directly in any browser — no npm, no build step, no server.

### Features
- Live stats: workflow counts, execution totals, success rate, avg duration
- Doughnut charts: executions by status and trigger type
- Full workflow CRUD with in-page form builder
- One-click run / pause / resume / delete
- Execution log viewer
- API key management (create, copy, revoke)
- Scheduler job list with next-run times
- Login / Register modal (stores token in localStorage)
- Auto-reconnect badge (polls `/metrics/health` every 30s)

---

## Trigger Types

Every execution records how it was started:

| Type | How | Auth |
|------|-----|------|
| `MANUAL` | `POST /executions/:id/trigger` | JWT or API Key |
| `CRON` | Automatically by scheduler engine | None (internal) |
| `WEBHOOK` | `POST /webhooks/:token/trigger` | Token in URL |

---

## Rate Limiting

All endpoints are covered by the global `ThrottlerGuard`. Default: **100 req / 60s** per IP.

On breach: `HTTP 429 Too Many Requests`

Adjust in `.env` or `src/config/app.config.ts`.

---

## Logging

In development (`NODE_ENV=development`), logs are pretty-printed with colour via `pino-pretty`.

In production, logs are emitted as **newline-delimited JSON** — pipe directly to any log aggregator (Datadog, Loki, CloudWatch, etc.).

```json
{"level":30,"time":1715253600000,"pid":1,"method":"POST","url":"/workflows","statusCode":201,"responseTime":42}
```

Log level is controlled by `LOG_LEVEL` env var.

---

## Database Schema (v2 additions)

```prisma
model ApiKey {
  id         String    @id @default(cuid())
  userId     String
  name       String
  keyHash    String    @unique   // bcrypt hash
  keyPrefix  String              // first 8 chars for lookup
  lastUsedAt DateTime?
  createdAt  DateTime  @default(now())
}

// Workflow gained:
webhookToken   String @unique @default(cuid())

// Execution gained:
triggerType    TriggerType   // MANUAL | CRON | WEBHOOK
```

---

## Migrations

```bash
# Development
npx prisma migrate dev --name v2_features

# Production
npx prisma migrate deploy
```

The v2 migration (`prisma/migrations/20260509120000_v2_features/migration.sql`) handles:
- `ApiKey` table with indexes
- `webhookToken` column on `Workflow`
- `triggerType` enum + column on `Execution`
- Performance indexes on `Workflow`, `Execution`

---

## Project Structure

```
cronflow/
├── src/
│   ├── api-keys/
│   │   ├── controllers/api-keys.controller.ts
│   │   ├── dto/create-api-key.dto.ts
│   │   ├── repositories/api-keys.repository.ts
│   │   ├── services/api-keys.service.ts
│   │   └── api-keys.module.ts
│   ├── auth/
│   │   ├── controllers/auth.controller.ts     ← Swagger annotated
│   │   ├── dto/{login,register}.dto.ts        ← Swagger annotated
│   │   ├── guards/jwt-auth.guard.ts
│   │   ├── repositories/auth.repository.ts
│   │   ├── services/auth.service.ts
│   │   ├── strategies/jwt.strategy.ts
│   │   └── auth.module.ts
│   ├── common/
│   │   ├── filters/all-exceptions.filter.ts
│   │   └── guards/api-key.guard.ts
│   ├── config/app.config.ts
│   ├── database/
│   │   ├── database.module.ts
│   │   └── prisma.service.ts
│   ├── executions/
│   │   ├── controllers/
│   │   │   ├── execution.controller.ts        ← Swagger annotated
│   │   │   └── execution-query.controller.ts  ← Swagger annotated
│   │   ├── repositories/execution.repository.ts
│   │   ├── services/execution.service.ts
│   │   └── executions.module.ts
│   ├── metrics/
│   │   ├── controllers/metrics.controller.ts
│   │   ├── services/metrics.service.ts
│   │   └── metrics.module.ts
│   ├── queues/
│   │   ├── processors/workflow.processor.ts
│   │   ├── services/queue.service.ts
│   │   └── queues.module.ts
│   ├── scheduler/
│   │   ├── controllers/scheduler.controller.ts
│   │   ├── services/scheduler.service.ts
│   │   └── scheduler.module.ts
│   ├── webhooks/
│   │   ├── controllers/webhooks.controller.ts
│   │   ├── services/webhooks.service.ts
│   │   └── webhooks.module.ts
│   ├── workflows/
│   │   ├── controllers/workflow.controller.ts ← pause/resume + Swagger
│   │   ├── dto/create-workflow.dto.ts         ← Swagger annotated
│   │   ├── entities/workflow.entity.ts
│   │   ├── repositories/workflow.repository.ts
│   │   ├── services/workflow.service.ts       ← scheduler integration
│   │   └── workflow.module.ts
│   ├── app.module.ts
│   └── main.ts                               ← Swagger setup, Pino, CORS
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       └── 20260509120000_v2_features/migration.sql
├── docs/
│   └── API.md                               ← Full endpoint reference
├── dashboard.html                           ← Standalone dashboard (no build)
├── .env.example
├── package.json
└── README.md
```

---

## v1 → v2 Migration Guide

No breaking changes to existing endpoints. v2 adds:

1. Run `npm install` to install new packages
2. Run `npx prisma migrate deploy` to apply the v2 migration
3. All existing workflows will automatically get a `webhookToken`
4. Existing executions will have `triggerType = MANUAL` (migration default)
5. The scheduler auto-loads all `ACTIVE` workflows on startup — no manual registration needed
