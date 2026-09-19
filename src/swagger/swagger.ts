import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
    API_KEY_HEADER,
    API_KEY_SECURITY_SCHEME,
    API_PREFIX,
    APP_VERSION,
    DEPLOYED_API_ORIGIN,
    DOCS_PATH,
    JWT_SECURITY_SCHEME,
    LOCAL_API_ORIGIN,
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

export interface ApiServer {
    url: string;
    description: string;
}

/**
 * Servers offered in Swagger UI's "Try it out" selector. Swagger UI preselects the first one, so the
 * environment the docs are being viewed on comes first.
 */
export function apiServers(env: NodeJS.ProcessEnv = process.env): ApiServer[] {
    const local: ApiServer = { url: LOCAL_API_ORIGIN, description: 'Local development' };
    const deployed: ApiServer = { url: DEPLOYED_API_ORIGIN, description: 'Deployed (Vercel)' };
    return isOnVercel(env) ? [deployed, local] : [local, deployed];
}

/** Vercel sets VERCEL=1 in deployments that expose system environment variables (the default). */
function isOnVercel(env: NodeJS.ProcessEnv): boolean {
    return Boolean(env.VERCEL);
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
    const builder = new DocumentBuilder()
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
        .addTag('Health', 'Liveness and readiness probes');
    for (const server of apiServers()) {
        builder.addServer(server.url, server.description);
    }
    const config = builder.build();

    return SwaggerModule.createDocument(app, config, {
        operationIdFactory: (controllerKey, methodKey) => `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
    });
}

/**
 * Swagger UI's static files (the swagger-ui-dist package), served directly at /docs.
 *
 * Vercel ships each function with only the files its code visibly references. @nestjs/swagger finds this
 * directory in a way Vercel can't follow, so on its own /docs renders a blank page there. Resolving the
 * package here, with a path Vercel can follow, makes it ship the whole directory, and /docs serves from it.
 */
export const SWAGGER_UI_ASSETS_DIRECTORY = dirname(require.resolve('swagger-ui-dist/package.json'));

/** Static files requested by the Swagger UI page that @nestjs/swagger renders. */
export const SWAGGER_UI_ASSETS = [
    'swagger-ui.css',
    'swagger-ui-bundle.js',
    'swagger-ui-standalone-preset.js',
    'favicon-32x32.png',
    'favicon-16x16.png',
] as const;

/** Fallback CDN. Its swagger-ui-dist version must match the installed one (swagger.spec.ts enforces this). */
export const SWAGGER_UI_VERSION = '5.32.13';
export const SWAGGER_UI_CDN_ORIGIN = 'https://cdn.jsdelivr.net';
const SWAGGER_UI_CDN_BASE = `${SWAGGER_UI_CDN_ORIGIN}/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

/** Fallback for a deployment that still lacks Swagger UI's files: redirect requests for them to the CDN. */
export function shouldLoadSwaggerUiFromCdn(assetsOnDisk: boolean = swaggerUiAssetsOnDisk()): boolean {
    return !assetsOnDisk;
}

export function swaggerUiAssetsOnDisk(directory: string = SWAGGER_UI_ASSETS_DIRECTORY): boolean {
    return SWAGGER_UI_ASSETS.every((asset) => existsSync(join(directory, asset)));
}

function redirectSwaggerUiAssetsToCdn(app: INestApplication): void {
    const httpAdapter = app.getHttpAdapter();
    for (const asset of SWAGGER_UI_ASSETS) {
        httpAdapter.get(`/${DOCS_PATH}/${asset}`, (_request: Request, response: Response) =>
            response.redirect(302, `${SWAGGER_UI_CDN_BASE}/${asset}`),
        );
    }
}

/** Serves Swagger UI at /docs and the raw document at /docs-json. */
export function setupSwagger(app: INestApplication): void {
    // Registered first, so these routes answer before the static-file handler.
    if (shouldLoadSwaggerUiFromCdn()) {
        redirectSwaggerUiAssetsToCdn(app);
    }

    SwaggerModule.setup(DOCS_PATH, app, () => buildOpenApiDocument(app), {
        jsonDocumentUrl: `${DOCS_PATH}-json`,
        customSiteTitle: 'CronFlow API Docs',
        customSwaggerUiPath: SWAGGER_UI_ASSETS_DIRECTORY,
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            tagsSorter: 'alpha',
            docExpansion: 'list',
        },
    });
}
