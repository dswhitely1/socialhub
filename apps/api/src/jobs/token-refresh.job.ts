import { Queue, Worker } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import { getRedis } from "../lib/redis.js";

const QUEUE_NAME = "token-refresh";

const tokenRefreshJobSchema = z.object({
  connectionId: z.string(),
});

export function createTokenRefreshQueue() {
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

export function createTokenRefreshWorker(logger: FastifyBaseLogger) {
  const connection = getRedis();
  return new Worker(
    QUEUE_NAME,
    async (job) => {
      const { connectionId } = tokenRefreshJobSchema.parse(job.data);
      logger.info({ jobId: job.id, connectionId }, "Refreshing token");
      // TODO: refresh platform tokens before they expire
    },
    { connection, concurrency: 3 },
  );
}
