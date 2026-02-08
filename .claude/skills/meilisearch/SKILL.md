---
name: meilisearch
description: |
  Implements full-text search with Meilisearch 1.12 for cross-platform post and user search in SocialHub.
  Use when: adding search functionality, configuring indexes, indexing documents from platform adapters,
  building search tRPC procedures, or integrating search into BullMQ feed-polling jobs.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Meilisearch Skill

SocialHub uses Meilisearch v1.12 (Docker) with the `meilisearch@0.46.x` JS client for typo-tolerant full-text search across social media posts and users. The client lives in `apps/api/src/lib/meilisearch.ts` as a lazy singleton, the service layer in `apps/api/src/services/search.service.ts`, and the tRPC endpoint in `apps/api/src/trpc/routers/search.router.ts`.

## Quick Start

### Client Singleton

```typescript
// apps/api/src/lib/meilisearch.ts
import { MeiliSearch } from "meilisearch";
import { env } from "../env.js";

let meili: MeiliSearch | null = null;

export function getMeiliSearch(): MeiliSearch {
  if (!meili) {
    meili = new MeiliSearch({
      host: env.MEILI_URL,
      apiKey: env.MEILI_MASTER_KEY,
    });
  }
  return meili;
}
```

### Index and Search Documents

```typescript
// apps/api/src/services/search.service.ts
import { getMeiliSearch } from "../lib/meilisearch.js";

const POSTS_INDEX = "posts";

export async function indexPost(post: {
  id: string;
  content: string;
  authorName: string;
  platform: string;
}) {
  const meili = getMeiliSearch();
  await meili.index(POSTS_INDEX).addDocuments([post]);
}

export async function searchPosts(query: string, limit = 20) {
  const meili = getMeiliSearch();
  return meili.index(POSTS_INDEX).search(query, { limit });
}
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| Index | Collection of documents | `meili.index("posts")` |
| Primary key | Unique document ID | `id` field (auto-detected) |
| Filterable attrs | Enable `filter` param in search | `updateFilterableAttributes(["platform"])` |
| Sortable attrs | Enable `sort` param in search | `updateSortableAttributes(["publishedAt"])` |
| Searchable attrs | Fields included in text search | `updateSearchableAttributes(["content", "authorName"])` |
| Tasks | Async operations (index/settings) | `await meili.waitForTask(taskUid)` |
| Facets | Aggregate filter counts | `search("", { facets: ["platform"] })` |

## Common Patterns

### Configure Index Settings (run once on startup)

```typescript
export async function setupSearchIndexes() {
  const meili = getMeiliSearch();
  const postsIndex = meili.index(POSTS_INDEX);

  await postsIndex.updateSettings({
    searchableAttributes: ["content", "authorName", "authorHandle"],
    filterableAttributes: ["platform", "userId"],
    sortableAttributes: ["publishedAt", "likes"],
    typoTolerance: { minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
  });
}
```

### Search with Filters

```typescript
const results = await meili.index("posts").search("react native", {
  filter: ["platform = twitter"],
  sort: ["publishedAt:desc"],
  limit: 20,
  offset: 0,
});
```

### Batch Indexing (after feed polling)

```typescript
export async function indexPosts(posts: SearchablePost[]) {
  const meili = getMeiliSearch();
  const task = await meili.index(POSTS_INDEX).addDocuments(posts);
  await meili.waitForTask(task.taskUid);
}
```

## Infrastructure

- **Docker:** `getmeili/meilisearch:v1.12` on port `7700`
- **Env vars:** `MEILI_URL` (required, URL), `MEILI_MASTER_KEY` (required, string)
- **Startup:** `pnpm docker:up` starts the container
- **Dashboard:** `http://localhost:7700` (dev mode provides built-in search UI)

## See Also

- [patterns](references/patterns.md) — Index design, document structure, filtering, error handling
- [workflows](references/workflows.md) — Setup, indexing pipeline, search integration, debugging

## Related Skills

- See the **fastify** skill for Fastify plugin lifecycle (initialize indexes on server start)
- See the **trpc** skill for building type-safe search procedures
- See the **bullmq** skill for indexing documents during feed-polling jobs
- See the **drizzle** skill for querying PostgreSQL before indexing
- See the **postgresql** skill for posts/users table schema that feeds into search
- See the **redis** skill for caching search results
- See the **zod** skill for validating search input schemas

## Documentation Resources

> Fetch latest Meilisearch documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "meilisearch"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library IDs:**
- `/websites/meilisearch` — Official docs site (2140 snippets, score 92.8)
- `/meilisearch/meilisearch-js` — JS client SDK (30 snippets)

**Recommended Queries:**
- "index settings searchable filterable sortable attributes"
- "search with filters sort facets"
- "typo tolerance configuration"
- "addDocuments batch indexing primary key"
