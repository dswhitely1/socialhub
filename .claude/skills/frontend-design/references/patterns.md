# Patterns Reference

## Contents
- Design Consistency Rules
- Cross-Platform Parity
- Accessibility Patterns
- Visual Anti-Patterns
- New Component Checklist
- Conditional Styling
- Platform-Specific Decisions

## Design Consistency Rules

### The Single Border Radius

Every rounded element uses `rounded-lg` (8px). The ONLY exception is badges/pills which use `rounded-full`.

```tsx
// Cards, buttons, inputs, modals — always rounded-lg
<div className="rounded-lg border border-border p-4">Card</div>
<button className="rounded-lg bg-primary px-4 py-2">Button</button>
<input className="rounded-lg border border-border px-3 py-2" />

// Badges, avatars, pills — rounded-full
<span className="rounded-full bg-muted px-3 py-1 text-xs">Badge</span>
<div className="h-8 w-8 rounded-full bg-muted" /> {/* Avatar */}
```

### Elevation Model: Borders, Not Shadows

SocialHub uses flat design with border-based elevation:

```tsx
// DO — border for separation
<div className="border border-border bg-background">Content</div>

// DON'T — shadows for separation
<div className="shadow-md bg-white">Content</div>
```

Reserve shadows for floating elements (dropdowns, tooltips, modals) that overlap content:

```tsx
// Floating overlay — shadow is appropriate here
<div className="rounded-lg border border-border bg-background p-4 shadow-lg">
  Dropdown menu
</div>
```

### Color Usage Rules

| Element | Color | NEVER |
|---------|-------|-------|
| Primary actions | `bg-primary text-white` | Gray buttons for primary CTAs |
| Secondary actions | `border border-border` | Colored backgrounds for secondary |
| Destructive actions | `bg-red-600 text-white` | Red text without background |
| Success feedback | `bg-green-600 text-white` | Green backgrounds on large areas |
| Warning feedback | `bg-amber-500 text-white` | Yellow (low contrast with white text) |
| Disabled state | `disabled:opacity-50` | Gray background swap |
| Hover (on white) | `hover:bg-muted` | `hover:bg-gray-50` (use token) |
| Hover (on primary) | `hover:bg-primary-hover` | `hover:opacity-80` (looks washed out) |

## Cross-Platform Parity

Web and mobile MUST share the same visual language even though they use different Tailwind versions.

### Token Sync Checklist

When adding a new design token:
- [ ] Add CSS variable to `apps/web/src/app/globals.css` `@theme {}`
- [ ] Add matching hex to `apps/mobile/tailwind.config.ts` `theme.extend.colors`
- [ ] Verify the token name is identical (e.g., `primary` in both)

### Platform Divergences (Acceptable)

| Property | Web | Mobile | Why |
|----------|-----|--------|-----|
| Font | Inter | System font | Expo doesn't bundle Inter by default |
| Muted text | `text-muted-foreground` | `text-gray-500` | Mobile lacks semantic tokens yet |
| Backgrounds | `bg-muted` | `bg-gray-100` | Same reason |
| Hover states | `hover:bg-muted` | N/A | Mobile has no hover |
| Focus ring | `focus-visible:ring-2` | N/A | Mobile uses native focus |

### Platform Divergences (NOT Acceptable)

- Different primary color hex between web and mobile
- Different border radius convention
- Different spacing scale
- Different typography size hierarchy

## Accessibility Patterns

### Focus Management

EVERY interactive element needs a visible focus indicator:

```tsx
// Required focus classes for custom interactive elements
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
```

### Semantic HTML

Use correct semantic elements — never style a `<div>` to look like a button:

```tsx
// DO — semantic button
<button className="rounded-lg bg-primary px-4 py-2 text-white">Action</button>

// DO — semantic link styled as button
<Link href="/feed" className="rounded-lg bg-primary px-4 py-2 text-white">Go to Feed</Link>

// DON'T — div pretending to be a button
<div onClick={handleClick} className="rounded-lg bg-primary px-4 py-2 text-white cursor-pointer">
  Action
</div>
```

### Color Contrast

