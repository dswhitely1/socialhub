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
