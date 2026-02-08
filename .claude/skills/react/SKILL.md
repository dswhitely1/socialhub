---
name: react
description: |
  Manages React hooks, components, state management, and shared component patterns for the SocialHub monorepo.
  Use when: creating or modifying React components, hooks, or UI patterns in apps/web, apps/mobile, or packages/ui.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# React Skill

SocialHub uses React 19 on web (Next.js 15 App Router) and React 18 on mobile (Expo SDK 52). All state management follows a strict split: Zustand for UI/client state, TanStack Query (via tRPC) for server state. Components are functional, TypeScript-strict, and styled with Tailwind. The `packages/ui` package provides shared web components with no build step.

## Quick Start

### tRPC Data Fetching (NOT useEffect)

\`\`\`tsx
"use client";

import { trpc } from "@/lib/trpc/react";

export function FeedList() {
  const { data, isLoading } = trpc.post.getFeed.useQuery({ limit: 20 });

  if (isLoading) return <div>Loading...</div>;
  return <ul>{data?.map((post) => <li key={post.id}>{post.content}</li>)}</ul>;
}
\`\`\`

### Zustand Store Pattern

\`\`\`typescript
import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
\`\`\`

## Key Concepts

| Concept | Rule | Example |
|---------|------|---------|
| Server vs Client state | tRPC/React Query for server, Zustand for UI | `trpc.*.useQuery()` vs `useUIStore()` |
| "use client" directive | Required for hooks, event handlers, browser APIs | Every component using useState/Zustand |
| Server Components | Default in Next.js App Router — no directive needed | `page.tsx`, `layout.tsx` without interactivity |
| React version split | Web = React 19, Mobile = React 18 | No React 19 APIs (use, actions) in shared code |
| Source-only packages | `@socialhub/ui` exports raw `.ts` — no build step | Import and consume directly |

## Common Patterns

### Client Component with Store

**When:** Any interactive component needing global UI state.

\`\`\`tsx
"use client";

import { useUIStore } from "@/stores/ui.store";

export function Header() {
  const { toggleSidebar } = useUIStore();
  return <button onClick={toggleSidebar}>Menu</button>;
}
\`\`\`

### Shared Component with Variants

**When:** Building reusable UI in `packages/ui`.

\`\`\`tsx
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({ variant = "primary", size = "md", className = "", children, ...props }: ButtonProps) {
  const styles = { primary: "bg-blue-600 text-white", secondary: "bg-gray-100", ghost: "hover:bg-gray-100" };
  return <button className={`${baseStyles} ${styles[variant]} ${className}`} {...props}>{children}</button>;
}
\`\`\`

### Provider Composition

**When:** Setting up app-level providers.

\`\`\`tsx
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => trpc.createClient({ links: [httpBatchLink({ url, transformer: superjson })] }));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
\`\`\`

## WARNING: React Version Split

Web uses React 19, mobile uses React 18 (Expo SDK 52 constraint). NEVER use React 19-only features (`use()` hook, `useActionState`, form actions) in `packages/shared` or `packages/ui` if those will be consumed by mobile.

## See Also

- [hooks](references/hooks.md)
- [components](references/components.md)
- [data-fetching](references/data-fetching.md)
- [state](references/state.md)
- [forms](references/forms.md)
- [performance](references/performance.md)

## Related Skills

- See the **nextjs** skill for App Router, server components, and middleware patterns
- See the **react-native** skill for Expo-specific mobile patterns and NativeWind
- See the **trpc** skill for router definitions and procedure authoring
- See the **tanstack-query** skill for cache invalidation, optimistic updates, and query options
- See the **zustand** skill for advanced store patterns (persist, devtools, slices)
- See the **tailwind** skill for styling conventions and Tailwind v4 patterns
- See the **zod** skill for validation schemas shared between client and server
- See the **typescript** skill for strict mode, type imports, and generics

## Documentation Resources

> Fetch latest React documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "react"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/react_dev`

**Recommended Queries:**
- "React hooks useState useEffect useCallback useMemo"
- "React Server Components patterns"
- "React 19 new features use hook"