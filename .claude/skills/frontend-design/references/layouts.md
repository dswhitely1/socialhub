# Layouts Reference

## Contents
- Dashboard Shell
- Page Content Layouts
- Auth Layout
- Spacing Scale
- Sidebar
- Header
- Mobile Layouts
- Responsive Strategy
- Anti-Patterns

## Dashboard Shell

The main layout in `apps/web/src/app/(dashboard)/layout.tsx`:

```tsx
<div className="flex min-h-screen">
  <Sidebar />
  <div className="flex flex-1 flex-col">
    <Header />
    <main className="flex-1 p-6">{children}</main>
  </div>
</div>
```

**Structure:** Horizontal flex with fixed-width sidebar + fluid content area. The content area stacks vertically (header + main). `min-h-screen` ensures full viewport coverage.

### Layout Anatomy

```
┌─────────────────────────────────────────┐
│ flex min-h-screen                       │
├────────────┬────────────────────────────┤
│            │ flex flex-1 flex-col        │
│  Sidebar   ├────────────────────────────┤
│  w-64      │ Header  h-16  sticky top-0 │
│  border-r  ├────────────────────────────┤
│  sticky    │ Main  flex-1  p-6          │
│  top-0     │                            │
│  h-screen  │  ┌──────────────────────┐  │
│            │  │ max-w-2xl mx-auto    │  │
│            │  │ (content constraint) │  │
│            │  └──────────────────────┘  │
└────────────┴────────────────────────────┘
```

## Page Content Layouts

Every dashboard page wraps content in a constrained container:

```tsx
// Standard content page
<div className="mx-auto max-w-2xl space-y-6">
  <h1 className="text-2xl font-bold">Page Title</h1>
  <p className="text-muted-foreground">Page description.</p>
  {/* page sections */}
</div>
```

**Width constraints by content type:**

| Content | Max Width | Rationale |
|---------|-----------|-----------|
| Feed / text-heavy | `max-w-2xl` (672px) | Optimal reading line length |
| Settings / forms | `max-w-lg` (512px) | Compact form layout |
| Search results | `max-w-3xl` (768px) | Wider for result metadata |
| Full-width tables | `max-w-5xl` (1024px) | Data-dense layouts |

### Two-Column Content

For pages that need a sidebar panel (e.g., feed + filters):

```tsx
<div className="mx-auto flex max-w-5xl gap-6">
  <div className="flex-1 space-y-4">
    {/* Main content — feed items */}
  </div>
  <aside className="w-72 space-y-4">
    {/* Sidebar — filters, trending */}
  </aside>
</div>
```

## Auth Layout

Auth pages (login, register) use a centered card pattern in `apps/web/src/app/(auth)/layout.tsx`:

```tsx
<div className="flex min-h-screen items-center justify-center bg-muted p-4">
  {children}
</div>
```

Auth page content:

```tsx
<div className="w-full max-w-md space-y-6">
  <div className="text-center">
    <h1 className="text-2xl font-bold">Sign in to SocialHub</h1>
    <p className="mt-2 text-muted-foreground">Connect all your social media</p>
  </div>
  <div className="space-y-3">
    {/* OAuth buttons */}
  </div>
</div>
```

## Spacing Scale

The project uses a consistent subset of Tailwind's spacing scale:

| Token | Value | Usage |
|-------|-------|-------|
| `p-2` / `gap-2` | 8px | Icon padding, tight gaps |
| `p-3` / `gap-3` | 12px | Nav link padding, small gaps |
| `p-4` / `gap-4` | 16px | Card padding, medium gaps |
| `p-6` / `gap-6` | 24px | Main content padding, section gaps |
| `p-8` | 32px | Large sections, form containers |
| `space-y-3` | 12px | Tight vertical lists (nav items, button groups) |
| `space-y-6` | 24px | Section spacing within pages |
| `mb-2` | 8px | Label-to-input spacing |
| `mb-8` | 32px | Major section breaks |
| `mt-2` | 8px | Helper text below inputs |

**Rule:** Use `space-y-*` for sibling spacing, `gap-*` for flex/grid containers, `p-*` for container padding. AVOID mixing margin utilities (`mt-*`, `mb-*`) when `space-y-*` or `gap-*` suffice.

## Sidebar

From `apps/web/src/components/layout/sidebar.tsx`:

```tsx
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
```

**Key measurements:** `w-64` (256px) fixed width, `h-screen sticky top-0` keeps it visible on scroll. Toggle state managed by `useUIStore` — see the **zustand** skill.

## Header

From `apps/web/src/components/layout/header.tsx`:

```tsx
<header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-background px-6">
  <button
    className="rounded-lg p-2 hover:bg-muted transition-colors"
    onClick={toggleSidebar}
    aria-label="Toggle sidebar"
  >
    {/* hamburger SVG */}
  </button>
  <div className="flex-1" />
  <div className="flex items-center gap-3">
    <div className="h-8 w-8 rounded-full bg-muted" />
  </div>
</header>
```

**Pattern:** `sticky top-0 z-10` pins to top. `flex-1` spacer pushes right-side actions to the edge. `h-16` (64px) is the fixed header height.

## Mobile Layouts

Mobile uses React Native flex layout via NativeWind:

```tsx
// apps/mobile/src/app/(tabs)/feed.tsx
<View className="flex-1 items-center justify-center p-6">
  <Text className="text-2xl font-bold">Feed</Text>
  <Text className="mt-2 text-gray-500">Your unified feed will appear here.</Text>
</View>
```

**Key difference:** React Native defaults to `flexDirection: "column"`, so `flex-col` is implicit. Use `flex-row` explicitly when needed. See the **react-native** skill.

## Responsive Strategy

Web and mobile are separate apps — the web app is NOT designed to be responsive down to phone sizes. Mobile viewports are handled by the Expo app.

For tablet/desktop breakpoints on web:

```tsx
// Collapsible sidebar at smaller desktop widths
<aside className={`border-r border-border bg-background h-screen sticky top-0 transition-all ${
  sidebarOpen ? "w-64" : "w-0 overflow-hidden"
}`}>
```

When responsive web becomes needed, use mobile-first Tailwind breakpoints:
- `sm:` (640px) — small tablets
- `md:` (768px) — tablets
- `lg:` (1024px) — desktop (sidebar visible)
- `xl:` (1280px) — wide desktop

## Anti-Patterns

### WARNING: CSS Grid for Main Layout

**The Problem:**

```tsx
// BAD — grid is wrong tool for app shell with collapsible sidebar
<div className="grid grid-cols-[256px_1fr] min-h-screen">
```

**Why This Breaks:** The sidebar width toggles between `w-64` and `w-0`. Grid column sizes don't animate smoothly. Flexbox with `transition-all` handles the collapse naturally.

**The Fix:**

```tsx
// GOOD — flexbox with transition
<div className="flex min-h-screen">
  <aside className={`transition-all ${sidebarOpen ? "w-64" : "w-0 overflow-hidden"}`}>
```

### WARNING: Absolute Positioning for Sticky Elements

```tsx
// BAD — absolute removes element from flow
<header className="absolute top-0 left-0 right-0">

// GOOD — sticky keeps element in flow
<header className="sticky top-0 z-10">
```
