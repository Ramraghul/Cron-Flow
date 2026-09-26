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

/** Explains the public demo in the docs, so nobody wonders why a write came back 403. */
function demoDescription(demoEmail: string): string {
    return `

### Demo account
This server hosts a public read-only demo (\`${demoEmail}\`). These docs sign in to it automatically, so
**Try it out** works straight away for anything that reads. Creating, changing, running or deleting returns
\`403\` — register your own account with \`POST /${API_PREFIX}/auth/register\` for that.`;
}

export function buildOpenApiDocument(app: INestApplication, demoEmail?: string): OpenAPIObject {
    const builder = new DocumentBuilder()
        .setTitle('CronFlow API')
        .setDescription(API_DESCRIPTION + (demoEmail ? demoDescription(demoEmail) : ''))
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

/** Path of the script below, served by this app so the page's strict `script-src 'self'` policy allows it. */
const DEMO_AUTH_SCRIPT_PATH = `/${DOCS_PATH}/demo-auth.js`;

/**
 * Signs Swagger UI in to the demo account and says so on the page. Runs before `window.onload`, when
 * Swagger UI has yet to publish `window.ui`, so it retries until the page is ready (or gives up after 10s).
 */
const DEMO_AUTH_SCRIPT = `(function () {
    var BANNER_ID = 'cronflow-demo-banner';

    function authorize(token) {
        if (!window.ui || typeof window.ui.preauthorizeApiKey !== 'function') {
            return false;
        }
        window.ui.preauthorizeApiKey('${JWT_SECURITY_SCHEME}', token);
        return true;
    }

    function showBanner(email) {
        if (document.getElementById(BANNER_ID)) {
            return true;
        }
        var information = document.querySelector('.swagger-ui .information-container');
        if (!information) {
            return false;
        }
        var banner = document.createElement('div');
        banner.id = BANNER_ID;
        banner.style.cssText = 'max-width:1460px;margin:16px auto 0;padding:12px 16px;border:1px solid #4990e2;' +
            'border-radius:6px;background:#eaf3fc;color:#3b4151;font-family:sans-serif;font-size:13px;line-height:1.5';
        banner.textContent = 'Signed in as the read-only demo account (' + email + '). Try it out works for every ' +
            'read; creating, changing, running and deleting return 403.';
        information.parentNode.insertBefore(banner, information);
        return true;
    }

    fetch('/${API_PREFIX}/auth/demo', { method: 'POST' })
        .then(function (response) { return response.ok ? response.json() : null; })
        .then(function (demo) {
            if (!demo) {
                return;
            }
            var authorized = false;
            var explained = false;
            var attempts = 0;
            var timer = setInterval(function () {
                authorized = authorized || authorize(demo.accessToken);
                explained = explained || showBanner(demo.user.email);
                if ((authorized && explained) || ++attempts > 100) {
                    clearInterval(timer);
                }
            }, 100);
        })
        .catch(function () { /* No demo on this server: the docs stay as they are. */ });
})();
`;

function serveDemoAuthScript(app: INestApplication): void {
    app.getHttpAdapter().get(DEMO_AUTH_SCRIPT_PATH, (_request: Request, response: Response) =>
        response.type('application/javascript').send(DEMO_AUTH_SCRIPT),
    );
}

function redirectSwaggerUiAssetsToCdn(app: INestApplication): void {
    const httpAdapter = app.getHttpAdapter();
    for (const asset of SWAGGER_UI_ASSETS) {
        httpAdapter.get(`/${DOCS_PATH}/${asset}`, (_request: Request, response: Response) =>
            response.redirect(302, `${SWAGGER_UI_CDN_BASE}/${asset}`),
        );
    }
}

/**
 * Serves Swagger UI at /docs and the raw document at /docs-json.
 *
 * @param demoEmail the server's read-only demo account, if it has one: the docs then sign in to it.
 */
export function setupSwagger(app: INestApplication, { demoEmail }: { demoEmail?: string } = {}): void {
    // Registered first, so these routes answer before the static-file handler.
    if (shouldLoadSwaggerUiFromCdn()) {
        redirectSwaggerUiAssetsToCdn(app);
    }
    if (demoEmail) {
        serveDemoAuthScript(app);
    }

    SwaggerModule.setup(DOCS_PATH, app, () => buildOpenApiDocument(app, demoEmail), {
        jsonDocumentUrl: `${DOCS_PATH}-json`,
        customSiteTitle: 'CronFlow API Docs',
        customSwaggerUiPath: SWAGGER_UI_ASSETS_DIRECTORY,
        customJs: demoEmail ? DEMO_AUTH_SCRIPT_PATH : undefined,
        swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            tagsSorter: 'alpha',
            docExpansion: 'list',
        },
    });
}
