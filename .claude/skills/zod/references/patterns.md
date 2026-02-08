# Zod Schema Patterns

## Contents
- Schema Architecture
- Base Schema + Derivation Pattern
- Enum from Constants
- Cursor Pagination Schema
- JSONB Validation with z.record
- Environment Validation
- Anti-Patterns

---

## Schema Architecture

All Zod schemas live in `packages/shared/src/schemas/` and follow this convention:

| File | Exports | Consumed By |
|------|---------|-------------|
| `user.schema.ts` | `userSchema`, `createUserSchema`, `updateUserSchema` | tRPC routers, type inference |
| `post.schema.ts` | `postSchema`, `createPostSchema`, `feedQuerySchema` | tRPC routers, type inference |
| `platform.schema.ts` | `platformConnectionSchema`, `connectPlatformSchema`, `notificationSchema`, `notificationQuerySchema` | tRPC routers, type inference |
| `index.ts` | Re-exports all schemas | `@socialhub/shared` package entry |

Types are inferred in `packages/shared/src/types/index.ts` — NEVER hand-write types that duplicate a schema.

---

## Base Schema + Derivation Pattern

Define one canonical schema per domain entity. Derive create/update variants using `.pick()` and `.partial()`.

```typescript
// packages/shared/src/schemas/user.schema.ts
export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  image: z.string().url().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Create: pick only client-provided fields
export const createUserSchema = userSchema.pick({
  name: true,
  email: true,
  image: true,
});

// Update: same fields but all optional
export const updateUserSchema = userSchema.pick({
  name: true,
  image: true,
}).partial();
```

**Why derivation over separate schemas:** A single source of truth means renaming a field or changing a constraint propagates automatically. Separate schemas drift over time.

---

## Enum from Constants

Platform enums use an `as const` tuple defined in constants, then passed to `z.enum()`.

```typescript
// packages/shared/src/constants/platforms.ts
export const PLATFORMS = [
  "twitter",
  "instagram",
  "linkedin",
  "bluesky",
  "mastodon",
] as const;

export type Platform = (typeof PLATFORMS)[number];
```

```typescript
// packages/shared/src/schemas/platform.schema.ts
import { PLATFORMS } from "../constants/platforms.js";

export const connectPlatformSchema = z.object({
  platform: z.enum(PLATFORMS),  // Type-safe: only accepts known platforms
  code: z.string(),
  redirectUri: z.string().url(),
});
```

### WARNING: Inline String Arrays in z.enum

**The Problem:**

```typescript
// BAD - duplicated literal values, no single source of truth
platform: z.enum(["twitter", "instagram", "linkedin", "bluesky", "mastodon"])
```

**Why This Breaks:**
1. Adding a new platform requires finding every `z.enum()` call
2. Typos in string literals silently create invalid enum values
3. The `Platform` type and the enum fall out of sync

**The Fix:**

```typescript
// GOOD - single constant drives both the type and validation
import { PLATFORMS } from "../constants/platforms.js";
platform: z.enum(PLATFORMS)
```

---

## Cursor Pagination Schema

Every list endpoint uses the same pagination structure with cursor-based pagination.

```typescript
// packages/shared/src/schemas/post.schema.ts
export const feedQuerySchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
```

Key decisions:
- `cursor` is `.optional()` (undefined on first page)
- `limit` has `.default(20)` so callers don't need to specify it
- `.int().min(1).max(100)` prevents zero, negative, or absurdly large page sizes
- See the **trpc** skill for how routers return `{ items: [], nextCursor: string | null }`

---

## JSONB Validation with z.record

Platform-specific raw API responses are stored as JSONB. Use `z.record(z.unknown())` for unstructured data.

```typescript
// packages/shared/src/schemas/post.schema.ts
export const postSchema = z.object({
  // ... structured fields
  rawData: z.record(z.unknown()),  // Flexible JSONB column
});
```

When you need to validate specific JSONB shapes from a platform adapter, create a separate schema:

```typescript
// apps/api/src/services/adapters/twitter.adapter.ts
const twitterRawPostSchema = z.object({
  tweet_id: z.string(),
  metrics: z.object({
    like_count: z.number(),
    retweet_count: z.number(),
  }),
});
```

See the **postgresql** skill for JSONB column design patterns.

---

## Environment Validation

`apps/api/src/env.ts` validates all environment variables at startup using `.parse()`.

```typescript
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  MEILI_URL: z.string().url(),
  MEILI_MASTER_KEY: z.string(),
  AUTH_SECRET: z.string().min(1),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
```

Key patterns:
- `z.coerce.number()` — `process.env` values are always strings; coerce converts `"4000"` to `4000`
- `.parse()` throws `ZodError` if validation fails — the server won't start with bad config
- `.default()` on optional env vars means the app works without them in dev

---

## Anti-Patterns

### WARNING: Hand-Written Types Alongside Schemas

**The Problem:**

```typescript
// BAD - type and schema can drift apart
export const userSchema = z.object({ name: z.string(), email: z.string().email() });
export interface User { name: string; email: string; avatar?: string; }
```

**Why This Breaks:**
1. Adding a field to the schema but forgetting the interface creates silent mismatches
2. Runtime validation passes objects that TypeScript thinks are invalid (or vice versa)
3. Two sources of truth guarantee eventual inconsistency

**The Fix:**

```typescript
// GOOD - single source of truth
export const userSchema = z.object({ name: z.string(), email: z.string().email() });
export type User = z.infer<typeof userSchema>;
```

### WARNING: `.safeParse()` When You Want Hard Failure

**The Problem:**

```typescript
// BAD in env.ts - silently continues with invalid config
const result = envSchema.safeParse(process.env);
if (!result.success) console.warn("Invalid env");
```

**Why This Breaks:**
1. The server starts with missing DATABASE_URL and crashes later with an opaque error
2. `.safeParse()` is for user input where you want to show validation errors — not for startup config

**The Fix:**

```typescript
// GOOD - fail fast with clear error message
export const env = envSchema.parse(process.env);
```

**When `.safeParse()` IS correct:** Form validation, API error responses, anywhere you need to return structured errors to a user.

### WARNING: Duplicating Schemas Across Packages

Schemas belong in `packages/shared/src/schemas/`. NEVER create separate Zod schemas in `apps/web/` or `apps/mobile/`. The tRPC type system provides end-to-end inference — clients don't need their own validation.
