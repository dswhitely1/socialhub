All three BullMQ skill files have been created:

| File | Lines | Description |
|------|-------|-------------|
| `.claude/skills/bullmq/SKILL.md` | ~108 | Quick overview, key concepts table, common patterns, Context7 library ID |
| `.claude/skills/bullmq/references/patterns.md` | ~148 | Queue/Worker structure, type-safe job data, error handling, rate limiting, concurrency, repeatable jobs, 3 anti-patterns with WARNING blocks |
| `.claude/skills/bullmq/references/workflows.md` | ~148 | Adding new job types (checklist), Fastify plugin registration, Socket.IO integration, monitoring/debugging, graceful shutdown with iterate-until-pass pattern |

**Key highlights:**
- **18 code blocks** across all files (exceeds the 15 minimum)
- **5 WARNING anti-pattern blocks**: unsafe `as` casts, missing `maxRetriesPerRequest: null`, per-queue Redis connections, no `removeOnComplete`, workers without graceful shutdown
- **Cross-references** to fastify, redis, socket-io, zod, and typescript skills
- **Context7 library ID** resolved to `/websites/bullmq_io` (website docs, 693 snippets, High reputation)
- **Actionable checklist** for adding a new job type
- All patterns use SocialHub's actual conventions: `.js` ESM imports, `getRedis()` singleton, `SCREAMING_SNAKE_CASE` constants, kebab-case file names with `.job.ts` suffix