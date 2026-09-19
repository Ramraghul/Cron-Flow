import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import helmet from 'helmet';
import fs from 'node:fs';
import swaggerUiDistPackage from 'swagger-ui-dist/package.json';
import request from 'supertest';
import { App } from 'supertest/types';
import { DEPLOYED_API_ORIGIN, LOCAL_API_ORIGIN } from '../app.constants';
import { helmetOptions } from '../app.setup';
import {
    apiServers,
    setupSwagger,
    shouldLoadSwaggerUiFromCdn,
    SWAGGER_UI_ASSETS,
    SWAGGER_UI_CDN_ORIGIN,
    SWAGGER_UI_VERSION,
    swaggerUiAssetsOnDisk,
} from './swagger';

const CDN_BASE = `${SWAGGER_UI_CDN_ORIGIN}/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

/** Boots a minimal app with the production Helmet + Swagger setup, optionally as if running on Vercel. */
async function createDocsApp(onVercel: boolean): Promise<INestApplication<App>> {
    if (onVercel) {
        process.env.VERCEL = '1';
    }
    const moduleRef = await Test.createTestingModule({}).compile();
    const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });
    app.use(helmet(helmetOptions(shouldLoadSwaggerUiFromCdn())));
    setupSwagger(app);
    await app.init();
    return app;
}

describe('Swagger UI assets', () => {
    let app: INestApplication<App> | undefined;

    afterEach(async () => {
        await app?.close();
        app = undefined;
        delete process.env.VERCEL;
        jest.restoreAllMocks();
    });

    it('pins the CDN to the swagger-ui-dist version installed with @nestjs/swagger', () => {
        expect(SWAGGER_UI_VERSION).toBe(swaggerUiDistPackage.version);
    });

    it.each([
        [true, false],
        [false, true],
    ])('falls back to the CDN only when the Swagger UI files are missing (files on disk: %s → CDN: %s)', (assetsOnDisk, expected) => {
        expect(shouldLoadSwaggerUiFromCdn(assetsOnDisk)).toBe(expected);
    });

    it('finds the installed Swagger UI files on disk', () => {
        expect(swaggerUiAssetsOnDisk()).toBe(true);
    });

    it.each([
        [{ VERCEL: '1' }, [DEPLOYED_API_ORIGIN, LOCAL_API_ORIGIN]],
        [{}, [LOCAL_API_ORIGIN, DEPLOYED_API_ORIGIN]],
    ])('offers local and deployed servers in "Try it out", current environment first (env %j)', (env, expectedOrder) => {
        expect(apiServers(env).map((server) => server.url)).toEqual(expectedOrder);
    });

    it('serves every Swagger UI file directly, on Vercel too, under the strict default script policy', async () => {
        app = await createDocsApp(true);

        for (const asset of SWAGGER_UI_ASSETS) {
            const response = await request(app.getHttpServer()).get(`/docs/${asset}`).expect(200);
            expect(Number(response.headers['content-length'])).toBeGreaterThan(0);
        }
        const page = await request(app.getHttpServer()).get('/docs').expect(200);
        expect(page.text).not.toContain(SWAGGER_UI_CDN_ORIGIN);
        expect(page.headers['content-security-policy']).toContain("script-src 'self';");

        const spec = await request(app.getHttpServer()).get('/docs-json').expect(200);
        expect((spec.body.servers as Array<{ url: string }>).map((server) => server.url)).toEqual([
            DEPLOYED_API_ORIGIN,
            LOCAL_API_ORIGIN,
        ]);
    });

    it('redirects to the CDN, and allows it in the Content-Security-Policy, when the Swagger UI files are missing', async () => {
        const realExistsSync = fs.existsSync;
        jest.spyOn(fs, 'existsSync').mockImplementation((path) =>
            String(path).includes('swagger-ui-dist') ? false : realExistsSync(path),
        );
        app = await createDocsApp(false);

        for (const asset of SWAGGER_UI_ASSETS) {
            const response = await request(app.getHttpServer()).get(`/docs/${asset}`).expect(302);
            expect(response.headers.location).toBe(`${CDN_BASE}/${asset}`);
        }
        const page = await request(app.getHttpServer()).get('/docs').expect(200);
        expect(page.headers['content-security-policy']).toContain(`script-src 'self' ${SWAGGER_UI_CDN_ORIGIN}`);
    });
});
