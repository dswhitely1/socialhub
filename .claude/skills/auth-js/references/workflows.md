# Auth.js Workflows Reference

## Contents
- Adding a New OAuth Provider
- Wiring Sign-In Buttons
- Sending Auth Headers from Web tRPC Client
- Implementing API JWT Verification
- Type-Augmenting the Session Object
- Environment Variable Setup
- Auth Debugging Checklist

## Adding a New OAuth Provider

Copy this checklist and track progress:
- [ ] Step 1: Install provider if not bundled (most are built into `next-auth`)
- [ ] Step 2: Add provider to `apps/web/src/lib/auth/auth.ts`
- [ ] Step 3: Add env vars to `.env` and `apps/api/src/env.ts` if API needs them
- [ ] Step 4: Add sign-in button to login page
- [ ] Step 5: Test OAuth callback at `/api/auth/callback/<provider>`
- [ ] Step 6: Verify `accounts` row created in database

### Step 2: Add Provider to Auth Config

```typescript
// apps/web/src/lib/auth/auth.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Discord from "next-auth/providers/discord"; // NEW

export const { handlers, signIn, signOut, auth } = NextAuth({
  // ...existing config
  providers: [Google, GitHub, Discord], // Add to array
});
```

Auth.js auto-reads `AUTH_<PROVIDER>_ID` and `AUTH_<PROVIDER>_SECRET` from env vars. For Discord, set `AUTH_DISCORD_ID` and `AUTH_DISCORD_SECRET`.

### Step 4: Add Sign-In Button

```typescript
"use client";
import { signIn } from "next-auth/react";

function DiscordLoginButton() {
  return (
    <button onClick={() => signIn("discord", { callbackUrl: "/feed" })}>
      Sign in with Discord
    </button>
  );
}
```

**IMPORTANT:** Use `"next-auth/react"` for client component `signIn()`. The `signIn` from `@/lib/auth/auth` is for **server actions only**.

## Wiring Sign-In Buttons

Two approaches depending on component type:

### Client Component (onClick handler)

```typescript
"use client";
import { signIn, signOut } from "next-auth/react";

function AuthButtons() {
  return (
    <>
      <button onClick={() => signIn("google", { callbackUrl: "/feed" })}>Google</button>
      <button onClick={() => signIn("github", { callbackUrl: "/feed" })}>GitHub</button>
      <button onClick={() => signOut({ callbackUrl: "/login" })}>Sign Out</button>
    </>
  );
}
```

### Server Action (form submission)

```typescript
import { signIn } from "@/lib/auth/auth";

export default function LoginPage() {
  return (
    <form action={async () => {
      "use server";
      await signIn("google", { redirectTo: "/feed" });
    }}>
      <button type="submit">Sign in with Google</button>
    </form>
  );
}
```

**Key difference:** Server action uses `redirectTo`, client uses `callbackUrl`. Mixing them up causes silent redirect failures.

## Sending Auth Headers from Web tRPC Client

The web tRPC client must extract the JWT from the Auth.js session cookie and send it to the API. Use `getSession()` or pass the token via a custom header function:

```typescript
// apps/web/src/lib/trpc/react.tsx
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import { getSession } from "next-auth/react";
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
          async headers() {
            const session = await getSession();
            // Auth.js encodes the full JWT in the session token cookie
            // For cross-origin API calls, extract and forward it
            return session ? { authorization: `Bearer ${session.accessToken}` } : {};
          },
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

**Alternative approach:** Use a server-side tRPC caller from Next.js server components that reads the session directly via `auth()`, bypassing the need to send headers from the browser. See the **trpc** skill.

## Implementing API JWT Verification

Full workflow for wiring JWT verification into the Fastify API:

Copy this checklist and track progress:
- [ ] Step 1: Install `jose` in `apps/api/`
- [ ] Step 2: Implement `verifyToken()` in `apps/api/src/services/auth.service.ts`
- [ ] Step 3: Call `verifyToken()` in `apps/api/src/trpc/context.ts`
- [ ] Step 4: Validate with `pnpm typecheck`

### Step 1: Install jose

```bash
pnpm --filter @socialhub/api add jose
```

### Step 2: Implement verifyToken

```typescript
// apps/api/src/services/auth.service.ts
import { jwtVerify } from "jose";
import { env } from "../env.js";

