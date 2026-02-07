import { Queue, Worker } from "bullmq";
import { getRedis } from "../lib/redis.js";

const QUEUE_NAME = "token-refresh";

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
      const { connectionId } = job.data as { connectionId: string };
      console.log(`Refreshing token for connection ${connectionId}`);
    },
    { connection },
  );
}
