# Zod Workflows

## Contents
- Adding a New Domain Schema
- Adding a New tRPC Endpoint with Validation
- Adding a New Environment Variable
- Extending an Existing Schema
- Common Zod Method Reference

---

## Adding a New Domain Schema

When adding a new domain entity (e.g., a "savedSearch" feature), follow this workflow.

Copy this checklist and track progress:
- [ ] Step 1: Create schema file in `packages/shared/src/schemas/`
- [ ] Step 2: Export from `packages/shared/src/schemas/index.ts`
- [ ] Step 3: Add inferred types in `packages/shared/src/types/index.ts`
- [ ] Step 4: Use in tRPC router via `.input()`
- [ ] Step 5: Run `pnpm typecheck` to verify

### Step 1: Create the Schema File

```typescript
// packages/shared/src/schemas/saved-search.schema.ts
import { z } from "zod";
import { PLATFORMS } from "../constants/platforms.js";

export const savedSearchSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  query: z.string().min(1).max(500),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
});

export const createSavedSearchSchema = savedSearchSchema.pick({
  query: true,
  platforms: true,
});
```

### Step 2: Export from Index

```typescript
// packages/shared/src/schemas/index.ts
export * from "./user.schema.js";
export * from "./post.schema.js";
export * from "./platform.schema.js";
export * from "./saved-search.schema.js";  // Add this line
```

### Step 3: Add Inferred Types

```typescript
// packages/shared/src/types/index.ts
import type {
  savedSearchSchema,
  createSavedSearchSchema,
} from "../schemas/saved-search.schema.js";

export type SavedSearch = z.infer<typeof savedSearchSchema>;
export type CreateSavedSearch = z.infer<typeof createSavedSearchSchema>;
```

### Step 4: Use in tRPC Router

```typescript
// apps/api/src/trpc/routers/search.router.ts
import { createSavedSearchSchema } from "@socialhub/shared";

export const searchRouter = router({
  saveSearch: protectedProcedure
    .input(createSavedSearchSchema)
    .mutation(async ({ ctx, input }) => {
      // input is fully typed as CreateSavedSearch
    }),
});
```

### Validation Loop

1. Make changes
2. Run: `pnpm typecheck`
3. If typecheck fails, fix type errors and repeat step 2
4. Only proceed when typecheck passes

---

## Adding a New tRPC Endpoint with Validation

For simple, endpoint-specific schemas that aren't reused, define inline in the router.

```typescript
// apps/api/src/trpc/routers/notification.router.ts
import { z } from "zod";

export const notificationRouter = router({
  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ input }) => {
      return { updated: input.ids.length };
    }),
});
```

**Decision rule:** If the schema is used by more than one router or needs a corresponding TypeScript type, move it to `packages/shared/src/schemas/`. If it's a one-off input for a single endpoint, inline it.

---

## Adding a New Environment Variable

When the API needs a new config value, add it to the Zod env schema.

Copy this checklist and track progress:
- [ ] Step 1: Add to `apps/api/src/env.ts` schema
- [ ] Step 2: Add to `.env.example` with documentation
- [ ] Step 3: Add to `.env` with actual value
- [ ] Step 4: Restart API to validate

```typescript
// apps/api/src/env.ts — add the new field
const envSchema = z.object({
  // ... existing fields
  SENTRY_DSN: z.string().url().optional(),  // Optional in dev, required in prod
});
```

Key coercion patterns for environment variables:

```typescript
// String → number
API_PORT: z.coerce.number().default(4000),

// String → boolean (env vars are always strings)
ENABLE_SEARCH: z.coerce.boolean().default(false),

// Constrained enum
NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

// URL validation
DATABASE_URL: z.string().url(),

// Non-empty string (prevents empty string from passing)
AUTH_SECRET: z.string().min(1),
```

### WARNING: Forgetting `.coerce` for Non-String Env Vars

**The Problem:**

```typescript
// BAD - process.env.API_PORT is "4000" (string), z.number() rejects strings
API_PORT: z.number().default(4000),
```

**Why This Breaks:** `.parse(process.env)` will throw `Expected number, received string` because all env vars are strings.

**The Fix:**

```typescript
// GOOD - z.coerce.number() converts "4000" → 4000
API_PORT: z.coerce.number().default(4000),
```

---

## Extending an Existing Schema

When adding a field to an existing entity, update in this order:

1. **Zod schema** in `packages/shared/src/schemas/` — the inferred type updates automatically
2. **Drizzle table** in `packages/db/src/schema/` — see the **drizzle** skill
3. **DB push/migrate** — `pnpm db:push` (dev) or `pnpm db:generate && pnpm db:migrate` (prod)
4. **Typecheck** — `pnpm typecheck` catches any consumers that need updating

```typescript
// packages/shared/src/schemas/post.schema.ts — add bookmarkCount
export const postSchema = z.object({
  // ... existing fields
  likes: z.number().int().nonnegative(),
  reposts: z.number().int().nonnegative(),
  replies: z.number().int().nonnegative(),
  bookmarks: z.number().int().nonnegative(),  // NEW FIELD
  publishedAt: z.coerce.date(),
  rawData: z.record(z.unknown()),
  createdAt: z.coerce.date(),
});
```

The `Post` type in `packages/shared/src/types/index.ts` automatically includes `bookmarks: number` — no manual update needed.

---

## Common Zod Method Reference

Quick reference for methods used across this codebase.

### String Validators

```typescript
z.string()                  // Any string
z.string().min(1)           // Non-empty
z.string().max(100)         // Max length
z.string().email()          // Email format
z.string().url()            // URL format
z.string().uuid()           // UUID v4 format
z.string().min(1).max(5000) // Bounded content (post body)
```

### Number Validators

```typescript
z.number()                  // Any number
z.number().int()            // Integer only
z.number().int().min(1)     // Positive integer
z.number().int().nonnegative()  // Zero or positive (NOT .nonneg())
z.number().int().min(1).max(100)  // Bounded range (pagination limit)
z.coerce.number()           // String → number (env vars)
```

### Composability

```typescript
.nullable()    // Allows null (field can be null in DB)
.optional()    // Allows undefined (field can be omitted from input)
.default(val)  // Provides default if undefined
.pick({})      // Select fields from object schema
.partial()     // Make all fields optional
.extend({})    // Add new fields to object schema
.merge(other)  // Combine two object schemas
.omit({})      // Remove fields from object schema
```

### Validation vs Coercion

```typescript
// Validation: rejects wrong types
z.number().parse("4000")        // ZodError: Expected number

// Coercion: converts compatible types
z.coerce.number().parse("4000") // 4000
z.coerce.date().parse("2024-01-01")  // Date object
z.coerce.boolean().parse("true")     // true
```

Use `.coerce` for external data boundaries (env vars, URL params). Use standard validators for internal API contracts where types should already be correct.
