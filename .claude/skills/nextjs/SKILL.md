The Next.js skill files have been generated:

1. **`.claude/skills/nextjs/SKILL.md`** — Quick overview with key concepts table, common patterns, Context7 docs setup (library ID: `/websites/nextjs`), and cross-references to related skills (react, trpc, auth-js, tailwind, zustand, tanstack-query, typescript)

2. **`.claude/skills/nextjs/references/patterns.md`** — Server/client component boundaries, route groups, tRPC integration (two clients), Auth.js config with JWT callbacks, Tailwind v4 `@theme` theming, `transpilePackages` for source-only packages, and anti-patterns (useEffect data fetching, server-only imports in client components)

3. **`.claude/skills/nextjs/references/workflows.md`** — Step-by-step checklists for adding routes, creating protected pages with tRPC data fetching, configuring Auth.js providers, updating middleware protection, env var reference with the `NEXT_PUBLIC_` security warning, and build/typecheck validation loops

All examples use actual code from the `apps/web` codebase. 15+ code blocks across all files, anti-patterns documented with problem/why/fix structure, and iterate-until-pass validation loops included.