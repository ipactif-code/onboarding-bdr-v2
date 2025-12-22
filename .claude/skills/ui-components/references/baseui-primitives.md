# Base UI Primitives

@base-ui/react provides headless, unstyled React components. Prefer Base UI over Radix for new components.

## Table of Contents

1. [Available Primitives](#available-primitives)
2. [Import Pattern](#import-pattern)
3. [Common Patterns](#common-patterns)
4. [Component Examples](#component-examples)

---

## Available Primitives

| Primitive | Import | Use Case |
|-----------|--------|----------|
| Button | `@base-ui/react/button` | Clickable buttons |
| Checkbox | `@base-ui/react/checkbox` | Boolean selection |
| Dialog | `@base-ui/react/dialog` | Modal dialogs, sheets |
| Field | `@base-ui/react/field` | Form field wrapper |
| Form | `@base-ui/react/form` | Form container |
| Input | `@base-ui/react/input` | Text input |
| Menu | `@base-ui/react/menu` | Dropdown menus |
| NumberField | `@base-ui/react/number-field` | Numeric input |
| Popover | `@base-ui/react/popover` | Floating content |
| Progress | `@base-ui/react/progress` | Progress indicators |
| RadioGroup | `@base-ui/react/radio-group` | Single selection |
| Select | `@base-ui/react/select` | Dropdown select |
| Slider | `@base-ui/react/slider` | Range slider |
| Switch | `@base-ui/react/switch` | Toggle switch |
| Tabs | `@base-ui/react/tabs` | Tab navigation |
| Tooltip | `@base-ui/react/tooltip` | Hover tooltips |

---

## Import Pattern

```tsx
// Import specific primitive
import { Button } from "@base-ui/react/button"
import { Dialog } from "@base-ui/react/dialog"
import { Menu } from "@base-ui/react/menu"

// Each primitive exposes subcomponents
// Dialog.Root, Dialog.Trigger, Dialog.Portal, Dialog.Popup, etc.
```

---

## Common Patterns

### Data Attributes for Styling

Base UI uses data attributes instead of className for state:

```tsx
// Instead of adding/removing classes, use data attributes
<Button
  className={cn(
    "base-styles",
    "data-[disabled]:opacity-50",     // Disabled state
    "data-[pressed]:scale-95",        // Pressed state
    "data-[focused]:ring-2",          // Focused state
    "data-[state=open]:bg-accent",    // Open state (dialogs, menus)
    "data-[selected]:bg-primary",     // Selected state (tabs, radio)
  )}
/>
```

### Compound Component Pattern

Base UI components use compound pattern:

```tsx
<Dialog.Root>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Popup>
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description>Description</Dialog.Description>
      <Dialog.Close>Close</Dialog.Close>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

### Controlled vs Uncontrolled

```tsx
// Uncontrolled (internal state)
<Dialog.Root defaultOpen={false}>

// Controlled (external state)
const [open, setOpen] = useState(false)
<Dialog.Root open={open} onOpenChange={setOpen}>
```

---

## Component Examples

### Button

```tsx
import { Button } from "@base-ui/react/button"

function MyButton({ className, ...props }: Button.Props) {
  return (
    <Button
      data-slot="button"
      className={cn(
        "inline-flex items-center justify-center rounded-lg px-4 py-2",
        "text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[pressed]:scale-[0.98]",
        className
      )}
      {...props}
    />
  )
}
```

### Checkbox

```tsx
import { Checkbox } from "@base-ui/react/checkbox"
import { Check } from "lucide-react"

function MyCheckbox({ className, ...props }: Checkbox.RootProps) {
  return (
    <Checkbox.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded border border-primary shadow",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[checked]:bg-primary data-[checked]:text-primary-foreground",
        className
      )}
      {...props}
    >
      <Checkbox.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3.5" />
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
}
```

### Switch

```tsx
import { Switch } from "@base-ui/react/switch"

function MySwitch({ className, ...props }: Switch.RootProps) {
  return (
    <Switch.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full",
        "border-2 border-transparent shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[checked]:bg-primary data-[unchecked]:bg-input",
        className
      )}
      {...props}
    >
      <Switch.Thumb
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
          "data-[checked]:translate-x-4 data-[unchecked]:translate-x-0"
        )}
      />
    </Switch.Root>
  )
}
```

### Select

```tsx
import { Select } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"

