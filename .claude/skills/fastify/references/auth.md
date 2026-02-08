# Auth Reference

## Contents
- Auth Architecture
- tRPC Auth Middleware
- Context Token Extraction
- JWT Verification Service
- Protected vs Public Procedures
- Anti-Patterns

## Auth Architecture

SocialHub uses a split auth model:

| Layer | Handles | Technology |
|-------|---------|------------|
| Web | OAuth flows, session creation | Auth.js (next-auth v5) |
| API | JWT verification, authorization | Custom service + tRPC middleware |
| Mobile | Token storage, Bearer headers | expo-secure-store |

Auth.js on the web side handles OAuth (Google, GitHub) and issues JWTs signed with `AUTH_SECRET`. The API server verifies those same JWTs using the shared secret. See the **auth-js** skill for the web-side setup.

## tRPC Auth Middleware

The `isAuthed` middleware gates all protected procedures:

```typescript
// apps/api/src/trpc/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";

const t = initTRPC.context<Context>().create({ transformer: superjson });

const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, userId: ctx.userId },  // narrows type to non-null
  });
});

export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
```

After `isAuthed`, `ctx.userId` is guaranteed `string` (not `string | null`). TypeScript narrows the type automatically.

## Context Token Extraction

Every tRPC request creates a context that extracts the Bearer token:

```typescript
// apps/api/src/trpc/context.ts
export async function createContext({ req }: CreateFastifyContextOptions) {
  const db = getDb();
  const token = req.headers.authorization?.replace("Bearer ", "");
  return {
    db,
    token,
    userId: null as string | null,  // set by auth verification
  };
}
```

**Current state:** `userId` is always `null` because `verifyToken` is not yet implemented. The context needs to call the auth service:

```typescript
// Future implementation in context.ts
export async function createContext({ req }: CreateFastifyContextOptions) {
  const db = getDb();
  const token = req.headers.authorization?.replace("Bearer ", "");
  let userId: string | null = null;

  if (token) {
    const payload = await verifyToken(token);
    userId = payload?.userId ?? null;
  }

  return { db, token, userId };
}
```

## JWT Verification Service

Currently a stub that needs implementation:

```typescript
// apps/api/src/services/auth.service.ts
export async function verifyToken(_token: string): Promise<{ userId: string } | null> {
  // TODO: verify JWT using AUTH_SECRET, decode payload
  return null;
}
```

**Implementation approach** using `jose` (Auth.js uses this internally):

```typescript
import { jwtVerify } from "jose";
import { env } from "../env.js";

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const secret = new TextEncoder().encode(env.AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.sub !== "string") return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
```

**Validation checklist for auth implementation:**
- [ ] Install `jose`: `pnpm --filter @socialhub/api add jose`
- [ ] Implement `verifyToken` in `auth.service.ts`
- [ ] Call `verifyToken` in `createContext`
- [ ] Test with a real Auth.js JWT from the web app
- [ ] Verify `protectedProcedure` correctly blocks unauthenticated requests

## Protected vs Public Procedures

```typescript
// Protected — requires valid JWT, ctx.userId guaranteed non-null
me: protectedProcedure.query(async ({ ctx }) => {
  // ctx.userId is string (not string | null)
  return getUserById(ctx.db, ctx.userId);
}),

// Public — no auth required, ctx.userId is null
getById: publicProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input }) => {
    return getPublicProfile(input.id);
  }),
```

**Default to `protectedProcedure`.** Only use `publicProcedure` for:
- Health checks
- Public profiles
- OAuth callback endpoints
- Unauthenticated search (if applicable)

## Anti-Patterns

### WARNING: Trusting Client-Sent User IDs

**The Problem:**

```typescript
// BAD — user can send any userId
update: publicProcedure
  .input(z.object({ userId: z.string(), name: z.string() }))
  .mutation(async ({ input }) => {
    await updateUser(input.userId, { name: input.name });
  }),
```

**Why This Breaks:** Any user can update any other user's profile by sending a different `userId`. This is an IDOR (Insecure Direct Object Reference) vulnerability.

**The Fix:** Always use `ctx.userId` from the auth middleware:

```typescript
// GOOD — userId from verified JWT, not user input
update: protectedProcedure
  .input(updateUserSchema)
  .mutation(async ({ ctx, input }) => {
    await updateUser(ctx.userId, input);
  }),
```

### WARNING: Skipping Auth on Sensitive Endpoints

Every procedure that reads or writes user data MUST use `protectedProcedure`. The auth middleware throws `UNAUTHORIZED` automatically — no manual checks needed.

### WARNING: Exposing Internal Auth Errors

```typescript
// BAD — leaks implementation details
if (!payload) {
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: `JWT verification failed: invalid signature for key ${env.AUTH_SECRET.slice(0, 5)}`,
  });
}

// GOOD — generic error, no details
if (!payload) {
  throw new TRPCError({ code: "UNAUTHORIZED" });
}
```

Log the detailed error server-side via `fastify.log.warn()`, never send it to the client.
