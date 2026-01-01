# Design System: Onboarding BDR Team v2 LMS

**Date**: 2025-12-07
**Branch**: `001-bdr-lms`

## Overview

This design system defines the visual language for the BDR LMS application. It uses Tailwind CSS 4.x with shadcn/ui components built on Radix UI primitives.

## CSS Variables

Apply these CSS variables to `src/app/globals.css` after running `npx shadcn@latest init`.

### Light Mode (Default)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;

  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;

  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;

  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;

  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;

  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;

  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;

  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;

  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5.9% 10%;

  --radius: 0.5rem;

  /* Chart colors */
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;

  /* Sidebar */
  --sidebar-background: 0 0% 98%;
  --sidebar-foreground: 240 5.3% 26.1%;
  --sidebar-primary: 240 5.9% 10%;
  --sidebar-primary-foreground: 0 0% 98%;
  --sidebar-accent: 240 4.8% 95.9%;
  --sidebar-accent-foreground: 240 5.9% 10%;
  --sidebar-border: 220 13% 91%;
  --sidebar-ring: 240 5.9% 10%;
}
```

### Dark Mode

```css
.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;

  --card: 240 10% 3.9%;
  --card-foreground: 0 0% 98%;

  --popover: 240 10% 3.9%;
  --popover-foreground: 0 0% 98%;

  --primary: 0 0% 98%;
  --primary-foreground: 240 5.9% 10%;

  --secondary: 240 3.7% 15.9%;
  --secondary-foreground: 0 0% 98%;

  --muted: 240 3.7% 15.9%;
  --muted-foreground: 240 5% 64.9%;

  --accent: 240 3.7% 15.9%;
  --accent-foreground: 0 0% 98%;

  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;

  --border: 240 3.7% 15.9%;
  --input: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;

  /* Chart colors (dark mode) */
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;

  /* Sidebar (dark mode) */
  --sidebar-background: 240 5.9% 10%;
  --sidebar-foreground: 240 4.8% 95.9%;
  --sidebar-primary: 224.3 76.3% 48%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 240 3.7% 15.9%;
  --sidebar-accent-foreground: 240 4.8% 95.9%;
  --sidebar-border: 240 3.7% 15.9%;
  --sidebar-ring: 240 4.9% 83.9%;
}
```

> **Tailwind 4 Note**: These variables use HSL format. When Tailwind 4 stabilizes with OKLCH support, consider migrating to OKLCH for better color interpolation.

## Design Tokens

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | 0.5rem (8px) | Base radius for cards, buttons |
| `rounded-sm` | calc(var(--radius) - 4px) | Small elements |
| `rounded-md` | calc(var(--radius) - 2px) | Medium elements |
| `rounded-lg` | var(--radius) | Large elements, cards |
| `rounded-xl` | calc(var(--radius) + 4px) | Extra large elements |

### Semantic Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `primary` | Near black | White | Primary actions, links |
| `secondary` | Light gray | Dark gray | Secondary actions |
| `muted` | Light gray | Dark gray | Disabled states, hints |
| `accent` | Light gray | Dark gray | Highlights, hover states |
| `destructive` | Red | Dark red | Delete, error states |

## Typography Scale

Use Tailwind's default typography classes with these semantic mappings:

### Headings

| Element | Class | Size | Weight | Line Height |
|---------|-------|------|--------|-------------|
| h1 | `text-4xl font-bold` | 2.25rem (36px) | 700 | 1.2 |
| h2 | `text-3xl font-semibold` | 1.875rem (30px) | 600 | 1.25 |
| h3 | `text-2xl font-semibold` | 1.5rem (24px) | 600 | 1.3 |
| h4 | `text-xl font-medium` | 1.25rem (20px) | 500 | 1.4 |
| h5 | `text-lg font-medium` | 1.125rem (18px) | 500 | 1.5 |
| h6 | `text-base font-medium` | 1rem (16px) | 500 | 1.5 |

### Body Text

| Type | Class | Size | Usage |
|------|-------|------|-------|
| Body Large | `text-lg` | 18px | Introductions, emphasis |
| Body | `text-base` | 16px | Default body text |
| Body Small | `text-sm` | 14px | Secondary text, labels |
| Caption | `text-xs` | 12px | Timestamps, metadata |

### Font Stack

```css
font-family: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
```

## Spacing Scale

Tailwind's default spacing scale (4px base unit):

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight spacing, icons |
| `space-2` | 8px | Inner padding, gaps |
| `space-3` | 12px | Component padding |
| `space-4` | 16px | Standard padding |
| `space-6` | 24px | Section spacing |
| `space-8` | 32px | Large gaps |
| `space-12` | 48px | Page sections |
| `space-16` | 64px | Major sections |

## Component Styling Conventions

### Cards

```tsx
<Card className="rounded-lg border bg-card text-card-foreground shadow-sm">
  <CardHeader className="p-6">
    <CardTitle className="text-2xl font-semibold">Title</CardTitle>
    <CardDescription className="text-sm text-muted-foreground">Description</CardDescription>
  </CardHeader>
  <CardContent className="p-6 pt-0">
    {/* Content */}
  </CardContent>
