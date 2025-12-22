# Radix UI Primitives

Radix UI is used selectively when Base UI doesn't provide the needed functionality, particularly for the Slot primitive and polymorphism patterns.

## Table of Contents

1. [When to Use Radix](#when-to-use-radix)
2. [Slot Primitive](#slot-primitive)
3. [asChild Pattern](#aschild-pattern)
4. [Specific Primitives](#specific-primitives)

---

## When to Use Radix

| Use Case | Library |
|----------|---------|
| General components | Base UI (preferred) |
| Polymorphism with `asChild` | Radix Slot |
| Form components (FormControl) | Radix Slot |
| Components not in Base UI | Radix |

---

## Slot Primitive

The Slot component merges its props onto its immediate child.

```tsx
import { Slot } from "@radix-ui/react-slot"
```

### Basic Usage

```tsx
// Slot passes all props to its child
<Slot className="text-red-500" onClick={handleClick}>
  <button>Click me</button>
</Slot>

// Renders as:
<button class="text-red-500" onclick="...">Click me</button>
```

### Practical Example: Polymorphic Button

```tsx
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva("inline-flex items-center justify-center ...", {
  variants: { variant: { /* ... */ }, size: { /* ... */ } },
  defaultVariants: { variant: "default", size: "default" },
})

interface ButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
```

### Usage with asChild

```tsx
// Standard button
<Button>Click me</Button>

// As a link (renders <a> with button styles)
<Button asChild>
  <a href="/dashboard">Go to Dashboard</a>
</Button>

// As Next.js Link
<Button asChild>
  <Link href="/dashboard">Go to Dashboard</Link>
</Button>

// As custom component
<Button asChild variant="ghost">
  <MyCustomComponent prop="value">Content</MyCustomComponent>
</Button>
```

---

## asChild Pattern

### When to Use asChild

- **Navigation buttons**: Render as `<a>` or `<Link>`
- **Form triggers**: Render Dialog trigger as submit button
- **Custom wrappers**: Apply button styles to custom components

### Implementing asChild

```tsx
import { Slot } from "@radix-ui/react-slot"
import * as React from "react"

interface ComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
}

function Component({ asChild = false, ...props }: ComponentProps) {
  const Comp = asChild ? Slot : "div"
  return <Comp data-slot="component" {...props} />
}
```

### Ref Forwarding with asChild

```tsx
import { Slot } from "@radix-ui/react-slot"
import * as React from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp ref={ref} data-slot="button" {...props} />
  }
)
Button.displayName = "Button"
```

---

## Specific Primitives

### Avatar

```tsx
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cn } from "@/lib/utils"

function Avatar({ className, ...props }: AvatarPrimitive.AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-10 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: AvatarPrimitive.AvatarImageProps) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      {...props}
    />
  )
}

function AvatarFallback({ className, ...props }: AvatarPrimitive.AvatarFallbackProps) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
```

### Label

```tsx
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

function Label({ className, ...props }: LabelPrimitive.LabelProps & VariantProps<typeof labelVariants>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(labelVariants(), className)}
      {...props}
    />
  )
}

export { Label }
```

### Separator

```tsx
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: SeparatorPrimitive.SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
```

### Collapsible

```tsx
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
```

### Aspect Ratio

```tsx
import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio"

function AspectRatio(props: AspectRatioPrimitive.AspectRatioProps) {
  return <AspectRatioPrimitive.Root data-slot="aspect-ratio" {...props} />
}

export { AspectRatio }
```

---

## Radix vs Base UI Decision

```
Component needed?
├─ Is it Slot/polymorphism? → Radix Slot
├─ Is it in Base UI? → Use Base UI
├─ Is it only in Radix? → Use Radix
└─ Neither? → Build custom with Base UI primitives
```

### Components Only in Radix (not in Base UI)

- Avatar
- Aspect Ratio
- Label
- Separator
- Collapsible
- Scroll Area
- Hover Card
- Context Menu
- Navigation Menu
- Accordion
- Toggle / Toggle Group
- Alert Dialog (specialized Dialog)

### Components in Both (prefer Base UI)

- Dialog
- Dropdown Menu
- Popover
- Select
- Tabs
- Checkbox
- Radio Group
- Switch
- Slider
- Progress
- Tooltip
