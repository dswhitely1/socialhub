import { getMeiliSearch } from "../lib/meilisearch.js";

const POSTS_INDEX = "posts";

export async function indexPost(post: {
  id: string;
  content: string;
  authorName: string;
  platform: string;
}) {
  const meili = getMeiliSearch();
  const index = meili.index(POSTS_INDEX);
  await index.addDocuments([post]);
}

export async function searchPosts(query: string, limit = 20) {
  const meili = getMeiliSearch();
  const index = meili.index(POSTS_INDEX);
  return index.search(query, { limit });
}
