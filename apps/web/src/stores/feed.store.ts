import { create } from "zustand";
import type { Platform } from "@socialhub/shared";

interface FeedState {
  selectedPlatform: Platform | null;
  orderBy: "chronological" | "relevance";
  setSelectedPlatform: (platform: Platform | null) => void;
  setOrderBy: (orderBy: "chronological" | "relevance") => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  selectedPlatform: null,
  orderBy: "chronological",
  setSelectedPlatform: (platform) => set({ selectedPlatform: platform }),
  setOrderBy: (orderBy) => set({ orderBy }),
}));
