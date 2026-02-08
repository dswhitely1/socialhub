---
name: trpc
description: |
  Implements end-to-end type-safe RPC procedures and router architecture.
  Use when: creating/modifying tRPC routers, procedures, middleware, or client setup;
  adding new API endpoints; wiring tRPC to Fastify; configuring tRPC clients for web or mobile.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# tRPC Skill

SocialHub uses **tRPC v11 RC** with Fastify adapter, SuperJSON transformer, and shared `AppRouter` type across web (Next.js) and mobile (Expo) clients. The API uses ESM with `.js` import extensions. Schemas live in `@socialhub/shared` and are reused as procedure inputs. All procedures are either `publicProcedure` or `protectedProcedure` (auth middleware).

## Quick Start

### Adding a New Router

```typescript
// apps/api/src/trpc/routers/example.router.ts
import { router, protectedProcedure } from "../trpc.js";
import { z } from "zod";

export const exampleRouter = router({
  list: protectedProcedure
    .input(z.object({ cursor: z.string().optional(), limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const items = []; // TODO: query db using ctx.db
      return { items, nextCursor: null as string | null };
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // TODO: insert into db
      return { id: "new-id", name: input.name };
    }),
});
```

### Registering the Router

```typescript
// apps/api/src/trpc/router.ts — add to appRouter
import { exampleRouter } from "./routers/example.router.js";

export const appRouter = router({
  // ...existing routers
  example: exampleRouter,
});
```

### Consuming on Web

```typescript
// In a React component (web)
import { trpc } from "@/lib/trpc/react";

function ExampleList() {
  const { data } = trpc.example.list.useQuery({ limit: 10 });
  const createMutation = trpc.example.create.useMutation();
  // ...
}
```

## Key Concepts

| Concept | Location | Notes |
|---------|----------|-------|
| `publicProcedure` | `apps/api/src/trpc/trpc.ts` | No auth required |
| `protectedProcedure` | `apps/api/src/trpc/trpc.ts` | Requires `ctx.userId` via `isAuthed` middleware |
| `AppRouter` type | `apps/api/src/trpc/router.ts` | Exported via `@socialhub/api/trpc` |
| SuperJSON transformer | Both server and clients | Must match on both sides |
| Fastify adapter | `apps/api/src/plugins/trpc.plugin.ts` | Mounted at `/trpc` prefix |
| Zod schemas | `packages/shared/src/schemas/` | Shared input validation |

## Common Patterns

### Cursor Pagination

**When:** Any list endpoint returning paginated results.

```typescript
.input(z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
}))
.query(async ({ input }) => {
  return { items: [], nextCursor: null as string | null };
})
```

### No-Input Mutation

**When:** Actions that don't need parameters (e.g., mark all read).

```typescript
markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
  // operate using ctx.userId
  return { success: true };
}),
```

### Batch Operations

**When:** Acting on multiple items at once.

```typescript
.input(z.object({ ids: z.array(z.string().uuid()) }))
.mutation(async ({ input }) => {
  return { updated: input.ids.length };
})
```

## New Router Checklist

Copy this checklist and track progress:
- [ ] Create `apps/api/src/trpc/routers/{name}.router.ts`
- [ ] Define Zod schema in `packages/shared/src/schemas/{name}.schema.ts` if reusable
- [ ] Import and add router to `apps/api/src/trpc/router.ts`
- [ ] Run `pnpm typecheck` — clients auto-infer the new procedures
- [ ] If validation fails, fix issues and repeat typecheck

## See Also

- [endpoints](references/endpoints.md) - Router structure and procedure patterns
- [validation](references/validation.md) - Zod schema patterns for inputs
- [auth](references/auth.md) - Protected procedures and JWT context
- [pagination](references/pagination.md) - Cursor-based pagination patterns

## Related Skills

- See the **fastify** skill for Fastify plugin architecture and server setup
- See the **zod** skill for schema validation patterns
- See the **tanstack-query** skill for React Query integration on clients
- See the **drizzle** skill for database queries inside procedures
- See the **auth-js** skill for JWT/OAuth session handling
- See the **typescript** skill for strict type patterns and ESM import conventions

## Documentation Resources

> Fetch latest tRPC documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "trpc"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/trpc_io` _(website docs, 1960 snippets, High reputation)_

**Recommended Queries:**
- "tRPC v11 initTRPC and router setup"
- "tRPC Fastify adapter configuration"
- "tRPC React Query integration useQuery useMutation"
- "tRPC middleware and context"
- "tRPC error handling TRPCError"
