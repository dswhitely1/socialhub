// TODO: Platform adapter pattern
// Each social platform will have its own adapter implementing a common interface.

import type { Platform } from "@socialhub/shared";

export interface PlatformAdapter {
  fetchFeed(accessToken: string, cursor?: string): Promise<unknown[]>;
  fetchNotifications(accessToken: string): Promise<unknown[]>;
  publishPost(accessToken: string, content: string): Promise<unknown>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string }>;
}

const adapters = new Map<Platform, PlatformAdapter>();

export function getPlatformAdapter(platform: Platform): PlatformAdapter | undefined {
  return adapters.get(platform);
}

export function registerPlatformAdapter(platform: Platform, adapter: PlatformAdapter) {
  adapters.set(platform, adapter);
}