</Card>
```

### Buttons

```tsx
// Primary action
<Button variant="default">Save Course</Button>

// Secondary action
<Button variant="secondary">Cancel</Button>

// Destructive action
<Button variant="destructive">Delete</Button>

// Ghost/subtle action
<Button variant="ghost">View Details</Button>

// Outline action
<Button variant="outline">Export</Button>
```

### Form Inputs

```tsx
<Input
  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm
             ring-offset-background placeholder:text-muted-foreground
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
/>
```

### Focus States

All interactive elements must have visible focus indicators:

```css
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-ring
focus-visible:ring-offset-2
```

## Dark Mode Implementation

Use `next-themes` for dark mode:

```tsx
// src/components/providers/theme-provider.tsx
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

## Accessibility Requirements (WCAG 2.1 AA)

| Requirement | Standard | Implementation |
|-------------|----------|----------------|
| Color Contrast | 4.5:1 minimum (text) | Use semantic color tokens |
| Color Contrast | 3:1 minimum (UI components) | Border and focus rings |
| Focus Indicators | Visible on all interactive elements | `focus-visible:ring-2` |
| Touch Targets | Minimum 44x44px | `min-h-11 min-w-11` on buttons |
| Keyboard Navigation | All actions accessible | Radix UI primitives |
| Screen Readers | ARIA labels on icons | `aria-label` or `sr-only` text |

### Keyboard Navigation

All interactive components from shadcn/ui (built on Radix) support:
- `Tab` / `Shift+Tab` for focus navigation
- `Enter` / `Space` for activation
- `Arrow keys` for menu/list navigation
- `Escape` to close modals/dropdowns

### Color Contrast Verification

Before deployment, verify contrast ratios:
- Body text on background: >= 4.5:1
- Large text (18px+ or 14px+ bold): >= 3:1
- UI components (borders, icons): >= 3:1
- Focus indicators: >= 3:1

Tools: Chrome DevTools, axe DevTools, Lighthouse

## Icons

Use Lucide React icons consistently:

```tsx
import { Plus, Trash2, Edit, Eye, MoreHorizontal } from "lucide-react";

// Standard icon sizes
<Icon className="h-4 w-4" />  // Small (buttons, inline)
<Icon className="h-5 w-5" />  // Medium (navigation)
<Icon className="h-6 w-6" />  // Large (headers, empty states)
```

## Animation

Use Tailwind's transition utilities:

```css
/* Standard transition */
transition-colors duration-200

/* For transforms */
transition-transform duration-200

/* For all properties */
transition-all duration-200
```

Respect reduced motion preferences:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
