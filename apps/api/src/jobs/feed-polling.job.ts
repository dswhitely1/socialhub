import { Queue, Worker } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import { getRedis } from "../lib/redis.js";

const QUEUE_NAME = "feed-polling";

const feedPollingJobSchema = z.object({
  userId: z.string(),
  platform: z.string(),
});

export function createFeedPollingQueue() {
  const connection = getRedis();
  return new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  });
}

export function createFeedPollingWorker(logger: FastifyBaseLogger) {
  const connection = getRedis();
  return new Worker(
    QUEUE_NAME,
    async (job) => {
      const { userId, platform } = feedPollingJobSchema.parse(job.data);
      logger.info({ jobId: job.id, userId, platform }, "Polling feed");
      // TODO: poll platform feeds for the given user/platform
    },
    { connection, concurrency: 5 },
  );
}
