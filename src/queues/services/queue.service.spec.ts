import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { TriggerType } from '@prisma/client';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { createConfigMock } from '../../../test/utils/mocks';
import { EXECUTE_WORKFLOW_JOB, REDIS_OPERATION_TIMEOUT_MS, WORKFLOW_QUEUE_NAME } from '../queue.constants';
import { QueueService } from './queue.service';

jest.mock('bullmq', () => ({ Queue: jest.fn() }));
jest.mock('ioredis', () => ({ Redis: jest.fn() }));

const QueueMock = Queue as unknown as jest.Mock;
const RedisMock = Redis as unknown as jest.Mock;

const JOB = { executionId: 'execution-1', workflowId: 'workflow-1', triggerType: TriggerType.MANUAL };

describe('QueueService', () => {
    let queue: { add: jest.Mock; close: jest.Mock; on: jest.Mock };
    let connection: { ping: jest.Mock; quit: jest.Mock; disconnect: jest.Mock };
    let service: QueueService;

    beforeEach(() => {
        queue = { add: jest.fn().mockResolvedValue({}), close: jest.fn().mockResolvedValue(undefined), on: jest.fn() };
        connection = {
            ping: jest.fn().mockResolvedValue('PONG'),
            quit: jest.fn().mockResolvedValue('OK'),
            disconnect: jest.fn(),
        };
        QueueMock.mockImplementation(() => queue);
        RedisMock.mockImplementation(() => connection);

        service = new QueueService(createConfigMock({ redis: { url: 'redis://cache:6379' } }));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('logs Redis connection errors instead of letting BullMQ print them to the console', () => {
        const logWarn = jest.spyOn(Logger.prototype, 'warn');
        const [event, onError] = queue.on.mock.calls[0] as [string, (error: Error) => void];

        onError(new Error('connect ECONNREFUSED 127.0.0.1:6379'));

        expect(event).toBe('error');
        expect(logWarn).toHaveBeenCalledWith('Redis connection error: connect ECONNREFUSED 127.0.0.1:6379');
    });

    it('uses a fail-fast Redis connection and runs each job exactly once', () => {
        expect(RedisMock).toHaveBeenCalledWith('redis://cache:6379', { enableOfflineQueue: false, maxRetriesPerRequest: 1 });
        expect(QueueMock).toHaveBeenCalledWith(
            WORKFLOW_QUEUE_NAME,
            expect.objectContaining({ connection, defaultJobOptions: expect.objectContaining({ attempts: 1 }) }),
        );
    });

    it('enqueues an execution with its id as the job id, making retries of the request idempotent', async () => {
        await service.enqueueExecution(JOB);

        expect(queue.add).toHaveBeenCalledWith(EXECUTE_WORKFLOW_JOB, JOB, { jobId: 'execution-1' });
    });

    it('translates Redis failures into 503 Service Unavailable', async () => {
        queue.add.mockRejectedValue(new Error('Stream isn\'t writeable and enableOfflineQueue options is false'));

        await expect(service.enqueueExecution(JOB)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('returns 503 instead of hanging when Redis does not answer in time', async () => {
        jest.useFakeTimers();
        queue.add.mockReturnValue(new Promise(() => undefined));

        const assertion = expect(service.enqueueExecution(JOB)).rejects.toBeInstanceOf(ServiceUnavailableException);
        await jest.advanceTimersByTimeAsync(REDIS_OPERATION_TIMEOUT_MS);

        await assertion;
    });

    it('pings Redis for the readiness probe', async () => {
        await service.ping();

        expect(connection.ping).toHaveBeenCalled();
    });

    it('closes the queue and then its connection on shutdown', async () => {
        await service.onModuleDestroy();

        expect(queue.close).toHaveBeenCalled();
        expect(queue.close.mock.invocationCallOrder[0]).toBeLessThan(connection.quit.mock.invocationCallOrder[0]);
    });

    it('force-disconnects when a graceful quit fails', async () => {
        connection.quit.mockRejectedValue(new Error('Connection is closed'));

        await service.onModuleDestroy();

        expect(connection.disconnect).toHaveBeenCalled();
    });
});
