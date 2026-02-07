"use client";

import { useUIStore } from "@/stores/ui.store";

export function Header() {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-background px-6">
      <button
        onClick={toggleSidebar}
        className="rounded-lg p-2 hover:bg-muted transition-colors"
        aria-label="Toggle sidebar"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-muted" />
      </div>
    </header>
  );
}
