import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';

/** Request methods that only read. Everything else counts as a write for a demo account. */
const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const DEMO_READ_ONLY_MESSAGE =
    'This is the read-only demo account. Register your own account to create, run or change workflows.';

/**
 * Accounts listed in `DEMO_READ_ONLY_EMAILS` are public demos: anyone may sign in and look around,
 * but nothing they do can change the data — including runs triggered through a demo workflow's webhook.
 */
@Injectable()
export class DemoAccountsService {
    private readonly readOnlyEmails: ReadonlySet<string>;

    constructor(config: ConfigService<AppConfig, true>) {
        this.readOnlyEmails = new Set(config.get('demo', { infer: true }).readOnlyEmails);
    }

    /** The account the dashboard signs into when no one is logged in, or undefined when demos are off. */
    get demoEmail(): string | undefined {
        return [...this.readOnlyEmails][0];
    }

    isReadOnly(email: string): boolean {
        return this.readOnlyEmails.has(email.toLowerCase());
    }

    /** Throws 403 when a demo account attempts anything other than a read. */
    assertMayWrite(email: string, method: string): void {
        if (!READ_METHODS.has(method.toUpperCase()) && this.isReadOnly(email)) {
            throw new ForbiddenException(DEMO_READ_ONLY_MESSAGE);
        }
    }
}
