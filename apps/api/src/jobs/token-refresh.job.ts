import { Queue, Worker } from "bullmq";
import { z } from "zod";
import { getRedis } from "../lib/redis.js";

const QUEUE_NAME = "token-refresh";

const tokenRefreshJobSchema = z.object({
  connectionId: z.string(),
});

export function createTokenRefreshQueue() {
  const connection = getRedis();
  return new Queue(QUEUE_NAME, { connection });
}

export function createTokenRefreshWorker() {
  const connection = getRedis();
  return new Worker(
    QUEUE_NAME,
    async (job) => {
      // TODO: refresh platform tokens before they expire
      const { connectionId } = tokenRefreshJobSchema.parse(job.data);
      console.log(`Refreshing token for connection ${connectionId}`);
    },
    { connection },
  );
}
