# Tailwind Workflows Reference

## Contents
- Adding a New Theme Token
- Creating a New Web Component
- Creating a New Mobile Component
- Adding a Shared UI Component
- Debugging Styles
- Missing Professional Solution: tailwind-merge

---

## Adding a New Theme Token

When adding a new design token (color, spacing, font), update both web and mobile configs.

Copy this checklist and track progress:
- [ ] Step 1: Add CSS variable to `apps/web/src/app/globals.css` `@theme` block
- [ ] Step 2: Add color to `apps/mobile/tailwind.config.ts` `theme.extend.colors`
- [ ] Step 3: Use the token in components — verify it resolves on both platforms

### Web (Tailwind v4)

Add to the `@theme` block in `apps/web/src/app/globals.css`:

```css
@theme {
  /* existing tokens... */
  --color-danger: #ef4444;
  --color-danger-hover: #dc2626;
  --color-success: #22c55e;
}
```

This automatically creates utilities: `bg-danger`, `text-danger`, `border-danger`, etc.

### Mobile (Tailwind v3 + NativeWind)

Add to `apps/mobile/tailwind.config.ts`:

```typescript
theme: {
  extend: {
    colors: {
      // existing colors...
      danger: "#ef4444",
      "danger-hover": "#dc2626",
      success: "#22c55e",
    },
  },
},
```

### Validation

1. Run `pnpm dev` and check both web and mobile
2. Verify the token resolves — inspect element on web, check NativeWind output on mobile
3. If the class doesn't apply, check that the CSS variable name matches (web) or that the config was saved (mobile)

---

## Creating a New Web Component

### Pattern

```tsx
// apps/web/src/components/feed/post-card.tsx

interface PostCardProps {
  title: string;
  platform: string;
  isRead: boolean;
}

export function PostCard({ title, platform, isRead }: PostCardProps) {
  return (
    <article
      className={`rounded-lg border border-border p-4 transition-colors ${
        isRead ? "bg-background" : "bg-muted"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{platform}</span>
      </div>
      <h3 className="mt-2 text-sm font-semibold text-foreground">{title}</h3>
    </article>
  );
}
```

Key conventions:
- Use semantic tokens (`bg-background`, `text-foreground`, `border-border`) not raw colors
- Use `transition-colors` for interactive elements
- Conditional classes via ternary with complete class strings
- File naming: kebab-case (`post-card.tsx`)
- Component naming: PascalCase (`PostCard`)

---

## Creating a New Mobile Component

### Pattern

```tsx
// apps/mobile/src/components/post-card.tsx
import { View, Text, Pressable } from "react-native";

interface PostCardProps {
  title: string;
  platform: string;
  onPress: () => void;
}

export function PostCard({ title, platform, onPress }: PostCardProps) {
  return (
    <Pressable onPress={onPress} className="rounded-lg border border-gray-200 bg-white p-4 active:bg-gray-50">
      <View className="flex-row items-center gap-2">
        <Text className="text-xs font-medium text-secondary">{platform}</Text>
      </View>
      <Text className="mt-2 text-sm font-semibold text-gray-900">{title}</Text>
    </Pressable>
  );
}
```

Key differences from web:
- Use `Pressable` + `active:` instead of `hover:` for touch feedback
- Use `View`/`Text` from `react-native` — not `div`/`span`
- Use `flex-row` explicitly (RN defaults to `flex-col`)
- Mobile theme tokens are in `tailwind.config.ts`, not CSS variables

---

## Adding a Shared UI Component

`@socialhub/ui` is source-only, web-focused, and has no Tailwind dependency.

Copy this checklist and track progress:
- [ ] Step 1: Create component in `packages/ui/src/web/`
- [ ] Step 2: Export from `packages/ui/src/web/index.ts`
- [ ] Step 3: Import in web app via `@socialhub/ui/web`
- [ ] Step 4: Verify with `pnpm typecheck`

### Example

```tsx
// packages/ui/src/web/badge.tsx
interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger";
  children: React.ReactNode;
}

const variantStyles = {
  default: "bg-gray-100 text-gray-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  danger: "bg-red-100 text-red-800",
};

export function Badge({ variant = "default", children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]}`}>
      {children}
    </span>
  );
}
```

```typescript
// packages/ui/src/web/index.ts
export { Button } from "./button";
export { Badge } from "./badge";
```

The web app picks this up via `transpilePackages` in `apps/web/next.config.ts`. No rebuild needed.

---

## Debugging Styles

### Class Not Applying (Web)

1. Check the class exists — Tailwind v4 auto-generates utilities from `@theme` tokens
2. Inspect the element in DevTools — look for the CSS rule
3. Check specificity — another rule may be overriding. Tailwind v4 uses `@layer` which has low specificity
4. Verify `@import "tailwindcss"` is in `globals.css` and the file is imported in `apps/web/src/app/layout.tsx`

### Class Not Applying (Mobile)

1. Make sure NativeWind babel plugin is registered in `apps/mobile/babel.config.js`
2. Verify `metro.config.js` calls `withNativeWind` with the correct CSS input path
3. Check that `global.css` is imported in `apps/mobile/src/app/_layout.tsx`
4. Restart Metro bundler — NativeWind caches aggressively:
   ```bash
   pnpm --filter mobile start --clear
   ```
5. Some web utilities don't exist in RN — check NativeWind docs for supported classes

### Iteration Loop

1. Make style changes
2. Verify in browser / simulator
3. If class doesn't apply, check the debugging steps above
4. Repeat until styles render correctly

---

## WARNING: Missing Professional Solution — tailwind-merge

**Detected:** No `tailwind-merge` in dependencies.

**Impact:** When composing components that accept a `className` prop, consumer classes can conflict with internal classes. For example, passing `bg-red-500` to a component that already has `bg-blue-600` results in both classes being applied — last one in the stylesheet wins, which is unpredictable.

### Current Approach (Acceptable for Now)

The `Button` in `@socialhub/ui` uses simple string concatenation:

```tsx
<button className={`${baseStyles} ${variantStyles[variant]} ${className}`} />
```

### Recommended Solution (When Component Library Grows)

Install `tailwind-merge` for the web app:

```bash
pnpm --filter web add tailwind-merge
```

```tsx
import { twMerge } from "tailwind-merge";

<button className={twMerge(baseStyles, variantStyles[variant], className)} />
```

`twMerge` intelligently resolves conflicts — `twMerge("bg-blue-600", "bg-red-500")` yields `"bg-red-500"`. Add this when the component library has 10+ components accepting `className`.

See the **react** skill for component composition patterns and the **frontend-design** skill for design system conventions.
