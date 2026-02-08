---
name: zod
description: |
  Creates validation schemas for shared types and API request validation.
  Use when: defining or modifying Zod schemas in packages/shared/src/schemas/,
  adding tRPC input validation, validating environment variables, or inferring
  TypeScript types from schemas.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Zod Skill

Zod v3 (`^3.24.1`) is the single source of truth for validation and type inference across this monorepo. All schemas live in `packages/shared/src/schemas/` and are consumed by tRPC routers for input validation, by `packages/shared/src/types/` for inferred TypeScript types, and by `apps/api/src/env.ts` for environment validation. Web and mobile clients never import Zod directly — they receive types through tRPC inference.

## Quick Start

### Define a Schema in `packages/shared`

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

export const updateUserSchema = userSchema.pick({ name: true, image: true }).partial();
```

### Infer Types from Schemas

```typescript
// packages/shared/src/types/index.ts
import type { z } from "zod";
import type { userSchema, updateUserSchema } from "../schemas/user.schema.js";

export type User = z.infer<typeof userSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
```

### Use in tRPC Routers

```typescript
// apps/api/src/trpc/routers/user.router.ts
import { updateUserSchema } from "@socialhub/shared";

export const userRouter = router({
  update: protectedProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => { /* ... */ }),
});
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| Schema location | All in `packages/shared/src/schemas/` | `user.schema.ts`, `post.schema.ts` |
| Type inference | `z.infer<typeof schema>` in `packages/shared/src/types/` | `type User = z.infer<typeof userSchema>` |
| tRPC input | Pass schema to `.input()` | `.input(feedQuerySchema)` |
| Env validation | `.parse(process.env)` in `apps/api/src/env.ts` | Fails fast at startup |
| Platform enum | `z.enum(PLATFORMS)` from `as const` tuple | `z.enum(["twitter", "instagram", ...])` |
| Coercion | `z.coerce.date()` / `z.coerce.number()` | Parse strings from DB/env into proper types |
| Cursor pagination | `cursor` + `limit` with `.default()` | `limit: z.number().int().min(1).max(100).default(20)` |

## Common Patterns

### Derive CRUD Schemas from Base

```typescript
export const createUserSchema = userSchema.pick({ name: true, email: true, image: true });
export const updateUserSchema = userSchema.pick({ name: true, image: true }).partial();
```

### Platform-Scoped Enum

```typescript
import { PLATFORMS } from "../constants/platforms.js";
// PLATFORMS is defined as [...] as const
export const connectPlatformSchema = z.object({
  platform: z.enum(PLATFORMS),
  code: z.string(),
  redirectUri: z.string().url(),
});
```

### Pagination Query Schema

```typescript
export const feedQuerySchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
```

## WARNING: `.nonnegative()` Not `.nonneg()`

Zod's method is `.nonnegative()`. The shorthand `.nonneg()` does NOT exist and will cause a runtime error.

```typescript
// BAD
z.number().int().nonneg()  // TypeError: .nonneg is not a function

// GOOD
z.number().int().nonnegative()
```

## See Also

- [patterns](references/patterns.md) — Schema design, anti-patterns, Drizzle integration
- [workflows](references/workflows.md) — Adding new schemas, env validation, migration checklist

## Related Skills

- See the **typescript** skill for strict mode and type inference patterns
- See the **trpc** skill for `.input()` validation and router integration
- See the **drizzle** skill for DB schema alignment with Zod schemas
- See the **postgresql** skill for JSONB column validation patterns

## Documentation Resources

> Fetch latest Zod v3 documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "zod"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/v3_zod_dev` _(Zod v3 website docs — 8255 snippets, High reputation)_

**Recommended Queries:**
- "zod object schema validation"
- "zod infer types from schema"
- "zod transform and refine"
- "zod discriminated union"
