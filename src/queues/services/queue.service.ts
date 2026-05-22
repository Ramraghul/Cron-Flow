import { Injectable } from '@nestjs/common';

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class QueueService {
    private workflowQueue: Queue;

    constructor() {
        const connection = new IORedis(
            process.env.REDIS_URL!,
            {
                maxRetriesPerRequest: null,
            },
        );

        this.workflowQueue = new Queue(
            'workflow-queue',
            {
                connection,
            },
        );
    }

    async addWorkflowJob(data: any) {
        await this.workflowQueue.add(
            'execute-workflow',
            data,
            {
                attempts: 3,

                backoff: {
                    type: 'exponential',
                    delay: 3000,
                },
            },
        );
    }
}