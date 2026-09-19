import { execSync } from 'node:child_process';
import { E2E_DATABASE_URL } from './env';

/** Applies all migrations to the end-to-end database once, before any test file runs. */
export default function globalSetup(): void {
    execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    });
}
