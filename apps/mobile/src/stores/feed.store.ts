import { create } from "zustand";
import type { Platform } from "@socialhub/shared";

interface FeedState {
  selectedPlatform: Platform | null;
  setSelectedPlatform: (platform: Platform | null) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  selectedPlatform: null,
  setSelectedPlatform: (platform) => set({ selectedPlatform: platform }),
}));