All text must meet WCAG AA (4.5:1 for normal text, 3:1 for large text):
- `text-foreground` (#0f172a) on `bg-background` (#ffffff) → 16.75:1 — passes
- `text-muted-foreground` (#64748b) on `bg-background` (#ffffff) → 4.63:1 — passes
- `text-white` on `bg-primary` (#2563eb) → 4.56:1 — passes (barely)
- `text-white` on `bg-accent` (#8b5cf6) → 3.94:1 — **FAILS for small text**, use only for `text-lg` or larger

### Aria Labels

Always provide `aria-label` for icon-only buttons:

```tsx
<button className="rounded-lg p-2 hover:bg-muted transition-colors" aria-label="Toggle sidebar">
  <MenuIcon className="h-5 w-5" />
</button>
```

## Visual Anti-Patterns

### WARNING: Generic AI Aesthetic

**The Problem:** Producing interfaces with bland purple gradients, excessive rounded corners, oversized icons, and gratuitous glassmorphism that look AI-generated.

**Why This Breaks:** SocialHub is a productivity tool for power users processing dense social feeds. Visual noise and decorative elements slow down scanning. The interface should be invisible — content-first.

**The Fix:**
- Flat, solid colors — no gradients (except for brand marketing pages)
- No glassmorphism (`backdrop-blur`, translucent panels)
- No decorative shadows on content panels
- No oversized spacing — tight, information-dense layouts

### WARNING: Inconsistent Icon Sizing

```tsx
// BAD — arbitrary icon sizes
<SearchIcon className="h-6 w-6" />   // nav
<BellIcon className="h-5 w-5" />     // header
<HomeIcon className="h-4 w-4" />     // sidebar

// GOOD — consistent sizing per context
// Header actions: h-5 w-5
// Sidebar nav: h-5 w-5
// Inline text icons: h-4 w-4
// Large feature icons: h-6 w-6
```

### WARNING: Overusing accent Color

**The Problem:**

```tsx
// BAD — accent everywhere destroys its purpose
<div className="bg-accent text-white p-6">
  <h2 className="text-accent-foreground">Section Title</h2>
  <button className="bg-accent-dark">Action</button>
</div>
```

**The Fix:** `accent` (#8b5cf6 violet) is for small highlights only — platform badges, notification dots, active indicators. Primary actions use `primary` (blue).

## New Component Checklist

Copy when creating a new UI component:

- [ ] Uses semantic tokens (`bg-primary`, `text-foreground`) — no hardcoded hex
- [ ] Interactive elements have `transition-colors`
- [ ] Keyboard accessible: `focus-visible:ring-2 focus-visible:ring-offset-2`
- [ ] Disabled state: `disabled:pointer-events-none disabled:opacity-50`
- [ ] Uses `rounded-lg` (or `rounded-full` for badges)
- [ ] Borders use `border-border` token
- [ ] Text follows hierarchy: `text-2xl font-bold` / `text-sm` / `text-muted-foreground`
- [ ] Spacing from standard scale: `p-2`/`p-4`/`p-6`, `gap-3`/`gap-4`
- [ ] Component file is kebab-case: `platform-card.tsx`
- [ ] Component name is PascalCase: `function PlatformCard()`
- [ ] Boolean props use `is`/`has` prefix: `isActive`, `hasNotifications`

## Conditional Styling

Use template literals for dynamic classes — NEVER ternaries that produce `undefined`:

```tsx
// DO — explicit class for both states
className={`rounded-lg px-3 py-2 transition-colors ${
  isActive ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted"
}`}

// DON'T — undefined in class string
className={`rounded-lg ${isActive && "bg-muted"}`}
// Renders: "rounded-lg false" when inactive
```

For complex conditional styling, extract to a variable:

```tsx
const stateClasses = isActive
  ? "bg-muted font-medium text-foreground"
  : "text-muted-foreground hover:bg-muted";

<Link className={`block rounded-lg px-3 py-2 text-sm transition-colors ${stateClasses}`}>
```

For many variants, consider `clsx` or the pattern in `packages/ui/src/web/button.tsx` with variant/size maps.

## Platform-Specific Decisions

### When to Use Web-Only Styles

- `hover:*` — mobile has no hover state
- `focus-visible:*` — mobile uses native focus
- Cursor utilities (`cursor-pointer`) — irrelevant on touch
- Scrollbar styling — handled by OS on mobile

### When to Diverge on Mobile

- Use `Pressable` with `onPressIn`/`onPressOut` for press feedback instead of `hover:`
- Use `SafeAreaView` for top/bottom insets — no web equivalent needed
- Use `ScrollView` or `FlatList` — web uses native overflow scroll
