import { TriggerType } from '@prisma/client';
import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createConfigMock, createMock } from '../../test/utils/mocks';
import { ExecutionsRepository } from '../executions/repositories/executions.repository';
import { WorkflowJobData } from '../queues/interfaces/workflow-job.interface';
import { WORKFLOW_QUEUE_NAME } from '../queues/queue.constants';
import { RunOutcome, WorkflowRunnerService } from './services/workflow-runner.service';
import { WorkflowProcessor } from './workflow.processor';

jest.mock('bullmq', () => ({ Worker: jest.fn() }));
jest.mock('ioredis', () => ({ Redis: jest.fn() }));

const WorkerMock = Worker as unknown as jest.Mock;
const RedisMock = Redis as unknown as jest.Mock;

function buildJob(data: WorkflowJobData): Job<WorkflowJobData> {
    return { id: 'job-1', data } as unknown as Job<WorkflowJobData>;
}

describe('WorkflowProcessor', () => {
    let worker: { on: jest.Mock; close: jest.Mock };
    let connection: { on: jest.Mock; quit: jest.Mock; disconnect: jest.Mock };
    let runner: jest.Mocked<WorkflowRunnerService>;
    let repository: jest.Mocked<ExecutionsRepository>;

    function createProcessor(enabled: boolean): WorkflowProcessor {
        return new WorkflowProcessor(
            runner,
            repository,
            createConfigMock({ worker: { enabled, concurrency: 3 }, redis: { url: 'redis://cache:6379' } }),
        );
    }

    beforeEach(() => {
        worker = { on: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };
        connection = { on: jest.fn(), quit: jest.fn().mockResolvedValue('OK'), disconnect: jest.fn() };
        WorkerMock.mockImplementation(() => worker);
        RedisMock.mockImplementation(() => connection);
        runner = createMock<WorkflowRunnerService>(['run']);
        repository = createMock<ExecutionsRepository>(['failInterrupted']);
    });

    it('does not connect to Redis when the worker is disabled in this process', async () => {
        const processor = createProcessor(false);

        processor.onModuleInit();

        expect(RedisMock).not.toHaveBeenCalled();
        expect(WorkerMock).not.toHaveBeenCalled();
        await expect(processor.onModuleDestroy()).resolves.toBeUndefined();
    });

    it('starts a worker with a blocking-safe connection and the configured concurrency', () => {
        createProcessor(true).onModuleInit();

        expect(RedisMock).toHaveBeenCalledWith('redis://cache:6379', { maxRetriesPerRequest: null });
        expect(WorkerMock).toHaveBeenCalledWith(WORKFLOW_QUEUE_NAME, expect.any(Function), { connection, concurrency: 3 });
    });

    it('hands each job to the runner', async () => {
        const outcome: RunOutcome = { status: 'SUCCESS', executionId: 'execution-1' };
        runner.run.mockResolvedValue(outcome);
        createProcessor(true).onModuleInit();
        const [, handler] = WorkerMock.mock.calls[0] as [string, (job: Job<WorkflowJobData>) => Promise<RunOutcome>];
        const job = buildJob({ executionId: 'execution-1', workflowId: 'workflow-1', triggerType: TriggerType.MANUAL });

        await expect(handler(job)).resolves.toBe(outcome);
        expect(runner.run).toHaveBeenCalledWith(job.data);
    });

    it('marks the execution FAILED and rethrows when the run hits an infrastructure error', async () => {
        runner.run.mockRejectedValue(new Error('database unreachable'));
        repository.failInterrupted.mockResolvedValue();
        const job = buildJob({ executionId: 'execution-1', workflowId: 'workflow-1', triggerType: TriggerType.WEBHOOK });

        await expect(createProcessor(true).process(job)).rejects.toThrow('database unreachable');
        expect(repository.failInterrupted).toHaveBeenCalledWith('execution-1', 'Internal error: database unreachable');
    });

    it('rethrows cron job failures, which have no execution row to update', async () => {
        runner.run.mockRejectedValue(new Error('database unreachable'));

        await expect(
            createProcessor(true).process(buildJob({ workflowId: 'workflow-1', triggerType: TriggerType.CRON })),
        ).rejects.toThrow('database unreachable');
        expect(repository.failInterrupted).not.toHaveBeenCalled();
    });

    it('drains in-flight jobs before closing the Redis connection on shutdown', async () => {
        const processor = createProcessor(true);
        processor.onModuleInit();

        await processor.onModuleDestroy();

        expect(worker.close).toHaveBeenCalled();
        expect(worker.close.mock.invocationCallOrder[0]).toBeLessThan(connection.quit.mock.invocationCallOrder[0]);
    });
});
