import { Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { FIXED_DATE } from '../../../test/utils/factories';
import { createMock, flushPromises } from '../../../test/utils/mocks';
import { API_KEY_DISPLAY_PREFIX_LENGTH, API_KEY_MAX_LENGTH, hashApiKey } from '../api-key.util';
import { ApiKeysRepository, ApiKeyWithOwner } from '../repositories/api-keys.repository';
import { ApiKeysService, LAST_USED_WRITE_INTERVAL_MS } from './api-keys.service';

const RAW_KEY = 'cf_Q2hhbmdlTWUtVGhpcy1Jcy1Bbi1FeGFtcGxlLUtleQ';

function keyRecord(lastUsedAt: Date | null): ApiKeyWithOwner {
    return { id: 'key-1', lastUsedAt, user: { id: 'user-1', email: 'ada@example.com' } };
}

describe('ApiKeysService', () => {
    let service: ApiKeysService;
    let repository: jest.Mocked<ApiKeysRepository>;

    beforeEach(() => {
        repository = createMock<ApiKeysRepository>(['create', 'findAllForUser', 'findByHash', 'touchLastUsed', 'deleteForUser']);
        repository.touchLastUsed.mockResolvedValue();
        service = new ApiKeysService(repository);
    });

    describe('create', () => {
        it('returns the raw key once and persists only its SHA-256 hash and display prefix', async () => {
            repository.create.mockImplementation(async ({ name, keyPrefix }) => ({
                id: 'key-1',
                name,
                keyPrefix,
                lastUsedAt: null,
                createdAt: FIXED_DATE,
            }));

            const created = await service.create('user-1', { name: 'CI pipeline' });

            expect(created.key).toMatch(/^cf_[A-Za-z0-9_-]{43}$/);
            const [stored] = repository.create.mock.calls[0];
            expect(stored).toEqual({
                userId: 'user-1',
                name: 'CI pipeline',
                keyHash: createHash('sha256').update(created.key).digest('hex'),
                keyPrefix: created.key.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH),
            });
            expect(Object.values(stored)).not.toContain(created.key);
            expect(created).toMatchObject({ id: 'key-1', name: 'CI pipeline' });
        });
    });

    describe('list', () => {
        it('returns the masked keys of the user', async () => {
            const keys = [{ id: 'key-1', name: 'CI', keyPrefix: 'cf_abcdefgh', lastUsedAt: null, createdAt: FIXED_DATE }];
            repository.findAllForUser.mockResolvedValue(keys);

            await expect(service.list('user-1')).resolves.toBe(keys);
            expect(repository.findAllForUser).toHaveBeenCalledWith('user-1');
        });
    });

    describe('revoke', () => {
        it('deletes a key owned by the user', async () => {
            repository.deleteForUser.mockResolvedValue(true);

            await service.revoke('user-1', 'key-1');

            expect(repository.deleteForUser).toHaveBeenCalledWith('key-1', 'user-1');
        });

        it('throws 404 when no key matched', async () => {
            repository.deleteForUser.mockResolvedValue(false);

            await expect(service.revoke('user-1', 'key-1')).rejects.toThrow(new NotFoundException('API key key-1 not found'));
        });
    });

    describe('authenticate', () => {
        it.each([
            ['a key without the cf_ prefix', 'sk_live_123'],
            ['an implausibly long value', `cf_${'a'.repeat(API_KEY_MAX_LENGTH)}`],
        ])('rejects %s without querying the database', async (_label, rawKey) => {
            await expect(service.authenticate(rawKey)).resolves.toBeNull();
            expect(repository.findByHash).not.toHaveBeenCalled();
        });

        it('returns null for an unknown key', async () => {
            repository.findByHash.mockResolvedValue(null);

            await expect(service.authenticate(RAW_KEY)).resolves.toBeNull();
            expect(repository.findByHash).toHaveBeenCalledWith(hashApiKey(RAW_KEY));
        });

        it('resolves the key owner and records first use', async () => {
            repository.findByHash.mockResolvedValue(keyRecord(null));

            await expect(service.authenticate(RAW_KEY)).resolves.toEqual({
                id: 'user-1',
                email: 'ada@example.com',
                authMethod: 'api-key',
            });
            expect(repository.touchLastUsed).toHaveBeenCalledWith('key-1', expect.any(Date));
        });

        it('skips the usage write when the key was used within the last minute', async () => {
            repository.findByHash.mockResolvedValue(keyRecord(new Date(Date.now() - LAST_USED_WRITE_INTERVAL_MS / 2)));

            await service.authenticate(RAW_KEY);

            expect(repository.touchLastUsed).not.toHaveBeenCalled();
        });

        it('does not fail authentication when the usage write fails', async () => {
            const logWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
            repository.findByHash.mockResolvedValue(keyRecord(null));
            repository.touchLastUsed.mockRejectedValue(new Error('database busy'));

            await expect(service.authenticate(RAW_KEY)).resolves.toMatchObject({ id: 'user-1' });
            await flushPromises();

            expect(logWarn).toHaveBeenCalledWith(expect.stringContaining('database busy'));
        });
    });
});
