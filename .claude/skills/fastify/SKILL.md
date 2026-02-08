All 6 skill files have been created. Here's a summary of what was generated:

**`.claude/skills/fastify/SKILL.md`** (~130 lines)
- Overview of Fastify 5.x usage in SocialHub (tRPC transport, Socket.IO, plugin architecture)
- Quick start patterns: plugin structure, server registration order
- Key concepts table, common patterns (new plugin, lazy singleton, Zod env)
- ESM import extension warning
- Links to all 5 reference files + related skills (trpc, socket-io, zod, drizzle, redis, bullmq, node)
- Context7 library ID: `/llmstxt/fastify_dev_llms_txt`

**`references/routes.md`** (~130 lines)
- Explains that all business routes flow through tRPC, not native Fastify routes
- Domain router pattern with real code from `user.router.ts`, `post.router.ts`
- Step-by-step checklist for adding a new router
- Input validation patterns (shared Zod schemas vs inline)
- Anti-patterns: business logic in routers, mixing auth levels, native routes for API logic

**`references/services.md`** (~120 lines)
- Platform adapter interface and registry pattern from `platform.service.ts`
- Search service (Meilisearch) and notification service (Socket.IO) implementations
- Service creation checklist and function signature patterns
- Anti-patterns: direct client instantiation, raw `process.env`, stateful services

**`references/database.md`** (~130 lines)
- Lazy singleton DB client, tRPC context injection
- Drizzle query patterns: select, insert, cursor pagination
- Connection management with postgres.js
- Anti-patterns: N+1 queries, per-request DB instances, raw SQL injection, unvalidated JSONB

**`references/auth.md`** (~120 lines)
- Split auth model (Auth.js web / JWT verification API / expo-secure-store mobile)
- `isAuthed` middleware implementation with TypeScript narrowing
- Context token extraction and future `verifyToken` implementation with `jose`
- Auth implementation checklist
- Anti-patterns: trusting client-sent user IDs (IDOR), skipping auth, exposing internal errors

**`references/errors.md`** (~130 lines)
- Three-layer error architecture (tRPC, Fastify plugins, startup)
- tRPC error code reference table with HTTP status mappings
- Async error propagation patterns
- Missing infrastructure warnings (Sentry, request-level error context)
- Anti-patterns: silent swallowing, stack trace leaking, overly broad catches