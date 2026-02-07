import { Queue, Worker } from "bullmq";
import { getRedis } from "../lib/redis.js";

const QUEUE_NAME = "feed-polling";

export function createFeedPollingQueue() {
  const connection = getRedis();
  return new Queue(QUEUE_NAME, { connection });
}

export function createFeedPollingWorker() {
  const connection = getRedis();
  return new Worker(
    QUEUE_NAME,
    async (job) => {
      // TODO: poll platform feeds for the given user/platform
      const { userId, platform } = job.data as { userId: string; platform: string };
      console.log(`Polling feed for user ${userId} on ${platform}`);
    },
    { connection },
  );
}
