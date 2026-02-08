# Components Reference

## Contents
- Button System
- Navigation Links
- Badges
- Form Elements
- Cards
- Platform-Specific Components
- Missing Solutions
- Anti-Patterns

## Button System

Buttons live in `packages/ui/src/web/button.tsx` and follow a variant + size pattern. See the **react** skill for the component architecture.

**Variant map:**

```typescript
const variantStyles = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
  ghost: "hover:bg-gray-100 text-gray-700",
};
```

**Size map:**

```typescript
const sizeStyles = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};
```

**Base styles always applied:**

```typescript
const baseStyles =
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
```

### Usage Decision Tree

- **Primary action** (Submit, Connect, Sign In) → `variant="primary"`
- **Secondary action** (Cancel, Back, alternative option) → `variant="secondary"`
- **Inline/toolbar action** (toggle sidebar, icon buttons) → `variant="ghost"`
- **Destructive action** → add a `destructive` variant: `bg-red-600 text-white hover:bg-red-700`

### Adding a New Button Variant

```typescript
// packages/ui/src/web/button.tsx — add to variantStyles
const variantStyles = {
  // ...existing
  outline: "border border-border bg-transparent hover:bg-muted text-foreground",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};
```

## Navigation Links

Sidebar nav items use a consistent pattern:

```tsx
<Link
  href={item.href}
  className="block rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
>
  {item.label}
</Link>
```

**Active state** — when adding route-aware active states:

```tsx
<Link
  href={item.href}
  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted"
  }`}
>
  {item.label}
</Link>
```

## Badges

Mobile platform badge from `apps/mobile/src/components/platform-badge.tsx`:

```tsx
<View className="rounded-full bg-gray-100 px-3 py-1">
  <Text className="text-xs font-medium text-gray-700">
    {PLATFORM_DISPLAY_NAMES[platform]}
  </Text>
</View>
```

**Web equivalent:**

```tsx
<span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
  {PLATFORM_DISPLAY_NAMES[platform]}
</span>
```

**Platform-colored badges** — if you need color-coded platform indicators:

```tsx
const PLATFORM_COLORS: Record<Platform, string> = {
  twitter: "bg-sky-100 text-sky-700",
  instagram: "bg-pink-100 text-pink-700",
  linkedin: "bg-blue-100 text-blue-700",
  bluesky: "bg-cyan-100 text-cyan-700",
  mastodon: "bg-violet-100 text-violet-700",
};

<span className={`rounded-full px-3 py-1 text-xs font-medium ${PLATFORM_COLORS[platform]}`}>
  {PLATFORM_DISPLAY_NAMES[platform]}
</span>
```

## Form Elements

OAuth buttons follow a full-width bordered pattern:

```tsx
<button className="w-full rounded-lg border border-border px-4 py-3 hover:bg-muted transition-colors">
  Continue with Google
</button>
```

**Text input styling (when adding form fields):**

```tsx
<input
  type="text"
  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
  placeholder="Search posts..."
/>
```

**Required classes for ALL form inputs:**
- `rounded-lg border border-border` — consistent border treatment
- `bg-background` — explicit background for dark mode readiness
- `placeholder:text-muted-foreground` — muted placeholder text
- `focus-visible:ring-2 focus-visible:ring-primary` — keyboard-accessible focus ring

## Cards

The standard card container pattern:

```tsx
<div className="rounded-lg border border-border bg-background p-4 space-y-3">
  <h3 className="text-lg font-medium">{title}</h3>
  <p className="text-sm text-muted-foreground">{description}</p>
</div>
```

**Interactive card** (clickable post, notification item):

```tsx
<div className="rounded-lg border border-border bg-background p-4 space-y-3 hover:bg-muted transition-colors cursor-pointer">
  {/* content */}
</div>
```

## Platform-Specific Components

When building shared components between web and mobile, keep styling separate:

```
packages/ui/src/
├── web/          # Web-only styled components (Tailwind v4 classes)
│   └── button.tsx
└── (future)
    └── mobile/   # Mobile-only styled components (NativeWind classes)
```

NEVER put web `className` strings in `packages/shared/` — shared packages contain types, schemas, and constants only. See the **react** skill for cross-platform component patterns.

## WARNING: Missing Component Library

**Detected:** No component library (shadcn/ui, Radix, Headless UI) in dependencies.

**Impact:** Every UI primitive (dropdown, dialog, tooltip, tabs, select) must be built from scratch. This leads to inconsistent keyboard navigation, missing ARIA attributes, and accessibility regressions.

### Recommended Solution

Install shadcn/ui (built on Radix primitives):

```bash
pnpm --filter @socialhub/web dlx shadcn@latest init
```

shadcn/ui generates components into your codebase (not a dependency) and pairs with Tailwind v4. It provides accessible, unstyled primitives you customize with your existing tokens.

## Anti-Patterns

### WARNING: Inline Style Objects in React

**The Problem:**

```tsx
// BAD — bypasses Tailwind, breaks consistency, no responsive support
<div style={{ padding: 16, backgroundColor: "#f1f5f9", borderRadius: 8 }}>
  Content
</div>
```

**Why This Breaks:**
1. Cannot use responsive prefixes (`md:`, `lg:`)
2. Not discoverable in class searches — `grep "bg-muted"` misses it
3. Higher specificity than utility classes — hard to override

**The Fix:**

```tsx
// GOOD — Tailwind utilities
<div className="rounded-lg bg-muted p-4">Content</div>
```

### WARNING: Inconsistent Button Heights

**The Problem:**

```tsx
// BAD — mixing arbitrary heights breaks visual rhythm
<button className="py-2">Small</button>
<button className="py-4">Big</button>
<button className="h-11">Custom</button>
```

**Why This Breaks:** Buttons next to each other should share a height from the size system (`h-8`/`h-10`/`h-12`). Arbitrary padding creates misaligned rows.

**The Fix:**

Use the `sizeStyles` from the Button component: `sm` (h-8), `md` (h-10), `lg` (h-12).
