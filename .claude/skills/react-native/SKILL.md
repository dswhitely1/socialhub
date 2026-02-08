All 7 files have been created. Here's a summary of what was generated:

**`SKILL.md`** — Entry point covering Expo SDK 52 setup, quick start patterns for new screens/components, naming conventions, auth-gated navigation, and Context7 library IDs for Expo and NativeWind docs.

**`references/hooks.md`** — React 18 constraints, tRPC query/mutation hooks, Zustand selectors with `useShallow`, Expo Router navigation hooks, auth redirect pattern, and anti-patterns (useEffect data fetching, inline dependency objects, missing cleanup).

**`references/components.md`** — Screen vs component export conventions, FlatList-based screens, NativeWind styling with custom colors, conditional classes, Pressable over TouchableOpacity, platform-specific code, and anti-patterns (ScrollView for lists, mixed style systems).

**`references/data-fetching.md`** — tRPC + React Query architecture, basic queries, parameterized queries, pull-to-refresh, mutations with cache invalidation, infinite scrolling with cursor pagination, optimistic updates, and error handling patterns.

**`references/state.md`** — State category taxonomy (server/UI/client/URL/secure), Zustand store patterns from the codebase, selector best practices, actions outside components, derived state, auth state flow with SecureStore, persisted state with Zustand middleware, and anti-patterns (server data in Zustand, store destructuring, direct mutation).

**`references/forms.md`** — Controlled TextInput patterns, Zod validation integration with shared schemas, full login form example with KeyboardAvoidingView, post composer with character limit, and a WARNING about missing `react-hook-form` with installation instructions.

**`references/performance.md`** — FlatList optimization props, React.memo for list items, stable renderItem with useCallback, expo-image for network images, bundle size monitoring, lazy loading, Zustand selector re-render prevention, InteractionManager for navigation performance, and an optimization checklist.