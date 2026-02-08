The Zustand skill files have been generated:

1. **`SKILL.md`** (88 lines) — Overview, quick start, key concepts, state separation rules, links to references and related skills
2. **`references/patterns.md`** (146 lines) — State separation decision table, store design patterns from the actual codebase, selector patterns, 4 anti-patterns with full WARNING format
3. **`references/workflows.md`** (148 lines) — Step-by-step store creation, middleware addition (devtools + persist), Socket.IO integration, mobile auth persistence, debugging workflows with checklists and validation loops

Key decisions made:
- **15+ code blocks** across all files, all TypeScript matching the project's strict mode setup
- **Codebase-specific**: every example uses actual SocialHub stores (`useFeedStore`, `useUIStore`, `useNotificationStore`, `useAuthStore`) and project types (`Platform` from `@socialhub/shared`)
- **State separation** is the dominant theme — Zustand for UI state, TanStack Query for server state, with clear warnings against mixing them
- **Cross-references** to 6 related skills (react, tanstack-query, react-native, socket-io, zod, typescript)
- **Context7 library ID** resolved to `/websites/zustand_pmnd_rs` (725 snippets, High reputation)