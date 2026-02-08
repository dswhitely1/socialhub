# BullMQ Patterns Reference

## Contents
- Queue and Worker Structure
- Type-Safe Job Data
- Error Handling and Retries
- Rate Limiting for Platform APIs
- Concurrency Control
- Repeatable Jobs and Schedulers
- Anti-Patterns

---

## Queue and Worker Structure

Every job in SocialHub follows the factory pattern — export `createXQueue()` and `createXWorker()` from a single `{name}.job.ts` file. Queue names are `SCREAMING_SNAKE_CASE` constants.

```typescript
// apps/api/src/jobs/token-refresh.job.ts
import { Queue, Worker } from "bullmq";
import type { Job } from "bullmq";
import { getRedis } from "../lib/redis.js";

const QUEUE_NAME = "token-refresh";

interface TokenRefreshData {
  connectionId: string;
  platform: string;
}

export function createTokenRefreshQueue() {
  return new Queue<TokenRefreshData>(QUEUE_NAME, {
    connection: getRedis(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });
}

export function createTokenRefreshWorker() {
  return new Worker<TokenRefreshData>(
    QUEUE_NAME,
    async (job) => {
      const { connectionId, platform } = job.data;
      // call platform adapter refreshToken()
    },
    { connection: getRedis(), concurrency: 3 },
  );
}
```

**Key details:**
- `defaultJobOptions` on the Queue sets retry/cleanup for all jobs added to it
- `removeOnComplete` / `removeOnFail` with `{ count }` prevents Redis memory bloat
- Pass the data interface as a generic: `Queue<TokenRefreshData>`, `Worker<TokenRefreshData>`

---

## Type-Safe Job Data

NEVER use `as` type assertions on `job.data`. Use Zod schemas from `@socialhub/shared` and pass generics to Queue/Worker. See the **zod** skill for schema conventions.

```typescript
// BAD - unsafe cast, no runtime validation
async (job) => {
  const { userId } = job.data as { userId: string };
}

// GOOD - generic type + runtime validation in processor
import { z } from "zod";

const feedPollDataSchema = z.object({
  userId: z.string().uuid(),
  platform: z.enum(["twitter", "instagram", "linkedin", "bluesky", "mastodon"]),
});
type FeedPollData = z.infer<typeof feedPollDataSchema>;

export function createFeedPollingWorker() {
  return new Worker<FeedPollData>(
    QUEUE_NAME,
    async (job) => {
      const data = feedPollDataSchema.parse(job.data); // throws on bad data
      // data is fully typed
    },
    { connection: getRedis() },
  );
}
```

---

## Error Handling and Retries

### Worker-level error events

```typescript
const worker = createFeedPollingWorker();

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed on attempt ${job?.attemptsMade}:`, err.message);
  // future: send to Sentry, update platform_connections health status
});

