# Node.js Patterns Reference

## Contents
- Async Main Entry Point
- Lazy Singleton Pattern
- Environment Validation
- Fastify Plugin Registration
- BullMQ Worker Factory
- Anti-Patterns

## Async Main Entry Point

Every Node.js server in this project wraps startup in an async `main()` with a top-level `.catch()`. This ensures all async initialization errors (DB connections, plugin registration) are caught and the process exits cleanly.

```typescript
// apps/api/src/server.ts
async function main() {
  const fastify = Fastify({
    logger: { level: env.NODE_ENV === "production" ? "info" : "debug" },
  });

  await fastify.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await fastify.register(cookie);
  await fastify.register(trpcPlugin);
  await fastify.register(socketPlugin);

  fastify.get("/health", async () => ({ status: "ok" }));
  await fastify.listen({ port: env.API_PORT, host: "0.0.0.0" });
  fastify.log.info(`API server running on port ${env.API_PORT}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
```

**Why `host: "0.0.0.0"`:** Fastify defaults to `127.0.0.1`, which is invisible from Docker containers and other network interfaces. Always bind `0.0.0.0` for containerized services.

## Lazy Singleton Pattern

All external clients (database, Redis, Meilisearch) use lazy initialization. The client is created on first access and reused thereafter.

```typescript
// apps/api/src/lib/db.ts
import { createDb } from "@socialhub/db";
import { env } from "../env.js";

let db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!db) {
    db = createDb(env.DATABASE_URL);
  }
  return db;
}
```

```typescript
// apps/api/src/lib/redis.ts
import Redis from "ioredis";
import { env } from "../env.js";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
    });
  }
  return redis;
}
```

**Why lazy, not eager:** Singleton functions let tests mock or reset clients. Eager initialization at import time makes testing and hot-reload harder. See the **redis** skill for BullMQ-specific configuration.

## Environment Validation

NEVER access `process.env` directly in application code. All env vars go through Zod validation in `apps/api/src/env.ts`. See the **zod** skill for schema patterns.

```typescript
// GOOD — validated, typed, with defaults
import { env } from "../env.js";
const port = env.API_PORT; // number, guaranteed

// BAD — unvalidated, untyped, possibly undefined
const port = process.env.API_PORT; // string | undefined
```

**`z.coerce.number()`** converts the string `"4000"` from `process.env` to the number `4000`. Without coercion, Zod would reject it because `process.env` values are always strings.

## Fastify Plugin Registration

Plugins must be registered sequentially with `await`. Fastify's encapsulation model means plugins can decorate the instance and share state.

```typescript
// apps/api/src/plugins/socket.plugin.ts
import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";

export async function socketPlugin(fastify: FastifyInstance) {
  const io = new Server(fastify.server, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  fastify.decorate("io", io);
  fastify.addHook("onClose", () => { io.close(); });
}
```

See the **fastify** skill for plugin architecture details. See the **socket-io** skill for WebSocket patterns.

## BullMQ Worker Factory

Workers and queues are created via factory functions that share the singleton Redis connection. See the **bullmq** skill for job scheduling patterns.

```typescript
// apps/api/src/jobs/feed-polling.job.ts
import { Queue, Worker } from "bullmq";
import { getRedis } from "../lib/redis.js";

const QUEUE_NAME = "feed-polling";

export function createFeedPollingQueue() {
  return new Queue(QUEUE_NAME, { connection: getRedis() });
}

export function createFeedPollingWorker() {
  return new Worker(
    QUEUE_NAME,
    async (job) => {
      const { userId, platform } = job.data as { userId: string; platform: string };
      // polling logic
    },
    { connection: getRedis() },
  );
}
```

## Anti-Patterns

### WARNING: Direct `process.env` Access

**The Problem:**

```typescript
// BAD — raw process.env scattered across codebase
const dbUrl = process.env.DATABASE_URL;
const port = Number(process.env.API_PORT) || 4000;
```

**Why This Breaks:**
1. `process.env` values are `string | undefined` — no type safety
2. Missing vars silently become `undefined`, causing runtime crashes far from the source
3. No centralized validation means the app starts with bad config and fails later

**The Fix:**

```typescript
// GOOD — single validated env object
import { env } from "../env.js";
const dbUrl = env.DATABASE_URL; // string, guaranteed valid URL
const port = env.API_PORT;       // number, guaranteed
```

### WARNING: Blocking the Event Loop

**The Problem:**

```typescript
// BAD — synchronous file read blocks all concurrent requests
import { readFileSync } from "node:fs";
const config = JSON.parse(readFileSync("config.json", "utf-8"));
```

**Why This Breaks:**
1. Node.js is single-threaded — blocking I/O stops ALL request processing
2. Under load, a 50ms file read multiplied by concurrent requests causes cascading timeouts
3. BullMQ workers sharing the same process also stall

**The Fix:**

```typescript
// GOOD — async file read
import { readFile } from "node:fs/promises";
const config = JSON.parse(await readFile("config.json", "utf-8"));

// GOOD — for CPU-heavy work, use worker threads
import { Worker } from "node:worker_threads";
```

**When You Might Be Tempted:** Startup-time config loading. Use sync I/O ONLY at process startup (before the server starts accepting requests), never in request handlers or job processors.

### WARNING: Eager Client Initialization at Import Time

**The Problem:**

```typescript
// BAD — creates connection at import time
export const db = createDb(process.env.DATABASE_URL!);
```

**Why This Breaks:**
1. Import-time side effects make testing impossible without real infrastructure
2. Circular dependencies can trigger initialization before env is validated
3. Hot-reload in `tsx watch` recreates connections on every file change

**The Fix:**

```typescript
// GOOD — lazy initialization via getter function
let db: Database | null = null;
export function getDb() {
  if (!db) db = createDb(env.DATABASE_URL);
  return db;
}
```
