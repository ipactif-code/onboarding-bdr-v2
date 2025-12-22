---
name: ui-components
description: "UI component patterns and best practices for shadcn/ui, Base UI, Radix UI, Tailwind CSS 4, and Plate.js. Use when working on files in src/components/ui/**, src/components/ui-nova/**, src/components/ui-plate/**, when creating components, adding variants, modifying design system, creating forms, or integrating the rich-text editor. Triggers on keywords: shadcn, Radix, Base UI, Tailwind, cva, cn, buttonVariants, Dialog, Plate, editor, variant, design system."
---

# UI Components Skill

Build accessible, themeable components using shadcn/ui patterns with Base UI and Radix primitives.

## Technology Stack

| Library | Version | Purpose |
|---------|---------|---------|
| shadcn/ui | style "base-nova" | RSC-compatible component library |
| @base-ui/react | latest | Headless primitives (preferred) |
| radix-ui | latest | Slot, specific primitives |
| Tailwind CSS | v4.x | CSS-first with @theme inline |
| class-variance-authority | latest | Variant definitions |
| Plate.js | latest | Rich-text editor |

## Quick Start

### Button Component

```tsx
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        outline: "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

interface ButtonProps extends ButtonPrimitive.Props, VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

### cn Utility

```tsx
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

## Decision Tree

### Choosing a Primitive

```
Need component? → Check Base UI first
├─ Base UI has it? → Use @base-ui/react/[component]
├─ Complex composition needed? → Use Radix Slot for polymorphism
├─ Rich text editing? → Use Plate.js
└─ Form validation? → Use react-hook-form + zod + shadcn Form
```

### When to Create a Variant vs New Component

```
Style variation only? → Add variant to existing cva()
├─ Different behavior/structure? → Create new component
├─ Different primitive needed? → Create new component
└─ Compound component pattern? → Create subcomponents (Root, Trigger, Content)
```

## Strict Rules

### ALWAYS

- Add `data-slot="component-name"` on root element
- Use `cn()` for all className merging
- Use `cva()` for variant definitions
- Export variants object (e.g., `buttonVariants`)
- Include focus states: `focus-visible:ring-ring/50 focus-visible:ring-[3px]`
- Support dark mode with `dark:` variants
- Meet WCAG 2.1 AA compliance

### NEVER

- Use inline className without `cn()`
- Create components without dark mode support
- Skip `data-slot` attribute
- Hardcode colors (use CSS variables)

### Icon Positioning

```tsx
// Inline start (before text)
<Button>
  <Icon data-icon="inline-start" />
  Label
</Button>

// Inline end (after text)
<Button>
  Label
  <Icon data-icon="inline-end" />
</Button>
```

### Touch Targets

Mobile buttons require minimum touch area:

```tsx
// Add to interactive elements for mobile
className="min-h-11 min-w-11"
```

## Component Anatomy

```tsx
// Standard component structure
import { Primitive } from "@base-ui/react/[primitive]"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// 1. Define variants with cva
const componentVariants = cva("base-classes", {
  variants: { /* ... */ },
  defaultVariants: { /* ... */ },
})

// 2. Define props interface
interface ComponentProps 
  extends Primitive.Props, 
  VariantProps<typeof componentVariants> {}

// 3. Create component with data-slot
function Component({ className, variant, ...props }: ComponentProps) {
  return (
    <Primitive
      data-slot="component"
      className={cn(componentVariants({ variant, className }))}
      {...props}
    />
  )
}

// 4. Export component AND variants
export { Component, componentVariants }
```

## References

| Topic | File | When to Read |
|-------|------|--------------|
| shadcn patterns | [shadcn-patterns.md](references/shadcn-patterns.md) | Creating Dialog, Sheet, Form, Tabs, etc. |
| Base UI primitives | [baseui-primitives.md](references/baseui-primitives.md) | Using headless primitives |
| Radix primitives | [radix-primitives.md](references/radix-primitives.md) | Using Slot, polymorphism |
| Tailwind v4 | [tailwind-system.md](references/tailwind-system.md) | Theming, CSS variables, @theme |
| Plate editor | [plate-editor.md](references/plate-editor.md) | Rich-text editor integration |
