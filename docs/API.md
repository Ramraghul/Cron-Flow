# CronFlow v2 — API Reference

> **Interactive Docs**: Start the server and visit `http://localhost:3000/docs`  
> **Base URL**: `http://localhost:3000`

---

## Authentication

CronFlow supports two authentication methods:

| Method | Header | How to get |
|--------|--------|-----------|
| **JWT Bearer** | `Authorization: Bearer <token>` | `POST /auth/login` |
| **API Key** | `x-api-key: cf_<key>` | `POST /api-keys` |

---

## Endpoints

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | ❌ | Register a new user |
| `POST` | `/auth/login` | ❌ | Login and receive JWT token |

**Register body**
```json
{ "email": "user@example.com", "password": "secret123" }
```
**Response**
```json
{ "id": "cuid", "email": "user@example.com", "token": "eyJ..." }
```

---

### Workflows

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/workflows` | ✅ | Create a workflow |
| `GET` | `/workflows` | ✅ | List user's workflows |
| `GET` | `/workflows/:id` | ✅ | Get workflow details |
| `PATCH` | `/workflows/:id/pause` | ✅ | Pause — stops cron |
| `PATCH` | `/workflows/:id/resume` | ✅ | Resume — re-registers cron |
| `DELETE` | `/workflows/:id` | ✅ | Delete + unregister cron |

**Create Workflow body**
```json
{
  "name": "Daily Report",
  "description": "Sends daily summary",
  "cronExpression": "0 8 * * *",
  "steps": [
    {
      "stepOrder": 1,
      "type": "HTTP",
      "config": { "url": "https://api.example.com/notify", "method": "POST" }
    },
    {
      "stepOrder": 2,
      "type": "DELAY",
      "config": { "duration": 2000 }
    }
  ]
}
```

**Step Types**

| Type | Config keys | Description |
|------|-------------|-------------|
| `HTTP` | `url`, `method` | Makes an HTTP request |
| `DELAY` | `duration` (ms) | Waits N milliseconds |

---

### Executions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/executions/:workflowId/trigger` | ✅ | Manually trigger |
| `GET` | `/executions/:executionId` | ✅ | Get execution + step logs |
| `GET` | `/workflows/:workflowId/executions` | ✅ | List executions (paginated) |

**Execution statuses**: `PENDING` → `RUNNING` → `SUCCESS` / `FAILED`

**Trigger types**: `MANUAL`, `CRON`, `WEBHOOK`

---

### Webhooks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/webhooks/:token/trigger` | ❌ | Trigger via webhook token |

The `webhookToken` is returned with every workflow object.  
No auth required — the token is the secret.

```bash
curl -X POST http://localhost:3000/webhooks/<webhookToken>/trigger \
  -H "Content-Type: application/json" \
  -d '{"source": "github", "event": "push"}'
```

---

### API Keys

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api-keys` | ✅ JWT | Create new API key |
| `GET` | `/api-keys` | ✅ JWT | List keys (masked) |
| `DELETE` | `/api-keys/:id` | ✅ JWT | Revoke a key |

**Create key body**: `{ "name": "CI Pipeline Key" }`

**Response** (key shown only once):
```json
{
  "id": "...",
  "name": "CI Pipeline Key",
  "key": "cf_a1b2c3d4e5f6...",
  "keyPrefix": "cf_a1b2c",
  "warning": "Save this key — it will not be shown again."
}
```

**Using an API key**:
```bash
curl http://localhost:3000/workflows \
  -H "x-api-key: cf_a1b2c3d4e5f6..."
```

---

### Scheduler

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/scheduler/jobs` | ✅ | List active cron jobs + next run |

---

### Metrics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/metrics/health` | ❌ | DB + server health check |
| `GET` | `/metrics` | ✅ | Platform-wide metrics |
| `GET` | `/metrics/workflows/:id` | ✅ | Per-workflow metrics |

**Global metrics response**
```json
{
  "users": { "total": 12 },
  "workflows": { "total": 34, "active": 28, "paused": 6 },
  "executions": {
    "total": 1420,
    "byStatus": { "SUCCESS": 1300, "FAILED": 80, "RUNNING": 40 },
    "byTrigger": { "CRON": 900, "MANUAL": 400, "WEBHOOK": 120 },
    "successRate": "91.5%",
    "avgDurationMs": 843
  }
}
```

---

## Rate Limiting

Default: **100 requests per 60 seconds** per IP.

Configurable via `.env`:
```
THROTTLE_TTL=60000    # window in ms
THROTTLE_LIMIT=100    # requests per window
```

When exceeded: `HTTP 429 Too Many Requests`

---

## Cron Expression Reference

```
┌─────────── minute (0-59)
│ ┌───────── hour (0-23)
│ │ ┌─────── day of month (1-31)
│ │ │ ┌───── month (1-12)
│ │ │ │ ┌─── day of week (0-7, 0=Sun)
│ │ │ │ │
* * * * *
```

| Expression | Meaning |
|-----------|---------|
| `0 8 * * *` | Every day at 8:00 AM |
| `*/5 * * * *` | Every 5 minutes |
| `0 9 * * 1-5` | Weekdays at 9 AM |
| `0 0 1 * *` | First of every month |

---

## Error Responses

All errors follow this shape:
```json
{
  "statusCode": 400,
  "timestamp": "2026-05-09T10:00:00.000Z",
  "path": "/workflows",
  "method": "POST",
  "message": "Validation failed"
}
```
