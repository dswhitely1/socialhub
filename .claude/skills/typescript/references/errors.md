# Error Handling Reference

## Contents
- tRPC Error Throwing
- Zod Validation Errors
- Server Startup Failure
- Exhaustive Never Checks
- Common Type Errors and Fixes
- WARNING: Anti-Patterns

---

## tRPC Error Throwing

Use `TRPCError` with appropriate HTTP-equivalent codes:

```typescript
import { TRPCError } from "@trpc/server";

// Authentication failure
throw new TRPCError({ code: "UNAUTHORIZED" });

// Missing resource
throw new TRPCError({
  code: "NOT_FOUND",
  message: `Post ${postId} not found`,
});

// Forbidden (authenticated but not allowed)
throw new TRPCError({
  code: "FORBIDDEN",
  message: "You can only modify your own posts",
});

// Bad input (when Zod validation isn't sufficient)
throw new TRPCError({
  code: "BAD_REQUEST",
  message: "Cannot connect to a platform that is already connected",
});

// Rate limiting
throw new TRPCError({
  code: "TOO_MANY_REQUESTS",
  message: "Rate limit exceeded",
});
```

**Common codes:** `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `BAD_REQUEST` (400), `TOO_MANY_REQUESTS` (429), `INTERNAL_SERVER_ERROR` (500).

---

## Zod Validation Errors

Zod provides two validation modes:

```typescript
import { z } from "zod";

// .parse() — throws ZodError on failure (use in tRPC inputs)
const user = userSchema.parse(input);
// If input is invalid, tRPC catches the ZodError and returns BAD_REQUEST

// .safeParse() — returns result object (use in services/utilities)
const result = userSchema.safeParse(input);
if (!result.success) {
  console.error("Validation failed:", result.error.flatten());
  // result.error.flatten() gives: { fieldErrors: { name: ["Required"], ... } }
}
const user = result.data; // typed correctly
```

**In tRPC:** Input validation via `.input(schema)` uses `.parse()` internally. Failed validation automatically returns a `BAD_REQUEST` error to the client with field-level error details.

**In services:** Use `.safeParse()` when you want to handle errors without throwing (e.g., validating cached data from Redis).

---

## Server Startup Failure

Environment validation fails at import time if variables are missing:

```typescript
// apps/api/src/env.ts
export const env = envSchema.parse(process.env);
// If DATABASE_URL is missing, throws ZodError immediately
```

**What you'll see:**

```
ZodError: [
  { code: "invalid_type", expected: "string", received: "undefined", path: ["DATABASE_URL"] }
]
```

**Fix:** Ensure `.env` file exists and has all required variables. Run `cp .env.example .env` for defaults.

---

## Exhaustive Never Checks

Use `never` to enforce exhaustive handling of union types:

```typescript
import type { Platform } from "@socialhub/shared";

function getPlatformColor(platform: Platform): string {
  switch (platform) {
    case "twitter": return "#1DA1F2";
    case "instagram": return "#E4405F";
    case "linkedin": return "#0A66C2";
    case "bluesky": return "#0085FF";
    case "mastodon": return "#6364FF";
    default: {
      const _exhaustive: never = platform;
      throw new Error(`Unhandled platform: ${_exhaustive}`);
    }
  }
}
```

If a new platform is added to the `PLATFORMS` const array, TypeScript will error at the `never` assignment because the new value isn't handled. This prevents silent fallthrough bugs.

---

## Common Type Errors and Fixes

### 1. "Type 'string' is not assignable to type 'Platform'"

```typescript
// BAD
const platform: string = req.query.platform;
getPlatformAdapter(platform); // Error: string is not Platform

// FIX — validate through Zod
import { PLATFORMS } from "@socialhub/shared";
const platform = z.enum(PLATFORMS).parse(req.query.platform);
```

### 2. "Property 'userId' does not exist on type 'Context'"

```typescript
// This means you're in a publicProcedure where ctx.userId is string | null
// FIX — use protectedProcedure, or check for null:
if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
```

### 3. "Argument of type 'X' is not assignable to parameter of type 'never'"

```typescript
// Usually means a union is fully narrowed. Check your switch/if branches
// cover all cases, or that you're not mixing incompatible types.
```

### 4. "Cannot find module '@socialhub/shared' or its type declarations"

```typescript
// FIX — ensure the package has "exports" in package.json:
// "exports": { ".": "./src/index.ts" }
// And the consuming app has it in dependencies:
// "@socialhub/shared": "workspace:*"
```

### 5. "Import assertions are not supported"

```typescript
// BAD — import assertions deprecated in favor of import attributes
import data from "./data.json" assert { type: "json" };

// FIX — use import attributes (or just use fs.readFileSync for JSON)
import data from "./data.json" with { type: "json" };
```

---

## WARNING: Swallowing Errors in try/catch

**The Problem:**

```typescript
// BAD — error disappears silently
try {
  await platformAdapter.fetchFeed(token);
} catch {
  return []; // empty feed, no one knows why
}
```

**Why This Breaks:**
1. Token expiry, rate limiting, network errors all produce an empty feed
2. No logging means no debugging — issues are invisible
3. Users see stale or empty data with no explanation

**The Fix:** Log the error and throw a meaningful tRPC error:

```typescript
try {
  return await platformAdapter.fetchFeed(token);
} catch (error) {
  req.log.error({ error, platform }, "Feed fetch failed");
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Failed to fetch ${platform} feed`,
  });
}
```

---

## WARNING: Throwing Strings

**The Problem:**

```typescript
// BAD — no stack trace, not an Error instance
throw "Something went wrong";
throw `User ${id} not found`;
```

**Why This Breaks:**
1. String throws have no stack trace — impossible to debug
2. `catch (error)` gives you a string, not an Error — `.message` and `.stack` don't exist
3. Error tracking tools (Sentry) can't properly group or categorize string throws

**The Fix:** Always throw Error instances (or TRPCError in procedures):

```typescript
// GOOD
throw new Error(`User ${id} not found`);
throw new TRPCError({ code: "NOT_FOUND", message: `User ${id} not found` });
```

---

## WARNING: try/catch for Control Flow

**The Problem:**

```typescript
// BAD — using exceptions for expected conditions
try {
  const user = userSchema.parse(input);
  return user;
} catch {
  return null; // "not found" via exception
}
```

**Why This Breaks:** Exceptions are for exceptional conditions. Using them for expected outcomes (like "input might be invalid") obscures intent and adds overhead.

**The Fix:** Use `.safeParse()` for expected validation failures:

```typescript
// GOOD — explicit control flow
const result = userSchema.safeParse(input);
return result.success ? result.data : null;
```
