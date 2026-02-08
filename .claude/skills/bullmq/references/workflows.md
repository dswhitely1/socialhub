# BullMQ Workflows Reference

## Contents
- Adding a New Job Type
- Registering Jobs in Fastify Lifecycle
- Emitting Real-Time Notifications from Workers
- Monitoring and Debugging Jobs
- Graceful Shutdown

---

## Adding a New Job Type

Copy this checklist and track progress:
- [ ] Step 1: Create `apps/api/src/jobs/{name}.job.ts` with queue + worker factories
- [ ] Step 2: Define Zod schema for job data in `packages/shared/src/schemas/`
- [ ] Step 3: Add error handling (`failed`, `error` events) on worker
- [ ] Step 4: Register queue + worker in the Fastify jobs plugin
- [ ] Step 5: Add `removeOnComplete`/`removeOnFail` to `defaultJobOptions`
- [ ] Step 6: Set appropriate `concurrency` on worker
- [ ] Step 7: Verify job runs locally with `pnpm dev`

### Step 1: Job file

```typescript
// apps/api/src/jobs/webhook-ingest.job.ts
import { Queue, Worker } from "bullmq";
import type { Job } from "bullmq";
import { getRedis } from "../lib/redis.js";

const QUEUE_NAME = "webhook-ingest";

export interface WebhookIngestData {
  platform: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export function createWebhookIngestQueue() {
  return new Queue<WebhookIngestData>(QUEUE_NAME, {
    connection: getRedis(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });
}

export function createWebhookIngestWorker() {
  const worker = new Worker<WebhookIngestData>(
    QUEUE_NAME,
    async (job: Job<WebhookIngestData>) => {
      const { platform, payload } = job.data;
      // normalize payload, write to DB, update search index
    },
    { connection: getRedis(), concurrency: 10 },
  );

  worker.on("failed", (job, err) => {
    console.error(`[${QUEUE_NAME}] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error(`[${QUEUE_NAME}] Worker error:`, err);
  });

  return worker;
}
```

### Step 2: Enqueue from a route or service

```typescript
// In a tRPC router or Fastify route handler
import { createWebhookIngestQueue } from "../jobs/webhook-ingest.job.js";

const webhookQueue = createWebhookIngestQueue();

await webhookQueue.add("ingest", {
  platform: "twitter",
  payload: req.body,
  receivedAt: new Date().toISOString(),
});
```

---

## Registering Jobs in Fastify Lifecycle

Jobs must start with the server and shut down cleanly. Use a Fastify plugin. See the **fastify** skill for plugin conventions.

```typescript
// apps/api/src/plugins/jobs.plugin.ts
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createFeedPollingQueue, createFeedPollingWorker } from "../jobs/feed-polling.job.js";
import { createTokenRefreshQueue, createTokenRefreshWorker } from "../jobs/token-refresh.job.js";

const jobsPlugin: FastifyPluginAsync = async (fastify) => {
  const feedQueue = createFeedPollingQueue();
  const feedWorker = createFeedPollingWorker();
  const tokenQueue = createTokenRefreshQueue();
  const tokenWorker = createTokenRefreshWorker();

  // Decorate Fastify so routes/services can enqueue jobs
  fastify.decorate("feedQueue", feedQueue);
  fastify.decorate("tokenQueue", tokenQueue);

  // Graceful shutdown — close workers before server exits
  fastify.addHook("onClose", async () => {
    await Promise.all([
      feedWorker.close(),
      tokenWorker.close(),
      feedQueue.close(),
      tokenQueue.close(),
    ]);
  });

  fastify.log.info("BullMQ workers started: feed-polling, token-refresh");
};

