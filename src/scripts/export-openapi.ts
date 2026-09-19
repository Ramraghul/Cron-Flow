import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../app.module';
import { applyGlobalPrefix } from '../app.setup';
import { buildOpenApiDocument } from '../swagger/swagger';

const OUTPUT_PATH = resolve(__dirname, '../../docs/openapi.json');

/**
 * Writes the OpenAPI document to docs/openapi.json. Preview mode builds the module graph and route
 * metadata without instantiating providers, so no database, Redis or valid .env is required.
 */
async function exportOpenApi(): Promise<void> {
    const app = await NestFactory.create(AppModule, { preview: true, logger: ['error'] });
    applyGlobalPrefix(app);

    const document = buildOpenApiDocument(app);
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, `${JSON.stringify(document, null, 2)}\n`);

    console.log(`OpenAPI document written to ${OUTPUT_PATH} (${Object.keys(document.paths).length} paths)`);
}

exportOpenApi().catch((error: unknown) => {
    console.error('Failed to export the OpenAPI document:', error);
    process.exit(1);
});
