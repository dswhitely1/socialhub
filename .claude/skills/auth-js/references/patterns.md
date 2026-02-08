# Auth.js Patterns Reference

## Contents
- JWT Session Strategy with Drizzle Adapter
- JWT Callbacks: Embedding Custom Claims
- Drizzle Adapter Schema Requirements
- Auth Middleware Pattern
- Server Component Session Access
- API-Side JWT Verification
- Mobile Token Management
- WARNING: Session Strategy Mismatch
- WARNING: Missing SessionProvider
- WARNING: Exposing Internal Errors

## JWT Session Strategy with Drizzle Adapter

Auth.js supports both `jwt` and `database` session strategies. SocialHub uses **JWT** because the API server (Fastify, separate process) needs to verify tokens without DB round-trips. The Drizzle adapter still stores `accounts` and `users` in PostgreSQL — it just skips the `sessions` table at runtime.

```typescript
// apps/web/src/lib/auth/auth.ts
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [Google, GitHub],
  session: { strategy: "jwt" }, // CRITICAL: must be "jwt" for cross-service auth
});
```

**Why JWT over database sessions:** The Fastify API runs on port 4000, separate from Next.js on port 3000. Database sessions would require the API to query the sessions table on every request. JWTs are self-contained and verified with `AUTH_SECRET` alone.

## JWT Callbacks: Embedding Custom Claims

The `jwt` and `session` callbacks work as a pipeline. The `jwt` callback fires first and adds data to the token. The `session` callback then reads from the token and attaches data to the session object exposed to components.

```typescript
callbacks: {
  jwt({ token, user }) {
    // `user` is only defined on initial sign-in, not on subsequent requests
    if (user) token.id = user.id;
    return token;
  },
  session({ session, token }) {
    if (session.user && token.id) session.user.id = token.id as string;
    return session;
  },
},
```

### WARNING: Missing User ID in JWT

**The Problem:**

```typescript
// BAD - Forgetting to pass user.id into the token
callbacks: {
  session({ session, user }) {
    session.user.id = user.id; // user is UNDEFINED with JWT strategy
    return session;
  },
},
```

**Why This Breaks:**
1. With `strategy: "jwt"`, the `session` callback receives `token`, not `user`
2. The `user` param is only available with `strategy: "database"`
3. You MUST pass data through the `jwt` callback first, then read it in `session`

**The Fix:** Always chain `jwt` -> `session` callbacks as shown above.

## Drizzle Adapter Schema Requirements

The Drizzle adapter expects specific table names and column names. See the **drizzle** skill for schema conventions. The auth tables in `packages/db/src/schema/auth.ts` must match Auth.js expectations:

```typescript
// packages/db/src/schema/auth.ts
import { pgTable, uuid, varchar, text, timestamp, integer, primaryKey } from "drizzle-orm/pg-core";
import { users } from "./users";

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);
```

**IMPORTANT:** `refresh_token`, `access_token`, `id_token` use **snake_case** column names — this is required by the Auth.js Drizzle adapter. Do not rename them to camelCase.

## Auth Middleware Pattern

The web middleware wraps Auth.js's `auth()` function to protect routes. NEVER put auth checks inside individual page components when middleware can handle it.

```typescript
// apps/web/src/middleware.ts
import { auth } from "@/lib/auth/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthRoute = req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/register");
  const isDashboardRoute =
    req.nextUrl.pathname.startsWith("/feed") ||
    req.nextUrl.pathname.startsWith("/notifications") ||
    req.nextUrl.pathname.startsWith("/platforms") ||
    req.nextUrl.pathname.startsWith("/settings");

  if (isDashboardRoute && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }
  if (isAuthRoute && isLoggedIn) {
    return Response.redirect(new URL("/feed", req.nextUrl));
  }
});
```

**When adding new protected routes:** Add the path prefix to `isDashboardRoute`. Do NOT create separate auth checks in page components.

## Server Component Session Access

Use `auth()` directly in server components — no hook needed:

```typescript
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // session.user.id, session.user.name, session.user.email available
}
```

For client components, use `useSession()` from `next-auth/react` (requires `SessionProvider` in the layout). See the **react** skill for provider patterns.

## API-Side JWT Verification

The API server verifies Auth.js JWTs using `jose`. The `AUTH_SECRET` env var must be identical between web and API. See the **fastify** skill for plugin integration.

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

Wire this into tRPC context (see the **trpc** skill):

```typescript
// apps/api/src/trpc/context.ts
import { verifyToken } from "../services/auth.service.js";

export async function createContext({ req }: CreateFastifyContextOptions) {
  const db = getDb();
  const token = req.headers.authorization?.replace("Bearer ", "");
  const verified = token ? await verifyToken(token) : null;
  return { db, token, userId: verified?.userId ?? null };
}
```

## Mobile Token Management

Mobile stores the JWT in `expo-secure-store` and attaches it as a Bearer header. See the **react-native** skill for Expo-specific patterns.

```typescript
// apps/mobile/src/lib/auth.ts
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth_token";

export async function getAuthToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeAuthToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
```

### WARNING: Session Strategy Mismatch

**The Problem:**

```typescript
// BAD - Using database strategy with a separate API server
session: { strategy: "database" },
```

**Why This Breaks:**
1. Database sessions require the consuming service to query the `sessions` table
2. The Fastify API on port 4000 would need direct DB access for every auth check
3. JWT strategy is self-contained — verify with `AUTH_SECRET` alone, no DB call

**The Fix:** Always use `strategy: "jwt"` when the API server is a separate process.

### WARNING: Missing SessionProvider

**The Problem:**

```typescript
// BAD - Using useSession() without SessionProvider
"use client";
import { useSession } from "next-auth/react";

function Header() {
  const { data: session } = useSession(); // Throws: no SessionProvider
}
```

**Why This Breaks:** `useSession()` requires `SessionProvider` in the component tree. In this codebase, prefer `auth()` in server components. If you must use `useSession()` in client components, wrap the layout with `SessionProvider`.

### WARNING: Exposing Internal Errors

**The Problem:**

```typescript
// BAD - Leaking JWT verification internals
export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret); // Throws on invalid token
  return payload;
}
```

**Why This Breaks:**
1. `jwtVerify` throws `JWSInvalid`, `JWTExpired`, etc. with internal details
2. These errors propagate to tRPC and may leak to the client
3. Attackers can use error messages to probe token structure

**The Fix:** Wrap in try/catch and return `null` for any failure. The tRPC `isAuthed` middleware already handles null by throwing `UNAUTHORIZED`.
