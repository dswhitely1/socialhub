---
name: node
description: |
  Configures Node.js 20 runtime, ESM modules, environment validation, and server-side patterns for the SocialHub monorepo.
  Use when: configuring Node.js runtime behavior, managing ESM imports, setting up environment validation,
  creating singleton clients, writing async server entry points, or troubleshooting module resolution.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Node Skill

SocialHub runs Node.js 20 with pure ESM (`"type": "module"`) across the entire monorepo. The API server uses `tsx` for development and `tsc` for production builds. Internal packages are source-only — no build step, consumers compile `.ts` directly. All environment variables are Zod-validated at startup (fail-fast). External clients (DB, Redis, Meilisearch) use lazy singletons.

## Quick Start

### Async Main Entry Point

```typescript
// apps/api/src/server.ts
async function main() {
  const fastify = Fastify({
    logger: { level: env.NODE_ENV === "production" ? "info" : "debug" },
  });

  await fastify.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await fastify.register(trpcPlugin);
  await fastify.register(socketPlugin);

  fastify.get("/health", async () => ({ status: "ok" }));
  await fastify.listen({ port: env.API_PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
```

### Environment Validation (Fail-Fast)

```typescript
// apps/api/src/env.ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
```

### Lazy Singleton Client

```typescript
// apps/api/src/lib/redis.ts
import Redis from "ioredis";
import { env } from "../env.js";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return redis;
}
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| ESM imports | `.js` extension in API source | `import { env } from "./env.js"` |
| Source-only packages | No build step, raw `.ts` exports | `"exports": { ".": "./src/index.ts" }` |
| `tsx` dev runner | Hot-reload TypeScript execution | `tsx watch src/server.ts` |
| `z.coerce.number()` | Convert string env vars to numbers | `API_PORT: z.coerce.number().default(4000)` |
| Singleton clients | Lazy initialization, connection reuse | `getDb()`, `getRedis()`, `getMeiliSearch()` |
| `host: "0.0.0.0"` | Bind all interfaces for Docker | `fastify.listen({ host: "0.0.0.0" })` |

## Common Patterns

### Adding a New Singleton Client

**When:** Integrating a new external service (cache, queue, search, etc.)

```typescript
// apps/api/src/lib/my-client.ts
import { env } from "../env.js";  // Note: .js extension for ESM

let client: MyClient | null = null;

export function getMyClient(): MyClient {
  if (!client) {
    client = new MyClient(env.MY_SERVICE_URL);
  }
  return client;
}
```

### Adding Environment Variables

**When:** New service or config needs runtime configuration.

Copy this checklist and track progress:
- [ ] Add variable to `.env.example`
- [ ] Add Zod field in `apps/api/src/env.ts`
- [ ] Use via `env.MY_VAR` (never `process.env` directly)
- [ ] Update CLAUDE.md environment table

## See Also

- [patterns](references/patterns.md) — ESM, async, singleton, and startup patterns
- [types](references/types.md) — Runtime type safety with Zod, type-only imports
- [modules](references/modules.md) — ESM configuration, package exports, resolution
- [errors](references/errors.md) — Error handling, process signals, fail-fast

## Related Skills

- See the **typescript** skill for strict mode, `tsconfig`, and type system patterns
- See the **fastify** skill for server plugins, routes, and middleware
- See the **trpc** skill for tRPC router, context, and procedures
- See the **zod** skill for validation schemas and type inference
- See the **redis** skill for ioredis client and BullMQ queue configuration
- See the **drizzle** skill for database client and ORM patterns
- See the **bullmq** skill for background job workers and queues

## Documentation Resources

> Fetch latest Node.js 20 documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "nodejs"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/nodejs_latest-v20_x` _(Node.js 20.x API docs — matches this project's runtime)_

**Recommended Queries:**
- "ESM modules import export"
- "process signals graceful shutdown"
- "async hooks context propagation"
- "stream pipeline transform"
