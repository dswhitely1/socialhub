export const PLATFORMS = [
  "twitter",
  "instagram",
  "linkedin",
  "bluesky",
  "mastodon",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_DISPLAY_NAMES: Record<Platform, string> = {
  twitter: "X (Twitter)",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
};
