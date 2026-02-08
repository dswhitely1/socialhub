# Aesthetics Reference

## Contents
- Color System
- Typography
- Visual Identity
- Dark Mode Strategy
- Anti-Patterns

## Color System

SocialHub defines semantic color tokens in two locations that MUST stay in sync.

**Web tokens** — `apps/web/src/app/globals.css` inside `@theme {}`:

```css
@theme {
  --color-primary: #2563eb;           /* Blue 600 — brand, CTAs, active states */
  --color-primary-hover: #1d4ed8;     /* Blue 700 — hover on primary actions */
  --color-secondary: #64748b;         /* Slate 500 — secondary text, icons */
  --color-accent: #8b5cf6;            /* Violet 500 — highlights, badges */
  --color-background: #ffffff;        /* White — page backgrounds */
  --color-foreground: #0f172a;        /* Slate 900 — primary text */
  --color-muted: #f1f5f9;            /* Slate 100 — hover backgrounds, cards */
  --color-muted-foreground: #64748b;  /* Slate 500 — secondary/muted text */
  --color-border: #e2e8f0;           /* Slate 200 — all borders */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
}
```

**Mobile tokens** — `apps/mobile/tailwind.config.ts`:

```typescript
colors: {
  primary: "#2563eb",
  "primary-hover": "#1d4ed8",
  secondary: "#64748b",
  accent: "#8b5cf6",
}
```

### Token Usage Map

| Token | Tailwind Class | Use For |
|-------|---------------|---------|
| `primary` | `bg-primary`, `text-primary` | Buttons, links, active nav items |
| `primary-hover` | `hover:bg-primary-hover` | Hover state on primary elements |
| `secondary` | `text-secondary` | Icons, secondary labels |
| `accent` | `bg-accent`, `text-accent` | Platform badges, highlights |
| `background` | `bg-background` | Page and panel backgrounds |
| `foreground` | `text-foreground` | Headings, primary body text |
| `muted` | `bg-muted` | Hover states, card backgrounds |
| `muted-foreground` | `text-muted-foreground` | Descriptions, placeholders |
| `border` | `border-border` | Card borders, dividers, inputs |

### Adding a New Token

1. Add the CSS variable to `globals.css` inside `@theme {}`
2. Add the same hex to `apps/mobile/tailwind.config.ts` under `theme.extend.colors`
3. Use the token name in classes — never the raw hex

```css
/* globals.css */
--color-success: #16a34a;
--color-success-hover: #15803d;
```

```typescript
// mobile tailwind.config.ts
success: "#16a34a",
"success-hover": "#15803d",
```

## Typography

**Typeface:** Inter — loaded via `font-sans` in Tailwind theme. Applied globally on `<body>` via root layout `className="font-sans"`.

**Hierarchy:**

| Level | Classes | Usage |
|-------|---------|-------|
| Display | `text-4xl font-bold` | Landing page hero, app title |
| Page title | `text-2xl font-bold` | Dashboard page headings |
| Section heading | `text-xl font-bold` | Sidebar brand, card titles |
| Subsection | `text-lg font-medium` | Card headers, grouped sections |
| Body | `text-sm` | Standard copy, nav links, buttons |
| Caption | `text-xs font-medium` | Badges, timestamps, labels |
| Muted body | `text-sm text-muted-foreground` | Descriptions, helper text |

```tsx
// Page heading pattern
<h1 className="text-2xl font-bold">Notifications</h1>
<p className="text-muted-foreground">Your alerts from all platforms.</p>
```

### WARNING: Font Mismatch Between Platforms

Mobile does NOT load Inter — it uses system fonts. Do not assume `font-sans` renders identically. If Inter is added to mobile later, use `expo-font` and load it in the root layout.

## Visual Identity

SocialHub's aesthetic is **functional minimalism** — clean borders, generous whitespace, blue-centric color. This is intentional for a productivity tool where users process high-density social feeds.

**What makes it distinctive:**
- Blue primary with violet accent — not the typical teal/green SaaS palette
- No shadows — borders define boundaries (`border border-border`)
- No gradients — flat, solid colors
- Rounded-lg everywhere — 8px radius is the single corner treatment
- Generous `space-y-6` between sections

**Maintain this identity by:**
- Keeping backgrounds white/muted, not gray-heavy
- Using `accent` sparingly for emphasis (platform badges, active indicators)
- Preferring `border-border` over `shadow-md` for elevation

## Dark Mode Strategy

Dark mode is not yet implemented. When adding it:

1. Define dark palette tokens using Tailwind v4's media query or class strategy
2. Every `bg-background` / `text-foreground` pair must have a dark variant
3. Do NOT add `dark:` prefixes ad-hoc — define all dark colors in `@theme` using `@media (prefers-color-scheme: dark)` or a `.dark` class strategy
4. Mobile will need equivalent dark colors in `tailwind.config.ts`

## Anti-Patterns

### WARNING: Hardcoded Hex Values

**The Problem:**

```tsx
// BAD — hardcoded color bypasses the design system
<div className="bg-[#2563eb] text-[#ffffff]">Sign In</div>
```

**Why This Breaks:**
1. Dark mode will require finding and updating every instance
2. Color changes require a global search-and-replace instead of one token edit
3. Mobile parity is impossible to verify — no shared source of truth

**The Fix:**

```tsx
// GOOD — uses semantic tokens
<div className="bg-primary text-white">Sign In</div>
```

### WARNING: Using Gray Scale Instead of Semantic Tokens (Web)

**The Problem:**

```tsx
// BAD — generic gray classes instead of semantic tokens
<p className="text-gray-500">Description text</p>
<div className="bg-gray-100 border border-gray-200">Card</div>
```

**Why This Breaks:**
1. `text-gray-500` and `text-muted-foreground` can drift to different values
2. Semantic tokens communicate intent — "this is muted text" vs "this is gray-500 text"
3. Theme changes require touching every component instead of one token

**The Fix:**

```tsx
// GOOD — semantic tokens on web
<p className="text-muted-foreground">Description text</p>
<div className="bg-muted border border-border">Card</div>
```

**Note:** Mobile currently uses `text-gray-500` / `bg-gray-100` because it lacks `muted` / `muted-foreground` tokens. When the mobile design system matures, migrate to semantic tokens there too.

### WARNING: Inter Is Not a Generic Default

Do NOT replace Inter with system fonts or other typefaces without a design decision. Inter was chosen for its readability at small sizes (social feed text) and its wide glyph set (emoji-adjacent Unicode common in social content). See the **tailwind** skill for font configuration.
