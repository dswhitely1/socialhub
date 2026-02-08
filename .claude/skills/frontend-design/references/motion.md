# Motion Reference

## Contents
- Current Motion System
- Transition Conventions
- Micro-Interactions
- Loading States
- Animation Library Recommendation
- Page Transitions
- Performance Rules
- Anti-Patterns

## Current Motion System

SocialHub uses **CSS transitions only** — no animation library (Framer Motion, Motion, GSAP) is installed. All motion is achieved through Tailwind's `transition-*` utilities.

This is appropriate for the current stage. The codebase uses a single transition pattern consistently:

```tsx
// Every interactive element
className="... transition-colors"
```

This provides 150ms color transitions on hover/focus states. No `duration-*` or `ease-*` overrides are used — Tailwind defaults apply (`duration-150`, `ease-in-out`).

## Transition Conventions

### Interactive Element Transitions

**Required on ALL clickable elements:**

```tsx
// Buttons
className="hover:bg-primary-hover transition-colors"

// Nav links
className="hover:bg-muted transition-colors"

// Cards (when clickable)
className="hover:bg-muted transition-colors cursor-pointer"

// Ghost buttons
className="hover:bg-muted transition-colors"
```

### Sidebar Collapse

The sidebar toggle uses width transition:

```tsx
<aside className={`border-r border-border bg-background h-screen sticky top-0 transition-all ${
  sidebarOpen ? "w-64" : "w-0 overflow-hidden"
}`}>
```

`transition-all` animates both width and any other changing properties. `overflow-hidden` prevents content from spilling during collapse.

### Transition Utility Decision Tree

| What Changes | Utility | Example |
|-------------|---------|---------|
| Background/text color | `transition-colors` | Hover states on buttons/links |
| Width/height | `transition-all` | Sidebar collapse |
| Opacity | `transition-opacity` | Fade in/out |
| Transform (scale/translate) | `transition-transform` | Dropdown menus |
| Multiple properties | `transition-all` | Complex state changes |

## Micro-Interactions

### Focus Ring Animation

Focus rings appear instantly (no transition) — this is correct. Focus indicators should never be delayed for accessibility.

```tsx
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
```

### Button Press Feedback

Currently not implemented. When adding press feedback:

```tsx
// Active state scale — subtle press effect
className="hover:bg-primary-hover active:scale-[0.98] transition-colors"
```

### Notification Badge Pulse

For real-time notification indicators:

```tsx
// Tailwind animate-pulse for attention
<span className="relative flex h-2 w-2">
  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
</span>
```

## Loading States

### Skeleton Screens

Use `animate-pulse` with muted backgrounds for loading placeholders:

```tsx
// Post skeleton
<div className="space-y-3">
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
    <div className="space-y-2">
      <div className="h-4 w-32 rounded bg-muted animate-pulse" />
      <div className="h-3 w-20 rounded bg-muted animate-pulse" />
    </div>
  </div>
  <div className="space-y-2">
    <div className="h-3 w-full rounded bg-muted animate-pulse" />
    <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
  </div>
</div>
```

### Spinner

Tailwind's `animate-spin` for inline loading:

```tsx
<svg className="h-5 w-5 animate-spin text-primary" viewBox="0 0 24 24">
  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
</svg>
```

### Button Loading State

```tsx
<button disabled className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50">
  <svg className="h-4 w-4 animate-spin" /* spinner SVG */ />
  Connecting...
</button>
```

## Animation Library Recommendation

### WARNING: No Animation Library Installed

**Detected:** No motion/animation library in dependencies.

**Impact:** Page transitions, list reordering animations, toast notifications, and modal enter/exit animations require manual CSS `@keyframes` or are simply absent.

### When to Add One

Add `motion` (the successor to Framer Motion) when you need:
- Page route transitions in Next.js
- List item enter/exit animations (feed items, notifications)
- Modal/dialog enter/exit
- Gesture-driven interactions

```bash
pnpm --filter @socialhub/web add motion
```

```tsx
// Example: Feed item entrance
import { motion } from "motion/react";

<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2 }}
  className="rounded-lg border border-border p-4"
>
  {/* post content */}
</motion.div>
```

**Do NOT add Framer Motion for mobile** — React Native Reanimated is the correct choice for Expo. See the **react-native** skill.

## Page Transitions

Currently no page transitions exist. When implementing with the **nextjs** App Router:

```tsx
// apps/web/src/app/(dashboard)/template.tsx
"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  );
}
```

Use `template.tsx` (not `layout.tsx`) — templates re-mount on navigation, layouts don't.

## Performance Rules

1. **NEVER animate `width`/`height` on elements with complex children** — use `transform: scaleX/scaleY` or `clip-path` instead. The sidebar is the only exception (simple content, infrequent toggle).

2. **Prefer `transition-colors` over `transition-all`** — `transition-all` triggers transition on every property change, including layout-triggering ones.

3. **Use `will-change` sparingly** — only on elements with known upcoming transitions:

```tsx
// Only for elements about to animate
className="will-change-transform"
```

4. **Disable animations for `prefers-reduced-motion`:**

```tsx
className="motion-safe:animate-pulse"
// or in Tailwind v4 globals:
// @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; } }
```

## Anti-Patterns

### WARNING: Transition on Layout Properties

**The Problem:**

```tsx
// BAD — animating padding/margin triggers layout recalculation every frame
<div className="p-4 hover:p-6 transition-all">Content</div>
```

**Why This Breaks:** Layout properties (`padding`, `margin`, `width`, `height`) cause reflow on every animation frame. At 60fps, that's 60 layout recalculations per second.

**The Fix:**

```tsx
// GOOD — transform is GPU-accelerated, no reflow
<div className="p-4 hover:scale-105 transition-transform origin-center">Content</div>
```

### WARNING: Animation on Mount Without Purpose

**The Problem:**

```tsx
// BAD — everything bounces in for no reason
<motion.div animate={{ scale: [0, 1.1, 1] }} transition={{ type: "spring" }}>
  <p>Settings saved.</p>
</motion.div>
```

**Why This Breaks:** Gratuitous animation slows perceived performance and creates visual noise in a productivity tool. SocialHub users process dense feeds — motion should reduce cognitive load, not add to it.

**The Fix:** Only animate to communicate state changes (new item appeared, content loaded, element removed). Static content should appear instantly.
