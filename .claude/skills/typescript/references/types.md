# Type Inference Reference

## Contents
- Inference from Zod Schemas
- Inference from Drizzle Tables
- Inference from Factories and Functions
- Utility Type Patterns
- Discriminated Unions
- JSONB Column Typing
- tRPC Context Narrowing
- WARNING: Anti-Patterns

---

## Inference from Zod Schemas

All domain types are derived from Zod schemas in `packages/shared/src/types/index.ts`:

```typescript
import type { z } from "zod";
import type { userSchema, createUserSchema } from "../schemas/user.schema.js";

export type User = z.infer<typeof userSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
```

**Derivation methods:**

| Zod Method | Result | Use Case |
|-----------|--------|----------|
| `z.infer<typeof schema>` | Full type | Base entity types |
| `schema.pick({ ... })` | Subset | Create/update DTOs |
| `schema.partial()` | All optional | Patch/update |
| `schema.extend({ ... })` | Superset | Add computed fields |
| `schema.omit({ ... })` | Exclude fields | Hide internal fields |

---

## Inference from Drizzle Tables

Drizzle tables provide `$inferSelect` and `$inferInsert` for type extraction:

```typescript
import { posts } from "@socialhub/db/schema";

// Type of a row returned by SELECT
type Post = typeof posts.$inferSelect;

// Type expected by INSERT (auto-generated fields optional)
type NewPost = typeof posts.$inferInsert;
```

**When to use Drizzle types vs Zod types:**
- **Drizzle types** for DB-layer code (queries, inserts, services)
- **Zod types** for API-layer code (tRPC inputs, client responses)
- They should match, but Zod types may omit internal fields like `rawData`

---

## Inference from Factories and Functions

Use `ReturnType<>` to infer types from factory functions:

```typescript
import { createDb } from "@socialhub/db/client";

// Infer the DB client type from the factory
type Db = ReturnType<typeof createDb>;

// Infer context type from async function
import { createContext } from "./context.js";
type Context = Awaited<ReturnType<typeof createContext>>;
```

---

## Utility Type Patterns

Prefer Zod methods over TypeScript utility types when a schema exists:

```typescript
// GOOD — uses Zod's .pick(), types stay in sync with schema
export const createUserSchema = userSchema.pick({ name: true, email: true });
type CreateUser = z.infer<typeof createUserSchema>;

// BAD — manual Pick can drift from schema
type CreateUser = Pick<User, "name" | "email">;
```

Useful TS utility patterns when no Zod schema exists:

```typescript
// Record with Platform union key
const DISPLAY_NAMES: Record<Platform, string> = { ... };

// Partial for optional config
type Config = Partial<{ retries: number; timeout: number }>;

// Extract/Exclude for union manipulation
type SocialPlatform = Extract<Platform, "twitter" | "instagram">;
```

---

## Discriminated Unions

Use Zod `z.discriminatedUnion()` for event-type patterns:

```typescript
import { z } from "zod";

const notificationEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("like"), postId: z.string(), userId: z.string() }),
  z.object({ type: z.literal("follow"), followerId: z.string() }),
  z.object({ type: z.literal("comment"), postId: z.string(), body: z.string() }),
]);

type NotificationEvent = z.infer<typeof notificationEventSchema>;

// TypeScript narrows in switch:
function handle(event: NotificationEvent) {
  switch (event.type) {
    case "like":
      // event is { type: "like"; postId: string; userId: string }
      break;
    case "follow":
      // event is { type: "follow"; followerId: string }
      break;
    case "comment":
      // event is { type: "comment"; postId: string; body: string }
      break;
  }
}
```

---

## JSONB Column Typing

Drizzle's `jsonb().$type<T>()` provides type safety for JSON columns:

```typescript
// packages/db/src/schema/posts.ts
import { jsonb } from "drizzle-orm/pg-core";

export const posts = pgTable("posts", {
  // Typed as string[] at the TS level
  mediaUrls: jsonb("media_urls").$type<string[]>().default([]),

  // Typed as Record<string, unknown> for flexible platform data
  rawData: jsonb("raw_data").$type<Record<string, unknown>>().default({}),
});
```

**Important:** `$type<T>()` is a compile-time assertion only — it does NOT validate the data at runtime. Always validate JSONB data from external sources through Zod before inserting.

---

## tRPC Context Narrowing

The `isAuthed` middleware narrows `ctx.userId` from `string | null` to `string`:

```typescript
// apps/api/src/trpc/trpc.ts
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // TypeScript narrows: string | null → string
    },
  });
});
```

In `protectedProcedure` handlers, `ctx.userId` is guaranteed to be `string`:

```typescript
me: protectedProcedure.query(async ({ ctx }) => {
  // ctx.userId is string — no null check needed
  return ctx.db.select().from(users).where(eq(users.id, ctx.userId));
}),
```

---

## WARNING: Type Assertions (`as`)

**The Problem:**

```typescript
// BAD — bypasses type checking
const user = data as User;
const config = {} as Config;
```

**Why This Breaks:** `as` tells the compiler "trust me" — if the data doesn't match, you get runtime errors with no compile-time warning. This defeats the purpose of TypeScript.

**The Fix:** Parse through Zod for external data, or use type guards:

```typescript
// GOOD — validates at runtime
const user = userSchema.parse(data);

// GOOD — type guard for narrowing
function isUser(obj: unknown): obj is User {
  return userSchema.safeParse(obj).success;
}
```

---

## WARNING: Using `{}` or `object` Types

**The Problem:**

```typescript
// BAD — {} matches anything except null/undefined
function process(data: {}) { ... }

// BAD — object matches any non-primitive
function process(data: object) { ... }
```

**Why This Breaks:** These types are too permissive. A string, number, or array all satisfy `{}`. They provide no structural type safety.

**The Fix:** Use `Record<string, unknown>` for generic objects, or define a specific shape:

```typescript
// GOOD — explicit shape
function process(data: Record<string, unknown>) { ... }

// BETTER — specific type
function process(data: Post) { ... }
```

---

## WARNING: Non-Null Assertion (`!`)

**The Problem:**

```typescript
// BAD — tells compiler "this is definitely not null" without proof
const userId = ctx.userId!;
```

**Why This Breaks:** If `ctx.userId` IS null at runtime, you get a crash. The `!` operator suppresses the error that would have caught the bug.

**The Fix:** Use the `isAuthed` middleware (which narrows the type), or handle the null case:

```typescript
// GOOD — middleware narrows the type
me: protectedProcedure.query(async ({ ctx }) => {
  const userId = ctx.userId; // already string, not string | null
}),

// GOOD — explicit null check
if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
const userId = ctx.userId; // narrowed to string
```
