# SocialHub

A unified social media hub that aggregates feeds, notifications, and interactions from multiple platforms (X/Twitter, Instagram, LinkedIn, Bluesky, Mastodon) into a single interface. Targets power users, content creators, and social media managers who need to manage 4+ platforms without switching apps. See @docs/PRD.md for the full product requirements.

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Monorepo | pnpm workspaces + Turborepo | pnpm 9.x, turbo 2.x | Workspace management and parallel builds |
| Runtime | Node.js | 20.x | Server and tooling runtime |
| Language | TypeScript | 5.x | End-to-end type safety (strict mode enabled) |
| API Framework | Fastify | 5.x | High-throughput API server with plugin architecture |
| API Protocol | tRPC | 11.x (RC) | End-to-end type-safe RPC between clients and server |
| Web Framework | Next.js | 15.x | App Router, server components, Auth.js integration |
| Web React | React | 19.x | Web UI (note: mobile uses React 18) |
| Mobile | Expo (React Native) | SDK 52 | Cross-platform iOS/Android with Expo Router |
| State Mgmt | Zustand + TanStack Query | 5.x each | Client state (Zustand) and server state (React Query) |
| Styling (Web) | Tailwind CSS | 4.x | Utility-first CSS via `@tailwindcss/postcss` |
| Styling (Mobile) | NativeWind (Tailwind) | 4.x (TW 3.x) | Tailwind-in-React-Native; mobile stays on TW v3 |
| Database | PostgreSQL | 16.x | Primary data store, JSONB for flexible platform schemas |
| ORM | Drizzle ORM + postgres.js | 0.38.x | Type-safe SQL-like schema, push/migrate workflows |
| Cache/Queue | Redis + BullMQ | Redis 7.x | Feed caching, session store, background job queues |
| Search | Meilisearch | 1.12.x | Full-text search for posts and users |
| Auth (Web) | Auth.js (next-auth v5) | 5.x beta | OAuth (Google, GitHub), JWT sessions, Drizzle adapter |
| Real-time | Socket.IO | 4.x | WebSocket push for live notifications |
| CI/CD | GitHub Actions | - | Lint, typecheck, build on push/PR to main |

## Quick Start

```bash
# Prerequisites: Node 20+, pnpm 9+, Docker

# 1. Clone and install
git clone <repo-url> && cd socialhub
pnpm install

# 2. Start infrastructure (Postgres on port 5433, Redis on 6379, Meilisearch on 7700)
pnpm docker:up

# 3. Set up environment
cp .env.example .env
# Edit .env if needed — defaults work for local dev

# 4. Push database schema
pnpm db:push

# 5. (Optional) Seed database
pnpm db:seed

# 6. Start all dev servers
pnpm dev
# API: http://localhost:4000  |  Web: http://localhost:3000
```

## Project Structure