function MySelect({ children, ...props }: Select.RootProps) {
  return (
    <Select.Root data-slot="select" {...props}>
      <Select.Trigger
        data-slot="select-trigger"
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input",
          "bg-transparent px-3 py-2 text-sm shadow-sm",
          "focus:outline-none focus:ring-[3px] focus:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[&>span]:truncate"
        )}
      >
        <Select.Value placeholder="Select..." />
        <Select.Icon>
          <ChevronDown className="size-4 opacity-50" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup
            data-slot="select-content"
            className={cn(
              "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border",
              "bg-popover text-popover-foreground shadow-md",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            )}
          >
            <Select.ScrollUpArrow />
            {children}
            <Select.ScrollDownArrow />
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

function SelectItem({ className, children, ...props }: Select.ItemProps) {
  return (
    <Select.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2",
        "text-sm outline-none focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <Select.ItemIndicator>
          <Check className="size-4" />
        </Select.ItemIndicator>
      </span>
      <Select.ItemText>{children}</Select.ItemText>
    </Select.Item>
  )
}
```

### Tooltip

```tsx
import { Tooltip } from "@base-ui/react/tooltip"

function MyTooltip({ children, content, ...props }: Tooltip.RootProps & { content: React.ReactNode }) {
  return (
    <Tooltip.Root {...props}>
      <Tooltip.Trigger data-slot="tooltip-trigger">
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={4}>
          <Tooltip.Popup
            data-slot="tooltip-content"
            className={cn(
              "z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5",
              "text-xs text-primary-foreground shadow-md",
              "animate-in fade-in-0 zoom-in-95"
            )}
          >
            {content}
            <Tooltip.Arrow className="fill-primary" />
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
```

### Slider

```tsx
import { Slider } from "@base-ui/react/slider"

function MySlider({ className, ...props }: Slider.RootProps) {
  return (
    <Slider.Root
      data-slot="slider"
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      {...props}
    >
      <Slider.Track
        data-slot="slider-track"
        className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20"
      >
        <Slider.Indicator
          data-slot="slider-range"
          className="absolute h-full bg-primary"
        />
      </Slider.Track>
      <Slider.Thumb
        data-slot="slider-thumb"
        className={cn(
          "block size-4 rounded-full border border-primary/50 bg-background shadow",
          "transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      />
    </Slider.Root>
  )
}
```

### Progress

```tsx
import { Progress } from "@base-ui/react/progress"

function MyProgress({ value, className, ...props }: Progress.RootProps & { value: number }) {
  return (
    <Progress.Root
      data-slot="progress"
      value={value}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      {...props}
    >
      <Progress.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </Progress.Root>
  )
}
```

---

## Migration from Radix

When migrating from Radix UI to Base UI:

| Radix | Base UI |
|-------|---------|
| `@radix-ui/react-dialog` | `@base-ui/react/dialog` |
| `DialogPrimitive.Overlay` | `Dialog.Backdrop` |
| `DialogPrimitive.Content` | `Dialog.Popup` |
| `data-state="open"` | `data-[state=open]` |
| `asChild` | Native polymorphism via `render` prop |

### Polymorphism Difference

```tsx
// Radix: uses asChild
<Dialog.Trigger asChild>
  <Button>Open</Button>
</Dialog.Trigger>

// Base UI: uses render prop
<Dialog.Trigger render={<Button />}>
  Open
</Dialog.Trigger>
```