export default fp(jobsPlugin, { name: "jobs" });
```

Register in `apps/api/src/server.ts`:

```typescript
import jobsPlugin from "./plugins/jobs.plugin.js";
// ...
await fastify.register(jobsPlugin);
```

### WARNING: Starting workers without graceful shutdown

**The Problem:**

```typescript
// BAD - workers never stop, jobs get stuck as "active" on restart
createFeedPollingWorker();
// server exits without closing worker
```

**Why This Breaks:**
1. Active jobs are abandoned mid-execution and marked as "stalled"
2. Stalled jobs get retried, causing duplicate processing
3. Redis connections leak on every restart

**The Fix:**
Always close workers in Fastify's `onClose` hook (see plugin above).

---

## Emitting Real-Time Notifications from Workers

Workers can push events to connected clients via Socket.IO. See the **socket-io** skill for the notification service pattern.

```typescript
// apps/api/src/jobs/feed-polling.job.ts
import type { Server as SocketServer } from "socket.io";
import { sendNotification } from "../services/notification.service.js";

export function createFeedPollingWorker(io: SocketServer) {
  return new Worker<FeedPollData>(
    QUEUE_NAME,
    async (job) => {
      const { userId, platform } = job.data;
      const newPosts = await fetchPlatformFeed(platform, userId);

      if (newPosts.length > 0) {
        sendNotification(io, userId, {
          type: "new-posts",
          title: `${newPosts.length} new posts on ${platform}`,
          body: "",
        });
      }
    },
    { connection: getRedis(), concurrency: 5 },
  );
}
```

Pass the Socket.IO `Server` instance when creating the worker in the jobs plugin:

```typescript
const feedWorker = createFeedPollingWorker(fastify.io);
```

---

## Monitoring and Debugging Jobs

### QueueEvents for job lifecycle tracking

```typescript
import { QueueEvents } from "bullmq";
import { getRedis } from "../lib/redis.js";

const queueEvents = new QueueEvents("feed-polling", {
  connection: getRedis(),
});

queueEvents.on("completed", ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} completed with:`, returnvalue);
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed:`, failedReason);
});

// IMPORTANT: close in onClose hook
fastify.addHook("onClose", async () => {
  await queueEvents.close();
});
```

### Inspecting queues via code (useful for health checks)

```typescript
const queue = createFeedPollingQueue();
const counts = await queue.getJobCounts("active", "waiting", "delayed", "failed");
// { active: 2, waiting: 15, delayed: 0, failed: 3 }
```

### Debugging iterate-until-pass pattern

1. Check job is queued: `await queue.getJobCounts()`
2. Check Redis is reachable: `await getRedis().ping()`
3. Check worker is running: `worker.isRunning()`
4. If jobs are stuck as "active", check for missing `maxRetriesPerRequest: null`
5. If jobs complete but data is wrong, add Zod validation in processor
6. Only proceed to next step when current validation passes

---

## Graceful Shutdown

The shutdown sequence matters. Close workers first (stop accepting jobs, finish active ones), then close queues (flush pending commands), then close Redis last.

```typescript
// Correct shutdown order in Fastify onClose hook
fastify.addHook("onClose", async () => {
  // 1. Stop workers (waits for active jobs to finish)
  await Promise.all([feedWorker.close(), tokenWorker.close()]);

  // 2. Close queues
  await Promise.all([feedQueue.close(), tokenQueue.close()]);

  // 3. Close QueueEvents if used
  await queueEvents.close();

  // 4. Redis connection closes when Fastify shuts down (or manually)
});
```

### WARNING: Calling `worker.close()` with no timeout

`worker.close()` waits indefinitely for active jobs to finish. If a job hangs (e.g., network timeout to a platform API), your server never shuts down.

**The Fix:** Set timeouts on your external calls:

```typescript
async (job: Job<FeedPollData>) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    await fetchPlatformFeed(job.data.platform, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
```

Or use a process-level SIGTERM timeout as a safety net:

```typescript
// apps/api/src/server.ts
const SHUTDOWN_TIMEOUT = 30_000;

process.on("SIGTERM", async () => {
  const timer = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT);
  await fastify.close();
  clearTimeout(timer);
  process.exit(0);
});
```
