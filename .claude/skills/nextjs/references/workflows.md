# Next.js 15 Workflows Reference

## Contents
- Adding a New Route
- Adding a Protected Page with Data Fetching
- Configuring Auth.js Providers
- Adding Middleware Route Protection
- Environment Variables Checklist
- Build and Typecheck Validation

---

## Adding a New Route

Copy this checklist and track progress:
- [ ] Step 1: Decide route group — `(auth)` for public, `(dashboard)` for authenticated
- [ ] Step 2: Create directory under the route group: `app/(dashboard)/my-route/`
- [ ] Step 3: Create `page.tsx` — server component by default, add `"use client"` only if interactive
- [ ] Step 4: Add the route to the sidebar nav in `src/components/layout/sidebar.tsx`
- [ ] Step 5: Add the route to middleware protection if it requires auth
- [ ] Step 6: Run `pnpm typecheck` to verify

### Example: Adding a `/compose` Route

```tsx
// app/(dashboard)/compose/page.tsx
"use client";

import { trpc } from "@/lib/trpc/react";

export default function ComposePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Compose Post</h1>
      {/* Post composer UI */}
    </div>
  );
}
```

Then add to the sidebar navigation:

```tsx
// src/components/layout/sidebar.tsx — add to navItems array
const navItems = [
  { href: "/feed", label: "Feed" },
  { href: "/compose", label: "Compose" },  // new
  { href: "/notifications", label: "Notifications" },
  { href: "/platforms", label: "Platforms" },
  { href: "/settings", label: "Settings" },
];
```

And protect it in middleware:

```ts
// src/middleware.ts — add to isDashboardRoute check
const isDashboardRoute =
  req.nextUrl.pathname.startsWith("/feed") ||
  req.nextUrl.pathname.startsWith("/compose") ||  // new
  req.nextUrl.pathname.startsWith("/notifications") ||
  req.nextUrl.pathname.startsWith("/platforms") ||
  req.nextUrl.pathname.startsWith("/settings");
```

---

## Adding a Protected Page with Data Fetching

This workflow connects a page to the tRPC API with proper loading states.

Copy this checklist and track progress:
- [ ] Step 1: Define the tRPC procedure in `apps/api/src/trpc/routers/` (see the **trpc** skill)
- [ ] Step 2: Create the page as a client component with `"use client"`
- [ ] Step 3: Use `trpc.[router].[procedure].useQuery()` for data
- [ ] Step 4: Handle loading, error, and empty states
- [ ] Step 5: Verify the route is in the middleware protection list
- [ ] Step 6: Run `pnpm typecheck` across the monorepo

```tsx
// app/(dashboard)/feed/page.tsx
"use client";

import { trpc } from "@/lib/trpc/react";
import { useFeedStore } from "@/stores/feed.store";

export default function FeedPage() {
  const { selectedPlatform, orderBy } = useFeedStore();
  const { data: posts, isLoading, error } = trpc.post.feed.useQuery({
    platform: selectedPlatform,
    orderBy,
  });

  if (isLoading) return <div className="p-6">Loading feed...</div>;
  if (error) return <div className="p-6 text-red-500">Failed to load feed</div>;
  if (!posts?.length) return <div className="p-6 text-muted-foreground">No posts yet</div>;

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <article key={post.id} className="rounded-lg border border-border p-4">
          <p>{post.content}</p>
        </article>
      ))}
    </div>
  );
}
```

**Key:** Zustand stores hold UI/filter state (see the **zustand** skill). tRPC hooks handle server state — caching, background refresh, and deduplication happen automatically via TanStack Query (see the **tanstack-query** skill).

---

## Configuring Auth.js Providers

To add a new OAuth provider (e.g., Twitter/X):

Copy this checklist and track progress:
- [ ] Step 1: Add provider env vars to `.env` and `.env.example`
- [ ] Step 2: Import and register the provider in `src/lib/auth/auth.ts`
- [ ] Step 3: Add the sign-in button to the login page
- [ ] Step 4: Verify the callback URL is registered with the OAuth provider
- [ ] Step 5: Test the full OAuth flow locally

