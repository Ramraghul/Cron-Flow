import { Logger } from '@nestjs/common';

const LOG_METHODS = ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'] as const;

// Keep test output readable. Test.createTestingModule() installs a logger that prints errors,
// so logging is silenced at the method level before every test. Tests that assert on logging
// call jest.spyOn(Logger.prototype, ...) again, which returns these same spies.
beforeEach(() => {
    for (const method of LOG_METHODS) {
        jest.spyOn(Logger.prototype, method).mockImplementation(() => undefined);
    }
});
