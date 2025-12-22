# Tailwind CSS v4 System

CSS-first configuration with @theme inline directive and CSS variables for theming.

## Table of Contents

1. [CSS-First Configuration](#css-first-configuration)
2. [Theme Variables](#theme-variables)
3. [Color System](#color-system)
4. [Dark Mode](#dark-mode)
5. [Custom Utilities](#custom-utilities)
6. [Animation System](#animation-system)

---

## CSS-First Configuration

Tailwind v4 uses CSS-based configuration instead of tailwind.config.js.

### Main CSS File Structure

```css
/* src/app/globals.css */
@import "tailwindcss";

@theme inline {
  /* Map CSS variables to Tailwind utilities */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);

  /* Radius */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  /* Shadows */
  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
}

/* Define CSS variables */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
}
```

---

## Theme Variables

### @theme inline Syntax

```css
@theme inline {
  /* Colors - prefix with --color- */
  --color-brand: #3b82f6;
  --color-brand-50: #eff6ff;
  --color-brand-100: #dbeafe;
  
  /* Spacing - prefix with --spacing- */
  --spacing-18: 4.5rem;
  --spacing-128: 32rem;
  
  /* Font sizes - prefix with --text- */
  --text-xxs: 0.625rem;
  --text-xxs--line-height: 1rem;
  
  /* Font families - prefix with --font- */
  --font-display: "Cal Sans", sans-serif;
  
  /* Radius - prefix with --radius- */
  --radius-4xl: 2rem;
  
  /* Shadows - prefix with --shadow- */
  --shadow-glow: 0 0 20px rgb(59 130 246 / 0.5);
  
  /* Z-index - prefix with --z- */
  --z-dropdown: 100;
  --z-modal: 200;
}
```

### Using Theme Variables in Components

```tsx
// Use directly in className
<div className="bg-brand text-brand-foreground">
<div className="rounded-4xl shadow-glow">
<div className="z-modal">
```

---

## Color System

### OKLCH Color Format

Use OKLCH for perceptually uniform colors:

```css
/* oklch(lightness chroma hue) */
--primary: oklch(0.5 0.2 250);        /* L=50%, C=0.2, H=250° (blue) */
--primary-light: oklch(0.7 0.15 250); /* Lighter variant */
--primary-dark: oklch(0.3 0.25 250);  /* Darker variant */
```

### Semantic Color Tokens

```css
:root {
  /* Background layers */
  --background: oklch(1 0 0);           /* Page background */
  --card: oklch(1 0 0);                 /* Card surfaces */
  --popover: oklch(1 0 0);              /* Floating elements */
  
  /* Text colors */
  --foreground: oklch(0.145 0 0);       /* Primary text */
  --muted-foreground: oklch(0.556 0 0); /* Secondary text */
  
  /* Interactive states */
  --accent: oklch(0.97 0 0);            /* Hover backgrounds */
  --accent-foreground: oklch(0.205 0 0);/* Hover text */
  
  /* Form elements */
  --input: oklch(0.922 0 0);            /* Input borders */
  --ring: oklch(0.708 0 0);             /* Focus ring */
  
  /* Status colors */
  --destructive: oklch(0.577 0.245 27); /* Error/danger */
  --success: oklch(0.6 0.2 145);        /* Success */
  --warning: oklch(0.75 0.2 85);        /* Warning */
}
```

---

## Dark Mode

### Class-Based Dark Mode

```css
/* globals.css */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
}
```

### Using Dark Mode in Components

```tsx
// Dark mode variants
<div className="bg-background text-foreground">
  {/* Automatically adapts to theme */}
</div>

// Explicit dark mode overrides
<div className="bg-white dark:bg-gray-900">
  <p className="text-gray-900 dark:text-gray-100">Content</p>
</div>
```

### Theme Provider Setup

```tsx
// components/theme-provider.tsx
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

// app/layout.tsx
import { ThemeProvider } from "@/components/theme-provider"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

---

## Custom Utilities

### Adding Custom Utilities with @layer

```css
@layer utilities {
  /* Hide scrollbar */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  /* Text balance */
  .text-balance {
    text-wrap: balance;
  }

  /* Gradient text */
  .text-gradient {
    background: linear-gradient(to right, var(--primary), var(--accent));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}
```

### Adding Custom Components with @layer

```css
@layer components {
  .btn {
    @apply inline-flex items-center justify-center rounded-lg px-4 py-2;
    @apply text-sm font-medium transition-colors;
    @apply focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50;
  }

  .card {
    @apply rounded-xl border bg-card text-card-foreground shadow;
  }

  .input {
    @apply flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1;
    @apply text-sm shadow-sm transition-colors;
    @apply placeholder:text-muted-foreground;
    @apply focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50;
    @apply disabled:cursor-not-allowed disabled:opacity-50;
  }
}
```

---

## Animation System

### Keyframe Animations

```css
@theme inline {
  /* Animation durations */
  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;
  --animate-collapsible-down: collapsible-down 0.2s ease-out;
  --animate-collapsible-up: collapsible-up 0.2s ease-out;
}

@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}

@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}

@keyframes collapsible-down {
  from { height: 0; }
  to { height: var(--radix-collapsible-content-height); }
}

@keyframes collapsible-up {
  from { height: var(--radix-collapsible-content-height); }
  to { height: 0; }
}
```

### Tailwind Animate Plugin Classes

```tsx
// Enter animations
<div className="animate-in fade-in-0 zoom-in-95">
<div className="animate-in slide-in-from-top-2">
<div className="animate-in slide-in-from-bottom-2">
<div className="animate-in slide-in-from-left-2">
<div className="animate-in slide-in-from-right-2">

// Exit animations
<div className="animate-out fade-out-0 zoom-out-95">
<div className="animate-out slide-out-to-top-2">

// Duration modifiers
<div className="duration-200">
<div className="duration-300">
<div className="duration-500">
```

---

## Responsive Design

### Breakpoint Tokens

```css
@theme inline {
  /* Custom breakpoints */
  --breakpoint-xs: 475px;
  --breakpoint-3xl: 1920px;
}
```

### Mobile-First Approach

```tsx
<div className="
  w-full                    /* Mobile: full width */
  sm:w-1/2                  /* ≥640px: half width */
  md:w-1/3                  /* ≥768px: third width */
  lg:w-1/4                  /* ≥1024px: quarter width */
">

<button className="
  min-h-11 min-w-11         /* Touch target for mobile */
  sm:min-h-9 sm:min-w-9     /* Smaller on desktop */
">
```

### Container Queries (v4)

```tsx
<div className="@container">
  <div className="@lg:flex @lg:gap-4">
    {/* Responds to container size, not viewport */}
  </div>
</div>
```