```ts
// src/lib/auth/auth.ts — adding Twitter provider
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Twitter from "next-auth/providers/twitter";  // new
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { createDb } from "@socialhub/db";

const db = createDb(process.env.DATABASE_URL!);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [Google, GitHub, Twitter],  // added
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

OAuth callback URL format: `http://localhost:3000/api/auth/callback/twitter`

See the **auth-js** skill for detailed provider configuration and the **drizzle** skill for auth table schemas.

---

## Adding Middleware Route Protection

The middleware uses Auth.js's wrapper to check authentication state.

### WARNING: Forgetting to Update the Middleware Matcher

**The Problem:**

```ts
// BAD — adding a new dashboard route but not protecting it
// The route /analytics is accessible without login
```

**Why This Breaks:** Unauthenticated users can access protected pages. The page may render with missing user data, causing runtime errors.

**The Fix:** Every dashboard route must appear in the `isDashboardRoute` check:

```ts
// src/middleware.ts
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isDashboardRoute =
    req.nextUrl.pathname.startsWith("/feed") ||
    req.nextUrl.pathname.startsWith("/compose") ||
    req.nextUrl.pathname.startsWith("/notifications") ||
    req.nextUrl.pathname.startsWith("/platforms") ||
    req.nextUrl.pathname.startsWith("/settings") ||
    req.nextUrl.pathname.startsWith("/analytics");  // new route

  if (isDashboardRoute && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }

  if (isAuthRoute && isLoggedIn) {
    return Response.redirect(new URL("/feed", req.nextUrl));
  }
});
```

**Validation loop:**
1. Add the route path to `isDashboardRoute`
2. Test: open the route in an incognito window
3. Verify it redirects to `/login`
4. If it doesn't redirect, check the `matcher` pattern and repeat

---

## Environment Variables Checklist

Web-specific env vars — all must be set for the app to function:

| Variable | Required | Where Used |
|----------|----------|------------|
| `NEXT_PUBLIC_API_URL` | Yes | tRPC client URL (browser-side) |
| `NEXT_PUBLIC_WS_URL` | Yes | Socket.IO client (browser-side) |
| `AUTH_SECRET` | Yes | Auth.js JWT signing |
| `AUTH_URL` | Yes | Auth.js base URL (`http://localhost:3000`) |
| `DATABASE_URL` | Yes | Auth.js Drizzle adapter (server-side only) |
| `AUTH_GOOGLE_ID` | For Google OAuth | Auth.js Google provider |
| `AUTH_GOOGLE_SECRET` | For Google OAuth | Auth.js Google provider |
| `AUTH_GITHUB_ID` | For GitHub OAuth | Auth.js GitHub provider |
| `AUTH_GITHUB_SECRET` | For GitHub OAuth | Auth.js GitHub provider |

### WARNING: Using `NEXT_PUBLIC_` for Secrets

**The Problem:**

```env
# BAD — this exposes the secret to the browser
NEXT_PUBLIC_AUTH_SECRET="my-secret"
```

**Why This Breaks:** `NEXT_PUBLIC_` variables are inlined into client-side JavaScript. Anyone can view them in the browser's dev tools.

**The Fix:** Only prefix with `NEXT_PUBLIC_` for values that are safe to expose (API URLs, feature flags). Secrets use unprefixed names and are only available server-side.

---

## Build and Typecheck Validation

Before committing changes to the web app:

```bash
# Typecheck the entire monorepo (catches cross-package type errors)
pnpm typecheck

# Build the web app specifically
pnpm --filter @socialhub/web build

# Lint
pnpm lint
```

**Validation loop:**
1. Make changes
2. Run `pnpm typecheck`
3. If typecheck fails, fix type errors and repeat step 2
4. Run `pnpm --filter @socialhub/web build`
5. If build fails, check for server/client boundary issues and repeat step 4
6. Only commit when both pass

Common build failures:
- **Server-only module in client component** — move import to server component or use tRPC
- **Missing `"use client"` directive** — add it if the component uses hooks, event handlers, or browser APIs
- **Type mismatch on tRPC procedures** — re-run `pnpm typecheck` from the root to catch cross-package issues. See the **typescript** skill for strict mode patterns
