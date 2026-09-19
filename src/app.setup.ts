import { BadRequestException, INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet, { HelmetOptions } from 'helmet';
import { API_PREFIX, REQUEST_ID_HEADER } from './app.constants';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { flattenValidationErrors } from './common/validation/validation-errors';
import { AppConfig } from './config/configuration';
import { setupSwagger, shouldLoadSwaggerUiFromCdn, SWAGGER_UI_CDN_ORIGIN } from './swagger/swagger';

/** Health probes keep a stable, unversioned path for load balancers and orchestrators. */
const UNPREFIXED_ROUTES = [
    { path: 'health/live', method: RequestMethod.GET },
    { path: 'health/ready', method: RequestMethod.GET },
];

export function applyGlobalPrefix(app: INestApplication): void {
    app.setGlobalPrefix(API_PREFIX, { exclude: UNPREFIXED_ROUTES });
}

/** Helmet's secure defaults, plus the Swagger UI CDN when the docs load their assets from it (see swagger.ts). */
export function helmetOptions(swaggerUiFromCdn: boolean): HelmetOptions {
    if (!swaggerUiFromCdn) {
        return {};
    }
    return {
        contentSecurityPolicy: {
            directives: {
                scriptSrc: ["'self'", SWAGGER_UI_CDN_ORIGIN],
                imgSrc: ["'self'", 'data:', SWAGGER_UI_CDN_ORIGIN],
            },
        },
    };
}

export function createValidationPipe(): ValidationPipe {
    return new ValidationPipe({
        // Strip unknown properties and reject requests that send them.
        whitelist: true,
        forbidNonWhitelisted: true,
        // Turn payloads into DTO instances so defaults and @Type conversions apply.
        transform: true,
        // Report every problem in one response, including nested ones.
        exceptionFactory: (errors) => new BadRequestException(flattenValidationErrors(errors)),
    });
}

/**
 * HTTP-level configuration shared by main.ts and the end-to-end tests,
 * so tests exercise exactly the middleware, validation and error handling used in production.
 */
export function configureApp(app: NestExpressApplication): void {
    const http = app.get<ConfigService<AppConfig, true>>(ConfigService).get('http', { infer: true });

    app.set('trust proxy', http.trustProxyHops);
    app.use(helmet(helmetOptions(http.swaggerEnabled && shouldLoadSwaggerUiFromCdn())));
    app.enableCors({ origin: http.corsOrigins, exposedHeaders: [REQUEST_ID_HEADER, 'Retry-After'] });
    applyGlobalPrefix(app);
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.enableShutdownHooks();

    if (http.swaggerEnabled) {
        setupSwagger(app);
    }
}
