# Validation Reference

## Contents
- Schema Location Strategy
- Input Validation Patterns
- Shared vs Inline Schemas
- WARNING: Duplicated Schemas
- WARNING: Missing .nonnegative()
- Zod Integration With tRPC

## Schema Location Strategy

| Schema Type | Location | When |
|-------------|----------|------|
| Shared/reusable | `packages/shared/src/schemas/{domain}.schema.ts` | Used by both API and clients, or across multiple routers |
| Endpoint-specific | Inline in the router file | Only used by one procedure |

Shared schemas are exported from `@socialhub/shared`:

```typescript
// packages/shared/src/schemas/post.schema.ts
import { z } from "zod";
import { PLATFORMS } from "../constants/platforms.js";

export const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  mediaUrls: z.array(z.string().url()).optional(),
});

export const feedQuerySchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
```

## Input Validation Patterns

### Entity IDs

```typescript
// Single ID
.input(z.object({ id: z.string().uuid() }))

// Batch IDs
.input(z.object({ ids: z.array(z.string().uuid()) }))
```

### Pagination Inputs

```typescript
.input(z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
}))
```

### Platform Enum

Use the shared `PLATFORMS` constant with `z.enum()`:

```typescript
import { PLATFORMS } from "../constants/platforms.js";

// Single platform filter
platform: z.enum(PLATFORMS).optional(),

// Multi-platform selection
platforms: z.array(z.enum(PLATFORMS)).min(1),
```

The `PLATFORMS` array is defined `as const` in `packages/shared/src/constants/platforms.ts`, which makes `z.enum(PLATFORMS)` type-safe. See the **zod** skill for advanced enum patterns.

### Partial Updates

Use `.pick()` + `.partial()` to derive update schemas from base schemas:

```typescript
export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  image: z.string().url().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const updateUserSchema = userSchema.pick({
  name: true,
  image: true,
}).partial();
```

### Flexible JSONB Data

```typescript
rawData: z.record(z.unknown()),
```

## Shared vs Inline Schemas

**Use shared schemas when:**
- The schema is used by more than one procedure
- Clients need the schema for form validation (see the **zod** skill)
- The schema represents a domain entity

**Use inline schemas when:**
- The validation is trivial and specific to one endpoint
- Adding to shared would create clutter with no reuse

```typescript
// GOOD — inline for single-use, simple input
search: protectedProcedure
  .input(z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(50).default(20),
  }))
  .query(async ({ input }) => { /* ... */ }),
```

## WARNING: Duplicated Schemas

**The Problem:**

```typescript
// BAD — same schema defined in both router and shared package
// apps/api/src/trpc/routers/post.router.ts
const createPostInput = z.object({
  content: z.string().min(1).max(5000),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
});

// packages/shared/src/schemas/post.schema.ts
export const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
});
```

**Why This Breaks:**
1. Validation rules drift — one gets updated, the other doesn't
2. Client-side validation disagrees with server-side
3. TypeScript infers different (but structurally identical) types, causing confusion

**The Fix:**

Single source of truth in `@socialhub/shared`:

```typescript
// GOOD — import from shared package
import { createPostSchema } from "@socialhub/shared";

create: protectedProcedure
  .input(createPostSchema)
  .mutation(async ({ input }) => { /* ... */ }),
```

## WARNING: Missing .nonnegative()

**The Problem:**

```typescript
// BAD — .nonneg() does not exist on Zod numbers
likes: z.number().int().nonneg(),
// TypeError: z.number().int().nonneg is not a function
```

**Why This Breaks:** Runtime crash. Zod has no `.nonneg()` method.

**The Fix:**

```typescript
// GOOD — correct method name
likes: z.number().int().nonnegative(),
reposts: z.number().int().nonnegative(),
```

## Zod Integration With tRPC

tRPC v11 uses Zod for `.input()` validation automatically. The inferred type flows through to `{ input }` in the handler and to the client's `useQuery`/`useMutation` calls.

### Type Inference From Schemas

```typescript
import type { z } from "zod";
import type { createPostSchema } from "@socialhub/shared";

// Inferred type — use for service functions
type CreatePostInput = z.infer<typeof createPostSchema>;
```

### Date Coercion

Use `z.coerce.date()` for fields that arrive as strings over HTTP but should be `Date` objects:

```typescript
publishedAt: z.coerce.date(),
createdAt: z.coerce.date(),
```

SuperJSON handles `Date` serialization, but `z.coerce.date()` ensures raw HTTP clients also work.

### Validation Workflow

1. Define or update schema in `packages/shared/src/schemas/`
2. Export from `packages/shared/src/schemas/index.ts`
3. Import in router: `import { mySchema } from "@socialhub/shared"`
4. Use as `.input(mySchema)`
5. Run `pnpm typecheck` — type errors surface on both server and clients
6. If typecheck fails, fix schema and repeat step 5
