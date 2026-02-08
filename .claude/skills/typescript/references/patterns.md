# TypeScript Patterns Reference

## Contents
- Zod-First Type Derivation
- Const Assertions and Union Extraction
- Singleton with ReturnType Inference
- Platform Adapter Interface
- Environment Validation at Startup
- WARNING: Anti-Patterns

---

## Zod-First Type Derivation

All TypeScript types that mirror a Zod schema MUST be derived with `z.infer<>`, never hand-written.

```typescript
// packages/shared/src/schemas/user.schema.ts
import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  image: z.string().url().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createUserSchema = userSchema.pick({
  name: true,
  email: true,
  image: true,
});

export const updateUserSchema = userSchema.pick({
  name: true,
  image: true,
}).partial();
```

```typescript
// packages/shared/src/types/index.ts — ALWAYS inferred, never manual
import type { z } from "zod";
import type { userSchema, createUserSchema, updateUserSchema } from "../schemas/user.schema.js";

export type User = z.infer<typeof userSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
```

**Why?** A hand-written type can drift from the schema, causing runtime validation to pass but TypeScript to disagree (or vice versa). With `z.infer<>`, the type is always in sync.

---

## Const Assertions and Union Extraction

Use `as const` arrays to create both a runtime list and a union type from a single source of truth.

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
// Result: "twitter" | "instagram" | "linkedin" | "bluesky" | "mastodon"

export const PLATFORM_DISPLAY_NAMES: Record<Platform, string> = {
  twitter: "X (Twitter)",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
};
```

**Usage in Zod:** Create a Zod enum from the const array:

```typescript
import { z } from "zod";
import { PLATFORMS } from "../constants/platforms.js";

export const platformSchema = z.enum(PLATFORMS);
// Validates input is one of the PLATFORMS values
```

---

## Singleton with ReturnType Inference

For lazy singletons (database, Redis, etc.), use `ReturnType<>` to infer the type from the factory function.

```typescript
// apps/api/src/lib/db.ts
import { createDb } from "@socialhub/db/client";
import { env } from "../env.js";

let db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!db) db = createDb(env.DATABASE_URL);
  return db;
}
```

**Why not a manual type annotation?** If `createDb()` changes its return type, the singleton stays in sync automatically. No import of internal types needed.

---

## Platform Adapter Interface

All social platform integrations implement a common interface:

```typescript
// apps/api/src/services/platform.service.ts
import type { Platform } from "@socialhub/shared";

export interface PlatformAdapter {
  fetchFeed(accessToken: string, cursor?: string): Promise<unknown[]>;
  fetchNotifications(accessToken: string): Promise<unknown[]>;
  publishPost(accessToken: string, content: string): Promise<unknown>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string }>;
}

const adapters = new Map<Platform, PlatformAdapter>();

export function getPlatformAdapter(platform: Platform): PlatformAdapter | undefined {
  return adapters.get(platform);
}

export function registerPlatformAdapter(platform: Platform, adapter: PlatformAdapter) {
  adapters.set(platform, adapter);
}
```

**Key design:** The `Map<Platform, PlatformAdapter>` uses the `Platform` union as the key type, so only valid platform names can be registered. The `PlatformAdapter` interface ensures every adapter has the same methods.

---

## Environment Validation at Startup

Validate environment variables once at import time using Zod:

```typescript
// apps/api/src/env.ts
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

**Why `z.coerce.number()`?** Environment variables are always strings. `z.coerce.number()` parses `"4000"` into `4000`. Without coercion, `z.number()` would fail because `process.env.API_PORT` is `"4000"`.

---

## WARNING: Manual Type Duplication

**The Problem:**

```typescript
// BAD — type written manually alongside a Zod schema
export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

// This type can drift from the schema above
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string; // oops — not in the schema
}
```

**Why This Breaks:**
1. Schema validates 3 fields, but the type expects 4 — runtime data won't match the type
2. Schema constraints (min, email) aren't reflected in the type
3. Renaming a schema field doesn't update the manual type

**The Fix:** Always derive: `type User = z.infer<typeof userSchema>`

---

## WARNING: Using `any` to Silence Errors

**The Problem:**

```typescript
// BAD — suppresses type checking entirely
const data: any = await fetchFromExternalAPI();
await db.insert(posts).values(data);
```

**Why This Breaks:**
1. No compile-time safety — incorrect data shapes pass silently
2. Drizzle's `.values()` accepts anything, producing runtime SQL errors
3. `any` spreads — anything that touches `data` becomes `any`

**The Fix:** Parse external data through Zod:

```typescript
const raw = await fetchFromExternalAPI();
const data = postSchema.parse(raw); // validated + typed
await db.insert(posts).values(data);
```

---

## WARNING: Non-Exhaustive Switch Statements

**The Problem:**

```typescript
// BAD — adding a new platform silently breaks this function
function getIcon(platform: Platform): string {
  switch (platform) {
    case "twitter": return "twitter-icon";
    case "instagram": return "instagram-icon";
    // Missing: linkedin, bluesky, mastodon
    default: return "generic-icon"; // hides the gap
  }
}
```

**Why This Breaks:** When a new platform is added to the `PLATFORMS` array, this function silently falls through to the default. No compiler error warns you.

**The Fix:** Use exhaustive `never` check:

```typescript
function getIcon(platform: Platform): string {
  switch (platform) {
    case "twitter": return "twitter-icon";
    case "instagram": return "instagram-icon";
    case "linkedin": return "linkedin-icon";
    case "bluesky": return "bluesky-icon";
    case "mastodon": return "mastodon-icon";
    default: {
      const _exhaustive: never = platform;
      throw new Error(`Unhandled platform: ${_exhaustive}`);
    }
  }
}
```

Now adding a platform to the union causes a compile error until this switch handles it.
