---
name: auth-js
description: |
  Configures OAuth flows, JWT sessions, and Auth.js with Drizzle adapter.
  Use when: setting up or modifying Auth.js configuration, adding OAuth providers,
  working with JWT callbacks, implementing auth middleware, wiring sign-in/sign-out flows,
  verifying JWTs on the API server, or managing auth state on mobile.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Auth.js Skill

SocialHub uses **Auth.js v5 (next-auth beta)** on the Next.js web app with the **Drizzle adapter**, **JWT session strategy**, and Google/GitHub OAuth providers. The API server (Fastify) verifies those JWTs via a shared `AUTH_SECRET`. Mobile (Expo) stores tokens in `expo-secure-store` and sends them as Bearer headers. Auth tables live in `packages/db/src/schema/auth.ts`.

## Quick Start

### Auth.js Configuration (Web)

```typescript
// apps/web/src/lib/auth/auth.ts
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

### API Route Handler

```typescript
// apps/web/src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth/auth";
export const { GET, POST } = handlers;
```

### Triggering Sign-In from Client Components

```typescript
"use client";
import { signIn } from "next-auth/react";

function LoginButton() {
  return <button onClick={() => signIn("google", { callbackUrl: "/feed" })}>Sign in with Google</button>;
}
```

## Key Concepts

| Concept | Location | Notes |
|---------|----------|-------|
| Auth config | `apps/web/src/lib/auth/auth.ts` | Exports `auth`, `signIn`, `signOut`, `handlers` |
| Route handler | `apps/web/src/app/api/auth/[...nextauth]/route.ts` | Catch-all for OAuth callbacks |
| Middleware | `apps/web/src/middleware.ts` | Wraps `auth()` to protect dashboard routes |
| Auth DB tables | `packages/db/src/schema/auth.ts` | `accounts`, `sessions`, `verificationTokens` |
| Users table | `packages/db/src/schema/users.ts` | UUID PK, linked to auth tables |
| JWT verification | `apps/api/src/services/auth.service.ts` | Verifies Auth.js JWTs on API side |
| Mobile tokens | `apps/mobile/src/lib/auth.ts` | `expo-secure-store` helpers |
| Mobile auth state | `apps/mobile/src/stores/auth.store.ts` | Zustand store for auth state |

## Common Patterns

### Protecting Routes with Middleware

```typescript
// apps/web/src/middleware.ts
import { auth } from "@/lib/auth/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthRoute = req.nextUrl.pathname.startsWith("/login");
  const isDashboardRoute = req.nextUrl.pathname.startsWith("/feed") ||
    req.nextUrl.pathname.startsWith("/notifications");

  if (isDashboardRoute && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
  if (isAuthRoute && isLoggedIn) {
    return Response.redirect(new URL("/feed", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

### Getting Session in Server Components

```typescript
import { auth } from "@/lib/auth/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <h1>Welcome, {session.user.name}</h1>;
}
```

## See Also

- [patterns](references/patterns.md) - JWT callbacks, Drizzle adapter schema, provider config
- [workflows](references/workflows.md) - Adding providers, API JWT verification, mobile auth

## Related Skills

- See the **drizzle** skill for auth table schema definitions
- See the **fastify** skill for API server plugin architecture
- See the **trpc** skill for `protectedProcedure` and auth context
- See the **react** skill for client-side `signIn()` integration
- See the **react-native** skill for Expo SecureStore token handling
- See the **zod** skill for env validation of `AUTH_SECRET`
- See the **typescript** skill for type augmentation of session objects

## Documentation Resources

> Fetch latest Auth.js documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "auth-js"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/authjs_dev` _(website docs, benchmark 87.4)_

**Recommended Queries:**
- "Auth.js Drizzle adapter configuration"
- "Auth.js JWT session callbacks"
- "Auth.js middleware route protection Next.js"
- "Auth.js OAuth providers Google GitHub"
