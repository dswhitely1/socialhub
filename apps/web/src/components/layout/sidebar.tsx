"use client";

import Link from "next/link";
import { useUIStore } from "@/stores/ui.store";

const navItems = [
  { href: "/feed", label: "Feed" },
  { href: "/notifications", label: "Notifications" },
  { href: "/platforms", label: "Platforms" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const { sidebarOpen } = useUIStore();

  if (!sidebarOpen) return null;

  return (
    <aside className="w-64 border-r border-border bg-background h-screen sticky top-0">
      <div className="p-6">
        <h2 className="text-xl font-bold">SocialHub</h2>
      </div>
      <nav className="px-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
