# Auth Reference

## Contents
- Auth Architecture
- Context Creation
- Auth Middleware
- Protected Procedures
- WARNING: Forgetting Auth on Sensitive Endpoints
- Client Auth Headers
- JWT Verification Workflow

## Auth Architecture

```
Web (Auth.js) ──JWT──► API (Bearer header) ──► Context ──► isAuthed middleware
Mobile (SecureStore) ──Bearer──► API ──► same flow
```

- **Web:** Auth.js handles OAuth (Google, GitHub), issues JWT sessions. See the **auth-js** skill.
- **Mobile:** Tokens stored in `expo-secure-store`, sent as `Authorization: Bearer <token>`.
- **API:** Extracts token from headers in context, validates in middleware.
- **Shared secret:** `AUTH_SECRET` env var used by both Auth.js and API for JWT verification.

## Context Creation

`apps/api/src/trpc/context.ts` — runs on every request:

```typescript
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { getDb } from "../lib/db.js";

export async function createContext({ req }: CreateFastifyContextOptions) {
  const db = getDb();
  const token = req.headers.authorization?.replace("Bearer ", "");

  return {
    db,
    token,
    userId: null as string | null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

The context provides `db`, `token`, and `userId` to all procedures. Currently `userId` is set to `null` and resolved in middleware — this is where JWT verification should decode the token and populate `userId`.

## Auth Middleware

`apps/api/src/trpc/trpc.ts` — the `isAuthed` middleware:

```typescript
const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // narrows type from string | null to string
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);
```

**Key behavior:**
- Throws `UNAUTHORIZED` if `ctx.userId` is falsy
- Narrows `userId` from `string | null` to `string` in downstream handlers
- All protected procedures get guaranteed non-null `ctx.userId`

## Protected Procedures

```typescript
// ctx.userId is guaranteed string (not null)
me: protectedProcedure.query(async ({ ctx }) => {
  return { id: ctx.userId, name: "TODO", email: "TODO" };
}),

update: protectedProcedure
  .input(updateUserSchema)
  .mutation(async ({ ctx, input }) => {
    // Safe to use ctx.userId — middleware already validated
    return { id: ctx.userId, ...input };
  }),
```

## WARNING: Forgetting Auth on Sensitive Endpoints

**The Problem:**

```typescript
// BAD — uses publicProcedure for data modification
deleteAccount: publicProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input }) => {
    // Anyone can delete any account!
    await db.delete(users).where(eq(users.id, input.id));
  }),
```

**Why This Breaks:**
1. Unauthenticated users can call the endpoint
2. No `ctx.userId` to verify ownership — any user can delete any account
3. Security vulnerability: horizontal privilege escalation

**The Fix:**

```typescript
// GOOD — protected + ownership check
deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
  // Only deletes the authenticated user's own account
  await db.delete(users).where(eq(users.id, ctx.userId));
  return { deleted: true };
}),
```

**Rule of thumb:** If a procedure reads or writes user-specific data, use `protectedProcedure`. Use `publicProcedure` only for truly public data (health checks, public profiles, app metadata).

## WARNING: Trusting Client-Provided User IDs

**The Problem:**

```typescript
// BAD — userId comes from input, not from auth context
update: protectedProcedure
  .input(z.object({ userId: z.string().uuid(), name: z.string() }))
  .mutation(async ({ input }) => {
    await db.update(users).set({ name: input.name }).where(eq(users.id, input.userId));
  }),
```

**Why This Breaks:** Authenticated user A can modify user B's data by passing B's ID.

**The Fix:**

```typescript
// GOOD — always use ctx.userId for ownership
update: protectedProcedure
  .input(z.object({ name: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await db.update(users).set({ name: input.name }).where(eq(users.id, ctx.userId));
  }),
```

## Client Auth Headers

### Web (Next.js)

Currently no auth header is sent from web — Auth.js uses cookies for session management. The API context would need cookie-based auth or the web client needs to send the JWT:

```typescript
// apps/web/src/lib/trpc/react.tsx
httpBatchLink({
  url: `${process.env.NEXT_PUBLIC_API_URL}/trpc`,
  transformer: superjson,
  // TODO: add auth headers when JWT verification is implemented
}),
```

### Mobile (Expo)

`apps/mobile/src/lib/trpc.ts` sends Bearer tokens from SecureStore:

```typescript
httpBatchLink({
  url: `${API_URL}/trpc`,
  transformer: superjson,
  async headers() {
    const token = await SecureStore.getItemAsync("auth_token");
    return token ? { authorization: `Bearer ${token}` } : {};
  },
}),
```

The `headers()` function is async — called on every request to get the latest token.

## JWT Verification Workflow

When implementing full JWT verification:

Copy this checklist and track progress:
- [ ] Install `jose` or use Auth.js JWT helpers in the API
- [ ] In `createContext`, decode the Bearer token using `AUTH_SECRET`
- [ ] Set `userId` from the decoded JWT payload
- [ ] Ensure `AUTH_SECRET` env var matches between web (Auth.js) and API
- [ ] Test with both web and mobile clients
- [ ] Run `pnpm typecheck` to verify context type still matches

```typescript
// Example context with JWT verification
import { jwtVerify } from "jose";

export async function createContext({ req }: CreateFastifyContextOptions) {
  const db = getDb();
  const token = req.headers.authorization?.replace("Bearer ", "");

  let userId: string | null = null;
  if (token) {
    try {
      const secret = new TextEncoder().encode(env.AUTH_SECRET);
      const { payload } = await jwtVerify(token, secret);
      userId = payload.sub ?? null;
    } catch {
      // Invalid token — userId stays null, protectedProcedure will reject
    }
  }

  return { db, token, userId };
}
```
