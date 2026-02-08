# Next.js 15 Patterns Reference

## Contents
- Server vs Client Component Boundaries
- Route Groups and Layout Composition
- tRPC Integration Pattern
- Auth.js Configuration and Callbacks
- Tailwind v4 CSS-First Theming
- Transpiling Source-Only Packages
- Anti-Patterns

---

## Server vs Client Component Boundaries

Layouts are server components. Interactive children are client components.

```tsx
// GOOD — app/(dashboard)/layout.tsx is a server component
import { Sidebar } from "@/components/layout/sidebar"; // client component
import { Header } from "@/components/layout/header";   // client component

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

### WARNING: Adding "use client" to Layouts

**The Problem:**

```tsx
// BAD — making a layout a client component
"use client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Now EVERY child becomes a client component too
  return <div>{children}</div>;
}
```

**Why This Breaks:**
1. All descendants lose server component benefits (zero JS shipped, direct DB access)
2. The entire subtree gets bundled into client JavaScript
3. Metadata exports (`export const metadata`) stop working in client components

**The Fix:** Keep layouts as server components. Extract interactive parts into separate client components.

---

## Route Groups and Layout Composition

This project uses two route groups for distinct layout trees:

| Route Group | URL Prefix | Layout | Purpose |
|-------------|-----------|--------|---------|
| `(auth)` | None | Passthrough | Login, register pages |
| `(dashboard)` | None | Sidebar + Header | Feed, notifications, platforms, settings |

```
app/
├── (auth)/
│   ├── layout.tsx        # passthrough — no wrapping UI
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx        # sidebar + header shell
│   ├── feed/page.tsx
│   └── notifications/page.tsx
```

Route groups add **zero URL segments** — `/login` not `/(auth)/login`.

---

## tRPC Integration Pattern

Two tRPC clients exist — use the right one for the context:

| Client | File | When |
|--------|------|------|
| React hooks | `src/lib/trpc/react.tsx` | Client components using `trpc.useQuery()` |
| Vanilla | `src/lib/trpc/client.ts` | Server components, Route Handlers, Server Actions |

### React tRPC Provider

```tsx
// src/lib/trpc/react.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import superjson from "superjson";
import type { AppRouter } from "@socialhub/api/trpc";

export const trpc = createTRPCReact<AppRouter>();

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${process.env.NEXT_PUBLIC_API_URL}/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

**Critical:** Use `useState` for `queryClient` and `trpcClient` — not `useRef` or top-level `const`. This prevents re-creation on every render while remaining SSR-safe. See the **trpc** skill and **tanstack-query** skill for query patterns.

---

## Auth.js Configuration and Callbacks

```ts
// src/lib/auth/auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { createDb } from "@socialhub/db";

const db = createDb(process.env.DATABASE_URL!);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [Google, GitHub],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
```

**Key decisions:**
- JWT strategy (not database sessions) — enables API-side verification with shared `AUTH_SECRET`
- `jwt` callback adds `user.id` to the token; `session` callback surfaces it on `session.user.id`
- See the **auth-js** skill for provider setup, adapter configuration, and token handling
- See the **drizzle** skill for the auth tables schema

---

## Tailwind v4 CSS-First Theming

No `tailwind.config.js`. Theme is defined in CSS via `@theme`:

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme {
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-background: #ffffff;
  --color-foreground: #0f172a;
  --color-muted: #f1f5f9;
  --color-muted-foreground: #64748b;
  --color-border: #e2e8f0;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}
```

These tokens become utility classes: `bg-primary`, `text-muted-foreground`, `border-border`. PostCSS config uses `@tailwindcss/postcss` (not the legacy `tailwindcss` plugin). See the **tailwind** skill for the full v4 migration and dark mode patterns.

---

## Transpiling Source-Only Packages

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@socialhub/shared", "@socialhub/db", "@socialhub/ui"],
};

export default nextConfig;
```

Internal packages export raw `.ts` — Next.js compiles them via `transpilePackages`. NEVER add a `build` script to these packages. Changes take effect immediately without rebuilds.

---

## Anti-Patterns

### WARNING: useEffect for Data Fetching

**The Problem:**

```tsx
// BAD — manual fetch in useEffect
"use client";
import { useState, useEffect } from "react";

export default function FeedPage() {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    fetch("/api/posts").then((r) => r.json()).then(setPosts);
  }, []);
  return <div>{/* render posts */}</div>;
}
```

**Why This Breaks:**
1. Race conditions on fast navigation — stale data overwrites fresh data
2. No caching, deduplication, or background refresh
3. No loading/error states without additional boilerplate

**The Fix:** Use tRPC React hooks (which wrap TanStack Query):

```tsx
"use client";
import { trpc } from "@/lib/trpc/react";

export default function FeedPage() {
  const { data: posts, isLoading } = trpc.post.feed.useQuery();
  if (isLoading) return <div>Loading...</div>;
  return <div>{/* render posts */}</div>;
}
```

See the **tanstack-query** skill for caching, prefetching, and invalidation patterns.

### WARNING: Importing Server-Only Code in Client Components

**The Problem:**

```tsx
// BAD — importing DB client in a client component
"use client";
import { createDb } from "@socialhub/db"; // This bundles postgres.js into the browser

export default function SettingsPage() {
  // ...
}
```

**Why This Breaks:** Node.js modules (`postgres`, `crypto`) get bundled into client JS, causing build errors or runtime crashes.

**The Fix:** Keep DB/server imports in server components, Route Handlers, or Server Actions. Pass data down via props or use tRPC.