```
socialhub/
├── apps/
│   ├── api/                  # Fastify + tRPC + Socket.IO backend
│   │   └── src/
│   │       ├── server.ts     # Entry point — registers plugins, starts Fastify
│   │       ├── env.ts        # Zod-validated environment variables
│   │       ├── trpc/         # tRPC router, context, procedures
│   │       │   ├── trpc.ts   # initTRPC, publicProcedure, protectedProcedure
│   │       │   ├── context.ts
│   │       │   ├── router.ts # AppRouter (exported as type for clients)
│   │       │   └── routers/  # Domain routers: user, post, platform, notification, search
│   │       ├── services/     # Business logic: platform adapters, search, notifications, auth
│   │       ├── plugins/      # Fastify plugins: trpc.plugin.ts, socket.plugin.ts
│   │       ├── jobs/         # BullMQ workers: feed-polling, token-refresh
│   │       └── lib/          # Singleton clients: db, redis, meilisearch
│   ├── web/                  # Next.js 15 App Router
│   │   └── src/
│   │       ├── app/          # Next.js routes (route groups: (auth), (dashboard))
│   │       ├── components/   # React components (layout/header.tsx, layout/sidebar.tsx)
│   │       ├── lib/          # trpc client (client.ts + react.tsx), auth config
│   │       ├── stores/       # Zustand stores: feed.store.ts, notification.store.ts, ui.store.ts
│   │       └── middleware.ts  # Auth middleware (redirect unauthenticated users)
│   └── mobile/               # Expo (React Native) with Expo Router
│       └── src/
│           ├── app/          # File-based routes: (tabs)/, (auth)/
│           ├── components/   # RN components: platform-badge.tsx
│           ├── lib/          # trpc client, auth token helpers (expo-secure-store)
│           ├── stores/       # Zustand stores: feed.store.ts, auth.store.ts
│           └── providers/    # AppProvider (tRPC + React Query)
├── packages/
│   ├── shared/               # Shared validation schemas, types, and constants
│   │   └── src/
│   │       ├── schemas/      # Zod schemas: user, post, platform, notification
│   │       ├── types/        # Inferred TypeScript types from Zod schemas
│   │       └── constants/    # Platform list, error codes
│   ├── db/                   # Drizzle ORM schema and database client
│   │   └── src/
│   │       ├── schema/       # Table definitions: users, auth, posts, platforms, notifications
│   │       ├── client.ts     # createDb() factory using postgres.js driver
│   │       ├── seed.ts       # Database seed script
│   │       └── migrations/   # Drizzle-generated migration files
│   └── ui/                   # Shared UI components (currently web-only)
│       └── src/
│           └── web/          # Web components: button.tsx
├── docker-compose.yml        # Postgres (5433), Redis (6379), Meilisearch (7700)
├── turbo.json                # Turborepo task pipeline
├── tsconfig.base.json        # Shared TS config (strict, ES2022, bundler resolution)
├── eslint.config.ts          # Flat ESLint config (strict TS, consistent-type-imports)
└── .prettierrc               # Double quotes, semicolons, 100 char width, trailing commas
```

## Architecture Overview

SocialHub follows a **monorepo architecture** with three applications sharing code through internal packages. The API server acts as the central backend, exposing tRPC procedures over HTTP (Fastify) and real-time notifications via Socket.IO. Web and mobile clients consume the same tRPC router type (`AppRouter`) for end-to-end type safety.

**Source-only packages:** Internal packages (`@socialhub/shared`, `@socialhub/db`, `@socialhub/ui`) have no build step — they export raw `.ts` files via `package.json` `exports` fields. Consumers (Next.js via `transpilePackages`, API via `tsx`, mobile via Metro) compile them directly. This means changes to shared code take effect immediately without rebuilds.

**Authentication flow:** Auth.js handles OAuth on the web side (Google, GitHub providers) using the Drizzle adapter and JWT sessions. The API server is designed to verify those JWTs via a shared `AUTH_SECRET` for protected procedures. Mobile stores tokens in `expo-secure-store` and sends them as Bearer headers.

**Platform adapter pattern:** Each social platform (Twitter, Instagram, LinkedIn, Bluesky, Mastodon) implements a common `PlatformAdapter` interface for feed fetching, notifications, posting, and token refresh. Adapters are registered in a map and resolved by platform name.

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Next.js    │  │  Expo Mobile │  │  (Future)    │
│   Web App    │  │  iOS/Android │  │  Clients     │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │  tRPC (HTTP)    │  tRPC (HTTP)    │
       └────────┬────────┘────────┬────────┘
                ▼                 ▼
       ┌────────────────────────────────┐
       │   Fastify API (port 4000)     │
       │   tRPC Router + Socket.IO     │
       └───────┬──────────┬────────────┘
               │          │
    ┌──────────▼──┐  ┌────▼─────────┐
    │   BullMQ    │  │  Platform    │
    │   Workers   │  │  Adapters    │
    └──────┬──────┘  └──────┬───────┘
           │                │
    ┌──────▼────────────────▼───────┐
    │  PostgreSQL · Redis · Meili   │
    └───────────────────────────────┘
