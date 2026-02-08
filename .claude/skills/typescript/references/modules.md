# Module System Reference

## Contents
- ESM Configuration
- Import Extension Rules
- Source-Only Package Exports
- Type-Only Imports
- Import Order Convention
- Path Aliases
- tsconfig Hierarchy
- WARNING: Anti-Patterns

---

## ESM Configuration

SocialHub uses ES modules throughout. The base tsconfig sets:

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "isolatedModules": true
  }
}
```

All `package.json` files have `"type": "module"` for native ESM.

---

## Import Extension Rules

Different parts of the monorepo have different extension requirements:

| Location | Extension | Reason | Example |
|----------|-----------|--------|---------|
| `apps/api/src/**` | `.js` suffix | Node ESM requires explicit extensions | `import { env } from "./env.js"` |
| `packages/db/src/schema/**` | No extension | drizzle-kit uses its own CJS resolver | `import { users } from "./users"` |
| `apps/web/src/**` | No extension | Next.js bundler handles resolution | `import { Header } from "./header"` |
| `apps/mobile/src/**` | No extension | Metro bundler handles resolution | `import { FeedCard } from "./feed-card"` |
| Package imports | No extension | Uses `exports` map in package.json | `import { db } from "@socialhub/db/client"` |

**The API `.js` rule:** Even though source files are `.ts`, ESM import specifiers must point to the compiled output extension. TypeScript resolves `"./env.js"` to `./env.ts` during compilation.

**The drizzle-kit exception:** drizzle-kit has its own module resolver that breaks on `.js` extensions. Schema files (`packages/db/src/schema/**`) MUST use extensionless imports.

---

## Source-Only Package Exports

Internal packages export raw `.ts` files — no build step, no `dist/` directory:

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

**How consumers compile them:**
- **API** (`apps/api`): `tsx` runtime compiles on the fly
- **Web** (`apps/web`): Next.js `transpilePackages` in `next.config.ts`
- **Mobile** (`apps/mobile`): Metro bundler handles `.ts` natively

**Key rule:** Never add a `build` script to internal packages. They are source-only.

---

## Type-Only Imports

Enforced by ESLint rule `@typescript-eslint/consistent-type-imports`:

```typescript
// GOOD — type keyword for type-only imports
import type { AppRouter } from "@socialhub/api/trpc";
import type { Platform } from "@socialhub/shared";
import type { Context } from "./context.js";

// GOOD — mixed import (values + types)
import { z } from "zod";
import type { ZodError } from "zod";

// BAD — ESLint will flag this
import { AppRouter } from "@socialhub/api/trpc"; // AppRouter is only used as a type
```

**Why?** Type-only imports are erased at compile time, reducing bundle size. They also make it clear which imports are values (available at runtime) vs types (compile-time only).

---

## Import Order Convention

Follow this order, with blank lines between groups:

```typescript
// 1. External packages
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";

// 2. Internal packages (@socialhub/*)
import type { Platform } from "@socialhub/shared";
import { posts } from "@socialhub/db/schema";

// 3. Relative imports
import type { Context } from "./context.js";
import { env } from "./env.js";
```

---

## Path Aliases

Web and mobile use `@/*` mapping to `./src/*`:

```json
// apps/web/tsconfig.json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

```typescript
// apps/web/src/app/dashboard/page.tsx
import { Header } from "@/components/layout/header";
import { useFeedStore } from "@/stores/feed.store";
import { trpc } from "@/lib/trpc/react";
```

**Note:** The API (`apps/api`) does NOT use path aliases — it uses relative imports with `.js` extensions.

---

## tsconfig Hierarchy

```
tsconfig.base.json          ← Shared: strict, ES2022, bundler resolution
├── apps/api/tsconfig.json  ← Extends base, adds outDir/rootDir
├── apps/web/tsconfig.json  ← Extends base, adds Next.js paths/plugins
├── apps/mobile/tsconfig.json ← Extends base, adds Expo/Metro settings
├── packages/shared/tsconfig.json ← Extends base
├── packages/db/tsconfig.json     ← Extends base
└── packages/ui/tsconfig.json     ← Extends base
```

All configs extend `tsconfig.base.json` which enforces `strict: true`. App configs add framework-specific settings.

---

## WARNING: Adding Build Scripts to Packages

**The Problem:**

```json
// BAD — packages/shared/package.json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "exports": {
    ".": "./dist/index.js"
  }
}
```

**Why This Breaks:**
1. Adds a build step that must run before consumers can use the package
2. Turborepo dependency graph becomes complex — builds must complete before dev starts
3. Changes to shared code require rebuilding before they take effect
4. Defeats the purpose of source-only packages

**The Fix:** Export raw `.ts` files, let consumers compile them:

```json
{
  "exports": { ".": "./src/index.ts" }
}
```

---

## WARNING: Barrel Re-Exports with Side Effects

**The Problem:**

```typescript
// BAD — packages/shared/src/index.ts
export * from "./schemas/index.js";
export * from "./types/index.js";
export * from "./constants/index.js";
// If any module has side effects, importing one thing imports everything
```

**Why This Breaks:** Wildcard re-exports from a single entry point force bundlers to load all modules, even if only one type is needed. If any module has a side effect (e.g., global registration), it fires unexpectedly.

**The Fix:** Use specific `exports` map entries so consumers import directly:

```json
{
  "exports": {
    "./schemas": "./src/schemas/index.ts",
    "./types": "./src/types/index.ts",
    "./constants": "./src/constants/index.ts"
  }
}
```

```typescript
// GOOD — consumers import specific subpaths
import { userSchema } from "@socialhub/shared/schemas";
import type { User } from "@socialhub/shared/types";
import { PLATFORMS } from "@socialhub/shared/constants";
```

---

## WARNING: Missing `@types/node` in Packages

**The Problem:**

```typescript
// packages/db/src/seed.ts
console.log("Seeding database..."); // Error: Cannot find name 'console'
process.exit(0); // Error: Cannot find name 'process'
```

**Why This Breaks:** TypeScript strict mode doesn't know about Node.js globals unless `@types/node` is installed. The root `package.json` may have it, but pnpm's strict `node_modules` structure doesn't hoist it to all packages.

**The Fix:** Add `@types/node` to `devDependencies` of any package that uses `process`, `console`, `Buffer`, `__dirname`, etc.:

```json
{
  "devDependencies": {
    "@types/node": "^22.10.7"
  }
}
```
