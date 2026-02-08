The skill files have been generated. Here's a summary of what was created:

**`/.claude/skills/tanstack-query/SKILL.md`** (~120 lines)
- Overview of tRPC + React Query integration pattern used in SocialHub
- Quick start examples: queries, mutations, infinite queries
- Key concepts table mapping server state vs client state
- Common patterns: QueryClient config, Zustand + RQ integration, Socket.IO invalidation
- Related skills: trpc, zustand, zod, react, socket-io, react-native
- Context7 library ID: `/websites/tanstack_query_v5`

**`references/patterns.md`** (~150 lines)
- Provider setup with tRPC wrapping QueryClientProvider
- tRPC query patterns with `enabled`, `staleTime` overrides
- Mutation + cache invalidation via `trpc.useUtils()`
- Optimistic updates (notification mark-read example)
- Infinite queries for cursor-paginated feed/notifications
- Zustand + React Query integration (UI state drives query inputs)
- Socket.IO real-time invalidation
- 3 anti-patterns with WARNING headers: useEffect fetching, conditional hooks, missing invalidation

**`references/workflows.md`** (~150 lines)
- Step-by-step: adding a new query to a component
- Step-by-step: adding a mutation with invalidation (includes invalidation mapping table)
- Converting `useQuery` to `useInfiniteQuery` for cursor pagination
- Wiring Socket.IO events to cache invalidation (with anti-pattern warning)
- Debugging stale data (symptom/cause/fix table + DevTools setup)
- QueryClient defaults checklist with per-query staleTime recommendations