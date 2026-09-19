import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/database/prisma.service';
import { QueueService } from '../../src/queues/services/queue.service';

export interface E2eContext {
    app: NestExpressApplication;
    prisma: PrismaService;
    queueService: QueueService;
}

const TRUNCATE_ALL_TABLES = 'TRUNCATE TABLE "ExecutionStep", "Execution", "WorkflowStep", "Workflow", "ApiKey", "User" CASCADE';

/** Boots the real AppModule (PostgreSQL, Redis, in-process worker) with the production HTTP configuration. */
export async function createE2eApp(): Promise<E2eContext> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app);
    await app.init();

    return { app, prisma: app.get(PrismaService), queueService: app.get(QueueService) };
}

/** Empties every table and the job queue, so each run starts from a clean slate. */
export async function resetState({ prisma, queueService }: E2eContext): Promise<void> {
    await prisma.$executeRawUnsafe(TRUNCATE_ALL_TABLES);
    await queueService.queue.obliterate({ force: true });
}
