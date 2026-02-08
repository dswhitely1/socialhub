# Node.js Types Reference

## Contents
- Runtime Type Safety Strategy
- Environment Type Inference
- Singleton Return Types
- Node.js Built-in Types
- Type-Only Imports
- Anti-Patterns

## Runtime Type Safety Strategy

This project achieves end-to-end type safety by combining three layers. See the **typescript** skill for `tsconfig` details, the **zod** skill for schema patterns, and the **drizzle** skill for database types.

| Layer | Tool | Purpose |
|-------|------|---------|
| Runtime validation | Zod schemas | Validate external input (env vars, API requests) |
| Compile-time types | TypeScript strict mode | Catch bugs before runtime |
| Database types | Drizzle ORM | Infer types from schema definitions |

## Environment Type Inference

The `env` object is both validated at runtime and fully typed at compile time. Types are inferred from the Zod schema — never duplicated manually.

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
// Env = { NODE_ENV: "development" | "production" | "test"; API_PORT: number; ... }
```

**Key point:** `z.coerce.number()` produces a `number` type, not `string`. This means `env.API_PORT` is typed as `number` even though `process.env` values are always strings.

## Singleton Return Types

Use `ReturnType<typeof fn>` to derive types from factory functions instead of manually declaring interfaces. This keeps types in sync with implementation.

```typescript
// apps/api/src/lib/db.ts
import { createDb } from "@socialhub/db";

let db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!db) db = createDb(env.DATABASE_URL);
  return db;
}
```

```typescript
// packages/db/src/client.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

export function createDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
```

The `Database` type automatically includes all schema-aware query methods. If the schema changes, the type updates without manual intervention.

## Node.js Built-in Types

When using Node.js built-in modules, import from the `node:` protocol prefix. This makes it explicit that you're using a Node.js built-in, not an npm package.

```typescript
// GOOD — explicit node: prefix
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { Worker } from "node:worker_threads";

// BAD — ambiguous, could be confused with npm packages
import { readFile } from "fs/promises";
```

For `@types/node`: this project's `tsconfig.base.json` includes `"types": ["node"]` implicitly via `compilerOptions`. But packages that directly use `process`, `console`, or other Node globals **must** have `@types/node` in their own `devDependencies`:

```json
{
  "devDependencies": {
    "@types/node": "^20"
  }
}
```

## Type-Only Imports

Enforced by `@typescript-eslint/consistent-type-imports`. ALWAYS use `import type` when importing only types. See the **typescript** skill for full import conventions.

```typescript
// GOOD — type-only import
import type { FastifyInstance } from "fastify";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

// BAD — imports type as value (lint error)
import { FastifyInstance } from "fastify";
```

This matters for ESM — type-only imports are erased at compile time and don't trigger side effects or circular dependency issues.

## tRPC Context Type

The context type is inferred from the factory function using `Awaited<ReturnType<>>`. This keeps the context type automatically in sync with what `createContext` actually returns.

```typescript
// apps/api/src/trpc/context.ts
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

export async function createContext({ req }: CreateFastifyContextOptions) {
  const db = getDb();
  const token = req.headers.authorization?.replace("Bearer ", "");
  return { db, token, userId: null as string | null };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

See the **trpc** skill for middleware type refinement (e.g., `protectedProcedure` narrows `userId` to non-null).

## Anti-Patterns

### WARNING: Manual Type Duplication

**The Problem:**

```typescript
// BAD — manually duplicating what Zod/Drizzle already knows
interface Env {
  NODE_ENV: string;
  API_PORT: number;
  DATABASE_URL: string;
}
```

**Why This Breaks:**
1. Manual types drift from runtime validation — you change the schema, forget the interface
2. Defeats the purpose of Zod (`z.infer<>`) and Drizzle (`typeof table.$inferSelect`)
3. Double maintenance for zero benefit

**The Fix:**

```typescript
// GOOD — infer from the source of truth
export type Env = z.infer<typeof envSchema>;
export type User = typeof users.$inferSelect;
export type Database = ReturnType<typeof createDb>;
```

### WARNING: Using `any` for Node.js Callbacks

**The Problem:**

```typescript
// BAD — loses type information
socket.on("join", (data: any) => {
  socket.join(data.room);
});
```

**Why This Breaks:**
1. No compile-time protection against typos or missing fields
2. Runtime errors that TypeScript strict mode would have caught

**The Fix:**

```typescript
// GOOD — type the callback parameter
socket.on("join", (userId: string) => {
  socket.join(`user:${userId}`);
});
```

### WARNING: Non-Null Assertions on `process.env`

**The Problem:**

```typescript
// BAD — silences TypeScript but doesn't validate
const secret = process.env.AUTH_SECRET!;
```

**Why This Breaks:**
1. `!` asserts non-null at compile time but the value can still be `undefined` at runtime
2. Crashes happen far from the source — a missing env var causes a cryptic JWT error, not a clear "missing AUTH_SECRET" error

**The Fix:**

```typescript
// GOOD — validated at startup, crashes immediately with clear message
import { env } from "../env.js";
const secret = env.AUTH_SECRET; // guaranteed non-empty string
```
