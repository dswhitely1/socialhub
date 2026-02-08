---
name: typescript
description: |
  Enforces strict TypeScript patterns, type safety, and end-to-end type validation across the SocialHub monorepo.
  Use when: working with type definitions, generics, Zod type inference, ESM import conventions,
  tRPC end-to-end types, or resolving type errors across apps and packages.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# TypeScript Skill

SocialHub uses TypeScript 5.x in **strict mode** across the entire monorepo. Types are derived from Zod schemas (`z.infer<>`) — never hand-written alongside schemas. The `AppRouter` type flows from the API to web and mobile clients via tRPC for end-to-end safety. Packages are source-only (no build step), so TypeScript compilation happens at the consumer level.

## Quick Start

### Zod-First Type Derivation

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

// packages/shared/src/types/index.ts — inferred, never manually written
export type User = z.infer<typeof userSchema>;
```

### Const Assertion Unions

```typescript
// packages/shared/src/constants/platforms.ts
export const PLATFORMS = ["twitter", "instagram", "linkedin", "bluesky", "mastodon"] as const;
export type Platform = (typeof PLATFORMS)[number]; // "twitter" | "instagram" | ...
```

### tRPC End-to-End Type Safety

```typescript
// AppRouter type flows to clients automatically
import type { AppRouter } from "@socialhub/api/trpc";

// Client procedures are fully typed — no manual type annotations needed
const { data } = trpc.post.feed.useQuery({ limit: 20 });
// data is typed as the exact return type of the feed procedure
```

## Key Concepts

| Concept | Pattern | Example |
|---------|---------|---------|
| Zod-first types | `z.infer<typeof schema>` | Never hand-write types that duplicate a schema |
| Const assertions | `as const` + index access | `PLATFORMS` tuple → `Platform` union |
| Type-only imports | `import type { X }` | Enforced by ESLint `consistent-type-imports` |
| ESM extensions | `.js` in API, none in schema | `import { env } from "./env.js"` |
| Source-only packages | No `dist/`, consumers compile | `"exports": { ".": "./src/index.ts" }` |
| Strict mode | `strict: true` in tsconfig | No `any`, no implicit `undefined` |
| Drizzle type inference | `$inferSelect` / `$inferInsert` | `type Post = typeof posts.$inferSelect` |

## Common Patterns

### Singleton with ReturnType Inference

```typescript
let db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!db) db = createDb(env.DATABASE_URL);
  return db;
}
```

### Platform Adapter Interface

```typescript
interface PlatformAdapter {
  fetchFeed(token: string, cursor?: string): Promise<FeedResult>;
  fetchNotifications(token: string): Promise<Notification[]>;
  publishPost(token: string, content: string): Promise<{ id: string }>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string }>;
}
```

### Narrowing in tRPC Auth Middleware

```typescript
// ctx.userId goes from string | null → string after isAuthed middleware
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, userId: ctx.userId } }); // narrowed to string
});
```

## Import Extension Rules

| Location | Extension | Reason |
|----------|-----------|--------|
| `apps/api/src/**` | `.js` suffix | ESM requires explicit extensions |
| `packages/db/src/schema/**` | No extension | drizzle-kit uses CJS resolver |
| `apps/web/src/**` | No extension | Next.js bundler handles resolution |
| `apps/mobile/src/**` | No extension | Metro bundler handles resolution |
| Package imports | No extension | Uses `exports` map in package.json |

## Typecheck Workflow

```bash
# Full monorepo typecheck
pnpm typecheck

# This runs tsc --noEmit in all packages via Turborepo
# Fix all errors before committing
```

## See Also

- [patterns](references/patterns.md) — Zod-first types, const assertions, adapter interfaces, anti-patterns
- [types](references/types.md) — Type inference, utility types, discriminated unions, JSONB typing
- [modules](references/modules.md) — ESM config, import extensions, source-only packages
- [errors](references/errors.md) — tRPC errors, Zod validation errors, common type errors

## Related Skills

- See the **zod** skill for validation schemas and type inference patterns
- See the **trpc** skill for router types and end-to-end inference
- See the **drizzle** skill for database schema type inference
- See the **node** skill for ESM configuration and runtime patterns
- See the **react** skill for component typing and React version differences

## Documentation Resources

> Fetch latest TypeScript documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "typescript"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/typescriptlang`

**Recommended Queries:**
- "TypeScript strict mode configuration"
- "TypeScript generics constraints"
- "TypeScript conditional types"
- "TypeScript module resolution bundler"
- "TypeScript utility types Pick Omit Partial"