```

### Key Modules

| Module | Location | Purpose |
|--------|----------|---------|
| AppRouter | `apps/api/src/trpc/router.ts` | Root tRPC router — type is exported via `@socialhub/api/trpc` for clients |
| tRPC procedures | `apps/api/src/trpc/trpc.ts` | `publicProcedure`, `protectedProcedure` (auth middleware), `router` |
| Zod schemas | `packages/shared/src/schemas/` | Validation schemas shared across API and clients |
| DB schema | `packages/db/src/schema/` | Drizzle table definitions (users, posts, platforms, notifications, auth) |
| Platform service | `apps/api/src/services/platform.service.ts` | Adapter pattern for social platform integrations |
| Auth config | `apps/web/src/lib/auth/auth.ts` | Auth.js setup (Google, GitHub, Drizzle adapter, JWT callbacks) |
| tRPC React | `apps/web/src/lib/trpc/react.tsx` | TRPCProvider wrapping QueryClientProvider for web |
| Mobile tRPC | `apps/mobile/src/lib/trpc.ts` | tRPC client with SecureStore-based auth headers |

## Development Guidelines

### File Naming
- All source files use **kebab-case**: `feed-polling.job.ts`, `platform-badge.tsx`, `ui.store.ts`
- Domain routers use suffix pattern: `user.router.ts`, `post.router.ts`
- Services use suffix pattern: `platform.service.ts`, `search.service.ts`
- Schemas use suffix pattern: `user.schema.ts`, `post.schema.ts`
- Stores use suffix pattern: `feed.store.ts`, `ui.store.ts`
- Jobs use suffix pattern: `feed-polling.job.ts`, `token-refresh.job.ts`
- Fastify plugins use suffix pattern: `trpc.plugin.ts`, `socket.plugin.ts`
- Next.js conventions: `page.tsx`, `layout.tsx`, `route.ts` (lowercase, framework-mandated)

### Code Naming
- **Components/functions:** PascalCase for components (`function Sidebar()`), camelCase for regular functions (`function getDb()`)
- **Variables:** camelCase (`const queryClient`, `const sidebarOpen`)
- **Constants:** SCREAMING_SNAKE_CASE (`const PLATFORMS`, `const ERROR_CODES`, `const QUEUE_NAME`)
- **Types/interfaces:** PascalCase (`type Platform`, `interface PlatformAdapter`, `type AppRouter`)
- **Boolean props/state:** `is`/`has` prefix (`isActive`, `isRead`, `isLoggedIn`)

### Import Conventions
- **Type imports** must use the `type` keyword — enforced by `@typescript-eslint/consistent-type-imports`
- **Internal imports** in API use `.js` extension for ESM compatibility: `import { env } from "./env.js"`
- **Package imports** use `exports` map paths: `import type { AppRouter } from "@socialhub/api/trpc"`
- **Path aliases:** Web and mobile use `@/*` mapping to `./src/*`
- **Import order:** External packages first, then internal packages (`@socialhub/*`), then relative imports

### Formatting (Prettier)
- Double quotes, semicolons, trailing commas (`all`)
- 100 character line width, 2-space indentation

### Linting (ESLint)
- Flat config (`eslint.config.ts`) with `tseslint.configs.strict`
- Unused variables must be prefixed with `_` (e.g., `_token`)
- Prettier integration via `eslint-config-prettier`

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode (Turborepo) |
| `pnpm build` | Build all apps (Turborepo, respects dependency graph) |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm typecheck` | Run `tsc --noEmit` across all packages |
| `pnpm format` | Format all files with Prettier |
| `pnpm format:check` | Check formatting without writing |
| `pnpm db:generate` | Generate Drizzle migration files |
| `pnpm db:push` | Push schema changes directly to database (dev) |
| `pnpm db:migrate` | Run generated migrations |
| `pnpm db:seed` | Seed database with demo data |
| `pnpm db:studio` | Open Drizzle Studio (database GUI) |
| `pnpm docker:up` | Start Postgres, Redis, Meilisearch containers |
| `pnpm docker:down` | Stop infrastructure containers |
| `pnpm docker:reset` | Destroy volumes and restart containers (wipes data) |

## Environment Variables

Defined in `.env` at the project root. See @.env.example for defaults.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (default port **5433**, not 5432) |
| `REDIS_URL` | Yes | Redis connection string |
| `MEILI_URL` | Yes | Meilisearch URL |
| `MEILI_MASTER_KEY` | Yes | Meilisearch API key |
| `AUTH_SECRET` | Yes | Shared secret for Auth.js JWT signing/verification |
| `AUTH_URL` | Yes | Auth.js base URL (web app origin) |
| `AUTH_GOOGLE_ID` | No | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | No | Google OAuth client secret |
| `AUTH_GITHUB_ID` | No | GitHub OAuth client ID |
| `AUTH_GITHUB_SECRET` | No | GitHub OAuth client secret |
| `API_PORT` | No | API server port (default: 4000) |
| `API_URL` | No | API server URL |
| `NEXT_PUBLIC_API_URL` | Yes | API URL exposed to browser (tRPC client) |
| `NEXT_PUBLIC_WS_URL` | Yes | WebSocket URL for Socket.IO client |

## Important Gotchas

- **Docker Postgres runs on port 5433** (not the default 5432) — `DATABASE_URL` must use port 5433
- **drizzle-kit requires extensionless imports** in schema files — use `import { users } from "./users"` not `./users.js` (drizzle-kit uses its own CJS resolver)
- **API source files use `.js` extensions** in imports for ESM — e.g., `import { env } from "./env.js"` even though the source is `.ts`
- **Mobile uses React 18** (Expo SDK 52 requirement), while web uses React 19 — be careful with shared components
- **Zod uses `.nonnegative()`** not `.nonneg()` — the latter doesn't exist
- **Packages are source-only** (no build step) — consumers compile `.ts` directly; never add a `build` script to packages
- **`@types/node` must be explicit** in `devDependencies` for packages that use `process` or `console`
- **tRPC is on RC** (v11 release candidate) — API may differ from stable tRPC v10 docs

## Testing

No testing framework is configured yet. The CI pipeline runs lint, typecheck, and build only.

## Deployment

Not yet configured. See @docs/PRD.md section 6.4 for planned infrastructure (AWS ECS Fargate, CloudFront, Terraform).


## Skill Usage Guide

When working on tasks involving these technologies, invoke the corresponding skill:

| Skill | Invoke When |
|-------|-------------|
| zustand | Manages lightweight global client state with Zustand stores |
| tailwind | Applies utility-first CSS styling with Tailwind v4 for web and NativeWind for mobile |
| drizzle | Designs type-safe database schemas and writes SQL-like queries with Drizzle ORM |
| tanstack-query | Handles server state caching, polling, and real-time synchronization |
| nextjs | Configures Next.js 15 App Router, server components, and Auth.js integration |
| postgresql | Optimizes PostgreSQL schemas, JSONB columns, and relational data modeling |
| typescript | Enforces strict TypeScript patterns, type safety, and end-to-end type validation |
| react-native | Builds Expo-based cross-platform iOS and Android apps with Expo Router |
| fastify | Configures high-throughput Fastify API server with plugin architecture patterns |
| trpc | Implements end-to-end type-safe RPC procedures and router architecture |
| redis | Implements Redis caching, session storage, and BullMQ job queues |
| bullmq | Designs background jobs for feed polling, token refresh, and webhook processing |
| react | Manages React hooks, components, state management, and shared component patterns |
| zod | Creates validation schemas for shared types and API request validation |
| socket-io | Implements WebSocket real-time notification streaming and push architecture |
| auth-js | Configures OAuth flows, JWT sessions, and Auth.js with Drizzle adapter |
| frontend-design | Applies Tailwind CSS utility-first styling across web and mobile interfaces |
| meilisearch | Implements full-text search with typo tolerance for posts and users |
| node | Configures Node.js 20 runtime, tooling, and server-side JavaScript patterns |
