import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../src/config/configuration';

/** Creates a mock whose listed methods are `jest.fn()`, typed against the real class. */
export function createMock<T>(methodNames: ReadonlyArray<keyof T>): jest.Mocked<T> {
    const mock: Record<PropertyKey, jest.Mock> = {};
    for (const name of methodNames) {
        mock[name as PropertyKey] = jest.fn();
    }
    return mock as unknown as jest.Mocked<T>;
}

/** A ConfigService stand-in that returns the given config sections. */
export function createConfigMock(sections: Partial<AppConfig>): ConfigService<AppConfig, true> {
    return { get: (key: keyof AppConfig) => sections[key] } as unknown as ConfigService<AppConfig, true>;
}

/** Lets pending promise callbacks (e.g. fire-and-forget work) run before asserting. */
export function flushPromises(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
}
