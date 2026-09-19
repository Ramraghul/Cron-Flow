import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import {
    API_KEY_HEADER,
    API_KEY_SECURITY_SCHEME,
    API_PREFIX,
    APP_VERSION,
    DOCS_PATH,
    JWT_SECURITY_SCHEME,
} from '../app.constants';

const API_DESCRIPTION = `
CronFlow runs multi-step workflows — HTTP calls and delays — on a **cron schedule**, from a **webhook**, or **on demand**.

### Quick start
1. \`POST /${API_PREFIX}/auth/register\` and copy the \`accessToken\`
2. Click **Authorize**, paste the token into **JWT**
3. \`POST /${API_PREFIX}/workflows\` to create a workflow (see the request examples)
4. \`POST /${API_PREFIX}/workflows/{workflowId}/executions\` to run it now, then poll \`GET /${API_PREFIX}/executions/{id}\`

### Authentication
| Method | Header | Obtain from |
| --- | --- | --- |
| JWT | \`Authorization: Bearer <accessToken>\` | \`POST /${API_PREFIX}/auth/login\` |
| API key | \`${API_KEY_HEADER}: cf_…\` | \`POST /${API_PREFIX}/api-keys\` |

### Errors
Every error response uses the same envelope (\`ErrorResponseDto\`). Its \`requestId\` matches the
\`X-Request-Id\` response header and the server logs.

### Rate limiting
Requests are limited per client IP (100/minute by default; 10/minute for register and login).
Exceeding the limit returns \`429 Too Many Requests\`.
`.trim();

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
    const config = new DocumentBuilder()
        .setTitle('CronFlow API')
        .setDescription(API_DESCRIPTION)
        .setVersion(APP_VERSION)
        .addBearerAuth(
            { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: `Access token from POST /${API_PREFIX}/auth/login` },
            JWT_SECURITY_SCHEME,
        )
        .addApiKey(
            { type: 'apiKey', in: 'header', name: API_KEY_HEADER, description: `API key from POST /${API_PREFIX}/api-keys` },
            API_KEY_SECURITY_SCHEME,
        )
        .addTag('Auth', 'Register, log in, and inspect the current identity')
        .addTag('Workflows', 'Create and manage scheduled workflows')
        .addTag('Executions', 'Run workflows on demand and inspect run history')
        .addTag('Webhooks', 'Trigger workflows from external systems')
        .addTag('Scheduler', 'Live cron schedule state')
        .addTag('Metrics', 'Aggregated execution statistics')
        .addTag('API Keys', 'Credentials for scripts and CI')
        .addTag('Health', 'Liveness and readiness probes')
        .build();

    return SwaggerModule.createDocument(app, config, {
        operationIdFactory: (controllerKey, methodKey) => `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
    });
}

/** Serves Swagger UI at /docs and the raw document at /docs-json. */
export function setupSwagger(app: INestApplication): void {
    SwaggerModule.setup(DOCS_PATH, app, () => buildOpenApiDocument(app), {
        jsonDocumentUrl: `${DOCS_PATH}-json`,
        customSiteTitle: 'CronFlow API Docs',
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            tagsSorter: 'alpha',
            docExpansion: 'list',
        },
    });
}
