# Tailwind Patterns Reference

## Contents
- Theme Token System
- Component Styling Patterns
- Shared UI Package Pattern
- Mobile NativeWind Patterns
- Anti-Patterns

---

## Theme Token System

Web uses Tailwind v4's CSS-first `@theme` block in `apps/web/src/app/globals.css`. Adding a token here makes it available as a utility class automatically.

```css
@theme {
  --color-primary: #2563eb;
  --color-background: #ffffff;
  --color-muted: #f1f5f9;
  --color-border: #e2e8f0;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}
```

Usage: `--color-primary` becomes `bg-primary`, `text-primary`, `border-primary`, etc.

Mobile defines the same colors in `apps/mobile/tailwind.config.ts` under `theme.extend.colors`. When adding a new token, add it to **both** files.

### WARNING: Hardcoded Color Values

**The Problem:**

```tsx
// BAD — bypasses theme tokens
<div className="bg-blue-600 text-white border-slate-200" />
```

**Why This Breaks:**
1. Theme changes require find-and-replace across every file
2. Dark mode becomes impossible without semantic tokens
3. Inconsistent colors creep in — is it `blue-600` or `blue-700`?

**The Fix:**

```tsx
// GOOD — uses semantic tokens
<div className="bg-primary text-white border-border" />
```

**When You Might Be Tempted:** Prototyping quickly. Even then, use tokens — renaming tokens later is much cheaper than hunting down raw values.

---

## Component Styling Patterns

### Variant Map Pattern

Used in `packages/ui/src/web/button.tsx`. Define variant styles as a plain object, compose with template literals:

```tsx
const baseStyles =
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50";

const variantStyles = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
  ghost: "hover:bg-gray-100 text-gray-700",
};

const sizeStyles = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

<button className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`} />
```

This pattern avoids class merging libraries while keeping variants readable. If class conflicts become an issue (e.g., consumer passes `bg-red-500` but variant has `bg-blue-600`), consider adding `tailwind-merge`.

### Layout Composition

Dashboard layout in `apps/web/src/app/(dashboard)/layout.tsx`:

```tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

### Sticky Header with Border

From `apps/web/src/components/layout/header.tsx`:

```tsx
<header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-background px-6">
```

Key utilities: `sticky top-0 z-10` for stickiness, `border-b border-border` for visual separation, `bg-background` to prevent content bleed-through when scrolling.

---

## Shared UI Package Pattern

`@socialhub/ui` has **no Tailwind dependency**. Components use Tailwind class strings, but compilation happens in the consuming app (web via Next.js `transpilePackages`, mobile via Metro). This is possible because packages are source-only.

```tsx
// packages/ui/src/web/button.tsx — uses Tailwind classes, no tailwind dep
export function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  return (
    <button className={`${baseStyles} ${variantStyles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
```

### WARNING: Adding Tailwind as a Package Dependency

NEVER add `tailwindcss` to `packages/ui/package.json`. The UI package is source-only — consumers handle compilation. Adding a Tailwind dependency would create version conflicts between web (v4) and mobile (v3).

---

## Mobile NativeWind Patterns

NativeWind applies Tailwind classes to React Native `View`, `Text`, `Pressable`, etc. via `className` prop.

### Basic Mobile Component

From `apps/mobile/src/components/platform-badge.tsx`:

```tsx
import { View, Text } from "react-native";

export function PlatformBadge({ platform }: PlatformBadgeProps) {
  return (
    <View className="rounded-full bg-gray-100 px-3 py-1">
      <Text className="text-xs font-medium text-gray-700">
        {PLATFORM_DISPLAY_NAMES[platform]}
      </Text>
    </View>
  );
}
```

### WARNING: Web-Only Utilities in Mobile

**The Problem:**

```tsx
// BAD — these don't work in React Native
<View className="hover:bg-gray-100 cursor-pointer grid grid-cols-3" />
```

**Why This Breaks:**
1. No hover on touch devices (use `Pressable` with `active:` instead)
2. `cursor-*` is web-only
3. `grid` is partially supported in NativeWind but behaves differently

**The Fix:**

```tsx
// GOOD — RN-compatible approach
<Pressable className="active:bg-gray-100">
  <View className="flex-row flex-wrap" />
</Pressable>
```

See the **react-native** skill for platform-specific component patterns.

---

## Anti-Patterns

### WARNING: Inline Style Objects Alongside className

**The Problem:**

```tsx
// BAD — mixing systems
<div className="p-4" style={{ backgroundColor: "#2563eb", borderRadius: 8 }} />
```

**Why This Breaks:**
1. Inline styles override Tailwind — creates specificity confusion
2. Inline styles can't use Tailwind's responsive/state modifiers
3. Two styling systems to maintain

**The Fix:**

```tsx
// GOOD — Tailwind-only
<div className="rounded-lg bg-primary p-4" />
```

### WARNING: Dynamic Class Construction

**The Problem:**

```tsx
// BAD — Tailwind's scanner can't find these classes
const color = isActive ? "blue" : "gray";
<div className={`bg-${color}-500 text-${color}-100`} />
```

**Why This Breaks:** Tailwind scans files for complete class strings at build time. Dynamic string interpolation produces classes Tailwind never sees, so they're purged from the output.

**The Fix:**

```tsx
// GOOD — complete class strings, scannable
<div className={isActive ? "bg-blue-500 text-blue-100" : "bg-gray-500 text-gray-100"} />
```