worker.on("error", (err) => {
  // connection errors, unhandled worker exceptions
  console.error("Worker error:", err);
});
```

### Job-level retry with backoff

```typescript
await queue.add("fetch-feed", { userId, platform }, {
  attempts: 5,
  backoff: { type: "exponential", delay: 2000 },
  // delays: 2s, 4s, 8s, 16s, 32s
});
```

### Custom backoff for API rate limits

```typescript
const worker = new Worker<FeedPollData>(QUEUE_NAME, processor, {
  connection: getRedis(),
  settings: {
    backoffStrategy: (attemptsMade: number) => {
      // respect platform rate limit windows (typically 15min for Twitter)
      return Math.min(attemptsMade * 15_000, 900_000);
    },
  },
});
```

---

## Rate Limiting for Platform APIs

Social APIs enforce strict rate limits. Use BullMQ's built-in rate limiter on the Queue to throttle job processing per platform.

```typescript
// Per-queue rate limiting (all jobs in this queue share the limit)
export function createFeedPollingQueue() {
  return new Queue<FeedPollData>(QUEUE_NAME, {
    connection: getRedis(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  });
}

// For per-platform rate limiting, use separate queues per platform
// or use job names + manual rate tracking in Redis.
// See the **redis** skill for rate limit counter patterns.
```

### WARNING: Unbounded concurrency with external APIs

**The Problem:**

```typescript
// BAD - 50 concurrent workers hammering Twitter API
new Worker(QUEUE_NAME, processor, { connection, concurrency: 50 });
```

**Why This Breaks:**
1. Hits API rate limits instantly, gets 429 responses
2. Wasted retries burn through `attempts` budget
3. Platform may temporarily block your app's OAuth client

**The Fix:**

```typescript
// GOOD - conservative concurrency per platform queue
new Worker(QUEUE_NAME, processor, { connection, concurrency: 3 });
```

---

## Concurrency Control

| Job Type | Recommended Concurrency | Reason |
|----------|------------------------|--------|
| Feed polling | 3-5 | External API rate limits |
| Token refresh | 2-3 | Low volume, but time-sensitive |
| Webhook ingest | 10-20 | Internal processing, no external calls |
| Search indexing | 5-10 | Meilisearch handles batching |

```typescript
new Worker(QUEUE_NAME, processor, {
  connection: getRedis(),
  concurrency: 5,
  limiter: { max: 100, duration: 60_000 }, // max 100 jobs per minute
});
```

---

## Repeatable Jobs and Schedulers

Use `upsertJobScheduler` (BullMQ v5) for recurring jobs. NEVER use the deprecated `repeat` option on `queue.add()`.

```typescript
const queue = createFeedPollingQueue();

// Poll every 60 seconds
await queue.upsertJobScheduler(
  "poll-twitter-user123", // unique scheduler ID
  { every: 60_000 },
  {
    name: "feed-poll",
    data: { userId: "user123", platform: "twitter" },
  },
);

// Cron: refresh tokens daily at 3 AM
const tokenQueue = createTokenRefreshQueue();
await tokenQueue.upsertJobScheduler(
  "refresh-all-tokens",
  { pattern: "0 3 * * *" },
  { name: "token-refresh-all", data: {} },
);
```

To remove a scheduler: `await queue.removeJobScheduler("poll-twitter-user123");`

---

## Anti-Patterns

### WARNING: Missing `maxRetriesPerRequest: null` on Redis connection

**The Problem:**

```typescript
// BAD - default ioredis config
const redis = new Redis(env.REDIS_URL);
```

**Why This Breaks:**
BullMQ uses blocking Redis commands (`BRPOPLPUSH`). Default ioredis retries per request (20) cause `ReplyError: Reached max retries per request` under load.

**The Fix:**

```typescript
// GOOD - already configured in apps/api/src/lib/redis.ts
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
```

### WARNING: Creating new Redis connections per queue/worker

**The Problem:**

```typescript
// BAD - new connection for every queue instance
export function createQueue() {
  return new Queue(NAME, { connection: new Redis(env.REDIS_URL) });
}
```

**Why This Breaks:**
1. Each Queue + Worker + QueueEvents creates 1-3 Redis connections
2. With 5 job types you'd have 15+ connections instead of 1
3. Hits Redis `maxclients` limit in production

**The Fix:**

```typescript
// GOOD - shared singleton from getRedis()
import { getRedis } from "../lib/redis.js";
export function createQueue() {
  return new Queue(NAME, { connection: getRedis() });
}
```

### WARNING: No `removeOnComplete` / `removeOnFail`

**The Problem:**

```typescript
// BAD - jobs accumulate forever in Redis
new Queue(NAME, { connection });
```

**Why This Breaks:**
Completed/failed jobs remain in Redis indefinitely, consuming memory. A queue processing 1 job/second accumulates 86K entries/day.

**The Fix:**

```typescript
// GOOD - automatic cleanup
new Queue(NAME, {
  connection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000 },  // keep last 1000
    removeOnFail: { count: 5000 },      // keep last 5000 for debugging
  },
});
```
