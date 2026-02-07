"use client";

import { PLATFORMS, PLATFORM_DISPLAY_NAMES } from "@socialhub/shared";

export default function PlatformsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Connected Platforms</h1>
      <div className="space-y-3">
        {PLATFORMS.map((platform) => (
          <div
            key={platform}
            className="flex items-center justify-between rounded-lg border border-border p-4"
          >
            <span className="font-medium">{PLATFORM_DISPLAY_NAMES[platform]}</span>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover transition-colors">
              Connect
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
