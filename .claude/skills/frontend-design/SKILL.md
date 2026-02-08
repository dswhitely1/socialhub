---
name: frontend-design
description: |
  Applies Tailwind CSS utility-first styling across web (v4) and mobile (NativeWind/v3) interfaces in the SocialHub monorepo.
  Use when: creating new pages or components, adjusting visual design, working with colors/spacing/typography,
  building responsive layouts, or ensuring cross-platform design consistency between apps/web and apps/mobile.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Frontend Design Skill

SocialHub uses a split Tailwind setup: **Tailwind v4** on web with CSS-native `@theme` tokens in `apps/web/src/app/globals.css`, and **Tailwind v3 + NativeWind** on mobile via `apps/mobile/tailwind.config.ts`. The color system uses semantic tokens (`primary`, `accent`, `muted`, `border`) — NEVER hardcode hex values. Inter is the sole typeface. All interactive elements require `transition-colors` and `focus-visible:ring-2`.

## Quick Start

### Adding a New Color Token

```css
/* apps/web/src/app/globals.css — inside @theme {} */
--color-danger: #ef4444;
--color-danger-hover: #dc2626;
```

```typescript
// apps/mobile/tailwind.config.ts — inside theme.extend.colors
danger: "#ef4444",
"danger-hover": "#dc2626",
```

### Styling a New Interactive Element

```tsx
// Web — always use tokens, transition, and focus ring
<button className="rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
  Connect Platform
</button>
```

### Mobile Component with NativeWind

```tsx
// Mobile — use className directly on RN primitives
<View className="flex-1 items-center justify-center p-6">
  <Text className="text-2xl font-bold">Settings</Text>
  <Text className="mt-2 text-gray-500">Manage your connected accounts.</Text>
</View>
```

## Key Concepts

| Concept | Web (Tailwind v4) | Mobile (NativeWind/TW3) |
|---------|-------------------|-------------------------|
| Config location | `globals.css` `@theme {}` | `tailwind.config.ts` `theme.extend` |
| Color tokens | `bg-primary`, `text-muted-foreground` | `bg-primary`, `text-gray-500` |
| Border radius | `rounded-lg` (8px) everywhere | `rounded-full` for badges, `rounded-lg` for cards |
| Spacing scale | `p-2`/`p-4`/`p-6`/`p-8` | Same Tailwind scale |
| Typography | `font-sans` (Inter) | System default (no custom font) |
| Layout model | Flexbox (`flex`, `flex-1`, `flex-col`) | Same via NativeWind |
| Dark mode | Not implemented yet | Not implemented yet |

## Common Patterns

### Content Page

**When:** Creating a new dashboard page (feed, notifications, search, settings).

```tsx
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-muted-foreground">Manage your account preferences.</p>
      {/* page content */}
    </div>
  );
}
```

### Card Container

**When:** Wrapping grouped content (post card, notification item, platform connection).

```tsx
<div className="rounded-lg border border-border bg-background p-4 space-y-3">
  <h3 className="text-lg font-medium">Connected Platforms</h3>
  {/* card body */}
</div>
```

### Auth Form

**When:** Building sign-in, sign-up, or OAuth connection screens.

```tsx
<div className="flex min-h-screen items-center justify-center bg-muted p-4">
  <div className="w-full max-w-md space-y-6">
    <div className="text-center">
      <h1 className="text-2xl font-bold">Sign in to SocialHub</h1>
      <p className="mt-2 text-muted-foreground">Connect all your social media</p>
    </div>
    <div className="space-y-3">
      <button className="w-full rounded-lg border border-border px-4 py-3 hover:bg-muted transition-colors">
        Continue with Google
      </button>
    </div>
  </div>
</div>
```

## Design Validation Checklist

Copy this checklist when building new UI:
- [ ] Uses semantic color tokens (never hardcoded hex)
- [ ] All interactive elements have `transition-colors`
- [ ] Focus states use `focus-visible:ring-2 focus-visible:ring-offset-2`
- [ ] Disabled state uses `disabled:pointer-events-none disabled:opacity-50`
- [ ] Content width constrained with `max-w-2xl` or similar
- [ ] Spacing uses standard scale: `p-2`/`p-4`/`p-6`, `gap-3`/`gap-4`/`gap-6`
- [ ] Text hierarchy: `text-4xl` > `text-2xl` > `text-lg` > `text-sm`
- [ ] Mobile token parity: any new web token added to mobile config too

## See Also

- [aesthetics](references/aesthetics.md) — Color system, typography, visual identity
- [components](references/components.md) — Button variants, badges, form elements
- [layouts](references/layouts.md) — Dashboard shell, page grids, responsive patterns
- [motion](references/motion.md) — Transitions, micro-interactions, loading states
- [patterns](references/patterns.md) — Anti-patterns, consistency rules, platform parity

## Related Skills

- See the **tailwind** skill for Tailwind v4 configuration and utility classes
- See the **react** skill for component architecture, hooks, and state patterns
- See the **react-native** skill for Expo/NativeWind mobile-specific patterns
- See the **zustand** skill for UI state stores (`ui.store.ts`, `feed.store.ts`)
- See the **nextjs** skill for App Router layouts and route groups
