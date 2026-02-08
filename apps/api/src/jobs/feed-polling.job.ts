import { Queue, Worker } from "bullmq";
import { z } from "zod";
import { getRedis } from "../lib/redis.js";

const QUEUE_NAME = "feed-polling";

const feedPollingJobSchema = z.object({
  userId: z.string(),
  platform: z.string(),
});

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
      const { userId, platform } = feedPollingJobSchema.parse(job.data);
      console.log(`Polling feed for user ${userId} on ${platform}`);
    },
    { connection },
  );
}
