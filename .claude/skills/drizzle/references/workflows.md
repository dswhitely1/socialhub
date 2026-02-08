# Drizzle Workflows Reference

## Contents
- Schema Push (Development)
- Migration Workflow (Production)
- Adding a New Table
- Seeding Data
- Drizzle Studio
- Client Setup
- Common Errors

## Schema Push (Development)

For local development, use `db:push` to sync schema directly to Postgres without generating migration files:

```bash
pnpm db:push
```

This reads `packages/db/drizzle.config.ts` and pushes the schema from `packages/db/src/schema/index.ts` to the database at `DATABASE_URL`. Fast iteration — no migration files to manage.

**When to use push vs migrate:**
- `db:push` — local dev, prototyping, schema iteration
- `db:migrate` — staging, production, CI/CD pipelines

## Migration Workflow (Production)

For production-safe schema changes, generate and apply migration files:

```bash
# 1. Generate migration SQL from schema diff
pnpm db:generate

# 2. Review generated SQL in packages/db/src/migrations/
# 3. Apply migrations
pnpm db:migrate
```

The config at `packages/db/drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

Copy this checklist and track progress:
- [ ] Step 1: Modify schema files in `packages/db/src/schema/`
- [ ] Step 2: Run `pnpm db:generate` to create migration SQL
- [ ] Step 3: Review generated migration in `packages/db/src/migrations/`
- [ ] Step 4: Run `pnpm db:push` to test locally
- [ ] Step 5: Run `pnpm typecheck` to verify types across the monorepo
- [ ] Step 6: Commit schema + migration files together

## Adding a New Table

### Step-by-Step

1. **Create the schema file** at `packages/db/src/schema/<name>.ts`:

```typescript
// packages/db/src/schema/bookmarks.ts
import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { posts } from "./posts";

export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

2. **Export from the barrel** — use extensionless import:

```typescript
// packages/db/src/schema/index.ts
export * from "./users";
export * from "./auth";
export * from "./posts";
export * from "./platforms";
export * from "./notifications";
export * from "./bookmarks"; // <-- new table, NO .js extension
```

3. **Push to database:**

```bash
pnpm db:push
```

4. **Add Zod schema** in `packages/shared/src/schemas/` to mirror the table. See the **zod** skill.

5. **Typecheck the monorepo** to verify nothing breaks:

```bash
pnpm typecheck
```

Validate-and-iterate loop:
1. Make schema changes
2. Run `pnpm db:push`
3. If push fails, fix schema issues and repeat step 2
4. Run `pnpm typecheck`
5. If typecheck fails, fix type issues and repeat step 4
6. Only proceed when both pass

## Seeding Data

The seed script lives at `packages/db/src/seed.ts` and runs with `tsx`:

```bash
pnpm db:seed
```

```typescript
// packages/db/src/seed.ts
import { createDb } from "./client";
import { users, posts, platformConnections } from "./schema/index";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const db = createDb(databaseUrl);

  console.log("Seeding database...");

  // Insert users first (other tables depend on user IDs)
  const [demoUser] = await db
    .insert(users)
    .values({ name: "Demo User", email: "demo@socialhub.dev" })
    .returning();

  // Insert platform connections
  await db.insert(platformConnections).values({
    userId: demoUser.id,
    platform: "twitter",
    platformUserId: "12345",
    platformUsername: "demouser",
    accessToken: "seed-token",
  });

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch(console.error);
```

**Seed script must call `process.exit(0)`** — postgres.js keeps the connection alive, so the process won't exit naturally.

## Drizzle Studio

Visual database browser:

```bash
pnpm db:studio
```

Opens a browser GUI at `https://local.drizzle.studio` for inspecting and editing data. Reads the same `drizzle.config.ts` for connection info.

## Client Setup

### Package Client Factory (`packages/db/src/client.ts`)

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

export function createDb(connectionString: string) {
  const client = postgres(connectionString);
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
```

Passing `{ schema }` enables the relational query API (`db.query.users.findMany()`). Without it, only the SQL-like API (`db.select().from(users)`) works.

### API Singleton (`apps/api/src/lib/db.ts`)

```typescript
import { createDb } from "@socialhub/db";
import { env } from "../env.js"; // .js extension for ESM in API files

let db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!db) {
    db = createDb(env.DATABASE_URL);
  }
  return db;
}
```

The singleton is injected into tRPC context at `apps/api/src/trpc/context.ts`, making `ctx.db` available in every procedure. See the **trpc** skill.

## Common Errors

### `Cannot find module "./users.js"` from drizzle-kit

**Cause:** Schema file uses `.js` extension in import.
**Fix:** Remove the extension — `import { users } from "./users"`.

### `relation "table_name" does not exist`

**Cause:** Schema was modified but not pushed.
**Fix:** Run `pnpm db:push` or `pnpm db:migrate`.

### `column "x" of relation "y" already exists`

**Cause:** Push conflicts with existing columns (often after renaming).
**Fix:** Run `pnpm docker:reset` to wipe local data, then `pnpm db:push` and `pnpm db:seed`.

### `TypeError: Cannot read properties of undefined (reading 'referencedTable')`

**Cause:** Circular import between schema files.
**Fix:** Use callback-style references: `.references(() => otherTable.id)` — Drizzle resolves these lazily.

### Process hangs after seed/script

**Cause:** postgres.js keeps the connection pool alive.
**Fix:** Call `process.exit(0)` at the end of standalone scripts.
