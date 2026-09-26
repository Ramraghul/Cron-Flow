import { ForbiddenException } from '@nestjs/common';
import { createConfigMock } from '../../../test/utils/mocks';
import { DEMO_READ_ONLY_MESSAGE, DemoAccountsService } from './demo-accounts.service';

function service(readOnlyEmails: string[]): DemoAccountsService {
    return new DemoAccountsService(createConfigMock({ demo: { readOnlyEmails } }));
}

describe('DemoAccountsService', () => {
    it('matches configured accounts regardless of case', () => {
        const demoAccounts = service(['demo@example.com']);

        expect(demoAccounts.isReadOnly('Demo@Example.com')).toBe(true);
        expect(demoAccounts.isReadOnly('ada@example.com')).toBe(false);
    });

    it('offers the first configured account as the one the dashboard signs into', () => {
        expect(service(['demo@example.com', 'second@example.com']).demoEmail).toBe('demo@example.com');
        expect(service([]).demoEmail).toBeUndefined();
    });

    it.each([['GET'], ['HEAD'], ['OPTIONS'], ['get']])('lets a demo account read with %s', (method) => {
        expect(() => service(['demo@example.com']).assertMayWrite('demo@example.com', method)).not.toThrow();
    });

    it.each([['POST'], ['PATCH'], ['PUT'], ['DELETE']])('refuses a demo account writing with %s', (method) => {
        expect(() => service(['demo@example.com']).assertMayWrite('demo@example.com', method)).toThrow(
            new ForbiddenException(DEMO_READ_ONLY_MESSAGE),
        );
    });

    it('leaves every other account alone', () => {
        expect(() => service(['demo@example.com']).assertMayWrite('ada@example.com', 'DELETE')).not.toThrow();
    });

    it('does nothing at all when no demo account is configured', () => {
        expect(() => service([]).assertMayWrite('ada@example.com', 'POST')).not.toThrow();
    });
});