const secret = new TextEncoder().encode(env.AUTH_SECRET);

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload.id === "string") return { userId: payload.id };
    return null;
  } catch {
    return null;
  }
}
```

**Why `jose` over `jsonwebtoken`:** `jose` is ESM-native, has zero dependencies, and works in edge runtimes. Auth.js itself uses `jose` internally. `jsonwebtoken` is CJS-only and pulls in multiple transitive deps.

### Step 3: Wire into tRPC Context

```typescript
// apps/api/src/trpc/context.ts
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { getDb } from "../lib/db.js";
import { verifyToken } from "../services/auth.service.js";

export async function createContext({ req }: CreateFastifyContextOptions) {
  const db = getDb();
  const token = req.headers.authorization?.replace("Bearer ", "");
  const verified = token ? await verifyToken(token) : null;
  return { db, token, userId: verified?.userId ?? null };
}
```

### Validation Loop

1. Make changes
2. Validate: `pnpm typecheck`
3. If typecheck fails, fix type errors and repeat step 2
4. Test: start API with `pnpm --filter @socialhub/api dev` and call a `protectedProcedure`

## Type-Augmenting the Session Object

Auth.js v5 uses module augmentation for custom session fields. Add a declaration file:

```typescript
// apps/web/src/types/next-auth.d.ts
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string | null;
    };
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken?: string;
  }
}
```

See the **typescript** skill for module augmentation patterns.

## Environment Variable Setup

Required env vars for auth to work:

```bash
# .env (project root)
AUTH_SECRET="$(openssl rand -base64 32)"  # Generate a real secret
AUTH_URL="http://localhost:3000"           # Must match web app origin

# Provider credentials (get from provider developer console)
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"
```

**CRITICAL:** `AUTH_SECRET` must be identical in both the web app (Auth.js reads it automatically) and the API server (validated in `apps/api/src/env.ts` via Zod). If they differ, JWT verification fails silently. See the **zod** skill for env validation patterns.

### WARNING: Different AUTH_SECRET Between Services

**The Problem:**

```bash
# Web .env
AUTH_SECRET="secret-a"
# API .env (or missing entirely)
AUTH_SECRET="secret-b"
```

**Why This Breaks:**
1. Auth.js signs JWTs with `secret-a`
2. API tries to verify with `secret-b`
3. Every `protectedProcedure` call returns `UNAUTHORIZED`
4. No error in logs — `jose` just returns verification failure

**The Fix:** Use a single `.env` file at the project root. Both apps read from it. The API validates `AUTH_SECRET` presence via Zod in `apps/api/src/env.ts`.

## Auth Debugging Checklist

When auth isn't working, check in this order:

Copy this checklist and track progress:
- [ ] `.env` has `AUTH_SECRET` set (not the placeholder)
- [ ] `.env` has `AUTH_URL` matching the web app origin exactly
- [ ] OAuth provider credentials are set (`AUTH_GOOGLE_ID`, etc.)
- [ ] OAuth provider callback URL configured: `http://localhost:3000/api/auth/callback/google`
- [ ] Route handler exists at `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- [ ] Middleware matcher excludes `/api` routes (so callbacks aren't blocked)
- [ ] `accounts` table exists in database (run `pnpm db:push`)
- [ ] API server reads the same `AUTH_SECRET` as the web app
- [ ] tRPC client sends `Authorization: Bearer <token>` header
- [ ] API context calls `verifyToken()` and populates `ctx.userId`
