# Node.js Modules Reference

## Contents
- ESM Configuration
- Import Extension Rules
- Package Exports Pattern
- Source-Only Packages
- Module Resolution
- Turborepo Pipeline
- Anti-Patterns

## ESM Configuration

Every package in SocialHub uses `"type": "module"` in `package.json`. This means:
- All `.js`/`.ts` files are treated as ES modules
- `require()` is unavailable — use `import`
- `__dirname` and `__filename` are unavailable — use `import.meta.url`

```json
// apps/api/package.json
{
  "type": "module",
  "exports": {
    "./trpc": "./src/trpc/router.ts"
  }
}
```

## Import Extension Rules

**API files (apps/api):** MUST use `.js` extensions in relative imports, even though sources are `.ts`. TypeScript's `moduleResolution: "bundler"` allows this, and `tsx` resolves `.js` to the corresponding `.ts` file.

```typescript
// GOOD — .js extension in API source files
import { env } from "./env.js";
import { getDb } from "../lib/db.js";
import { appRouter } from "../trpc/router.js";

// BAD — will fail at runtime in pure ESM
import { env } from "./env";
import { env } from "./env.ts";
```

**Web/Mobile files:** Path aliases (`@/*`) resolve to `./src/*`. No extension needed because bundlers (Next.js, Metro) handle resolution.

```typescript
// apps/web — uses path alias, no extension
import { trpc } from "@/lib/trpc/react";
```

**drizzle-kit schema files:** MUST use extensionless imports. drizzle-kit has its own CJS resolver that chokes on `.js` extensions.

```typescript
// packages/db/src/schema/index.ts — NO .js extension
import { users } from "./users";
import { posts } from "./posts";

// BAD — drizzle-kit will fail
import { users } from "./users.js";
```

See the **drizzle** skill for schema file conventions.

## Package Exports Pattern

Internal packages use the `exports` field to define public entry points. This replaces `main`/`module` fields and provides precise control over what consumers can import.

```json
// packages/shared/package.json
{
  "name": "@socialhub/shared",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schemas": "./src/schemas/index.ts",
    "./types": "./src/types/index.ts",
    "./constants": "./src/constants/index.ts"
  }
}
```

```json
// packages/db/package.json
{
  "name": "@socialhub/db",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts",
    "./client": "./src/client.ts"
  }
}
```

Consumers import via the exports map paths:

```typescript
import type { AppRouter } from "@socialhub/api/trpc";
import { createPostSchema } from "@socialhub/shared/schemas";
import { createDb } from "@socialhub/db/client";
import { PLATFORMS } from "@socialhub/shared/constants";
```

## Source-Only Packages

Internal packages (`@socialhub/shared`, `@socialhub/db`, `@socialhub/ui`) have **no build step**. They export raw `.ts` files. Consumers compile them:

| Consumer | Compilation Method |
|----------|-------------------|
| API (`apps/api`) | `tsx` (dev) / `tsc` (build) |
| Web (`apps/web`) | Next.js `transpilePackages` |
| Mobile (`apps/mobile`) | Metro bundler |

NEVER add a `build` script to internal packages. Changes to shared code take effect immediately — no rebuild needed.

```json
// packages/shared/package.json — NO build script
{
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

## Module Resolution

`tsconfig.base.json` uses `"moduleResolution": "bundler"` — the modern strategy that supports:
- `exports` field in `package.json`
- `.js` extensions mapping to `.ts` source files
- Path aliases via `paths`

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "composite": true
  }
}
```

Each app extends this and adds its own `paths`:

```json
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

## Turborepo Pipeline

Turborepo orchestrates builds, lint, and typecheck across all packages respecting the dependency graph.

```json
// turbo.json
{
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "lint": { "dependsOn": ["^lint"] },
    "typecheck": { "dependsOn": ["^typecheck"] }
  }
}
```

- `^build` means "build my dependencies first" — ensures `@socialhub/db` typechecks before `apps/api`
- `persistent: true` keeps dev servers running (they don't terminate)
- `cache: false` on dev tasks prevents stale dev servers

Key commands:

```bash
pnpm dev          # Start all apps in parallel (tsx watch + next dev + expo start)
pnpm build        # Build all apps respecting dependency graph
pnpm typecheck    # tsc --noEmit across all packages
pnpm lint         # ESLint across all packages
```

## Anti-Patterns

### WARNING: Missing `.js` Extension in API Imports

**The Problem:**

```typescript
// BAD — works in dev (tsx is lenient) but fails in production (tsc output)
import { env } from "./env";
import { getDb } from "../lib/db";
```

**Why This Breaks:**
1. `tsc` compiles to `.js` files — Node.js ESM requires explicit extensions to resolve them
2. Works in dev with `tsx` which is more lenient, so the bug hides until production build
3. Results in `ERR_MODULE_NOT_FOUND` at runtime

**The Fix:**

```typescript
// GOOD — always use .js extension in apps/api source
import { env } from "./env.js";
import { getDb } from "../lib/db.js";
```

### WARNING: Adding Build Scripts to Internal Packages

**The Problem:**

```json
// BAD — packages/shared/package.json
{
  "scripts": {
    "build": "tsc"
  }
}
```

**Why This Breaks:**
1. Source-only packages are compiled by consumers — adding a build step creates stale artifacts
2. Turborepo will try to cache the build, causing phantom "it works on my machine" bugs
3. Changes to shared code won't take effect until you manually rebuild the package

**The Fix:** Never add `build` to internal packages. Only `lint` and `typecheck` scripts.

### WARNING: Using `require()` in ESM Context

**The Problem:**

```typescript
// BAD — require is not defined in ESM
const config = require("./config.json");
```

**Why This Breaks:** The entire monorepo is `"type": "module"`. `require()` does not exist in ESM.

**The Fix:**

```typescript
// GOOD — use import assertion for JSON
import config from "./config.json" with { type: "json" };

// Or use fs for dynamic loading
import { readFile } from "node:fs/promises";
const config = JSON.parse(await readFile("./config.json", "utf-8"));
```

### WARNING: Importing from Package Internals

**The Problem:**

```typescript
// BAD — bypasses exports map, fragile path
import { users } from "@socialhub/db/src/schema/users";
```

**Why This Breaks:** The `exports` field defines the public API. Internal paths are private and can change without notice.

**The Fix:**

```typescript
// GOOD — use the exports map entry
import { users } from "@socialhub/db/schema";
```
