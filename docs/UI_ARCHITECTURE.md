# UI Component Architecture

## Overview

This project uses **three distinct UI component systems** for different purposes, with a clear separation of concerns between general application UI and the Plate.js rich text editor.

## Architecture Summary

```
src/components/
├── ui/                 # MIXED: BaseUI primitives + Plate.js editor components
│   ├── [primitives]    #   ~51 files: BaseUI-based (button, dialog, tooltip, etc.)
│   ├── [plate-nodes]   #   ~89 files: Plate.js editor nodes & toolbars
│   └── ui/             #   ~52 files: DUPLICATE BaseUI components (historical)
├── ui-plate/           # Radix UI primitives ONLY for Plate.js internal use
│   └── [9 files]       #   button, dialog, dropdown-menu, etc.
└── [feature]/          # Domain components using ui/ components
```

## Component Systems

### 1. BaseUI (Primary Design System)

- **Location**: `src/components/ui/` (root-level primitives)
- **Package**: `@base-ui/react` (^1.0.0)
- **Purpose**: Primary design system for all general application UI
- **Component Count**: ~51 primitive components
- **Usage**: All application pages, forms, navigation, modals

**Import Pattern:**
```typescript
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Tooltip, TooltipContent } from "@/components/ui/tooltip"
```

**Key Characteristics:**
- Uses `@base-ui/react` primitives (e.g., `Button as ButtonPrimitive`)
- Styled with `class-variance-authority` (cva) for variants
- Uses `data-slot` attributes for styling hooks
- Functions without explicit return types (needs fixing)

### 2. Radix UI (Plate.js Editor Internal)

- **Location**: `src/components/ui-plate/`
- **Package**: `@radix-ui/react-*` (various packages)
- **Purpose**: **EXCLUSIVELY** for Plate.js editor toolbar/popover components
- **Component Count**: 9 components
- **Usage**: Internal to Plate.js editor components only

**Components:**
| Component | File | Used By |
|-----------|------|---------|
| Button | `button.tsx` | Plate toolbar buttons |
| Dialog | `dialog.tsx` | Media preview, settings |
| DropdownMenu | `dropdown-menu.tsx` | Insert menus, format menus |
| Popover | `popover.tsx` | Color pickers, link forms |
| ContextMenu | `context-menu.tsx` | Block context actions |
| Tooltip | `tooltip.tsx` | Toolbar tooltips |
| Toggle | `toggle.tsx` | Format toggles |
| Separator | `separator.tsx` | Toolbar dividers |
| Input | `input.tsx` | URL/link inputs |

**Import Pattern (ONLY in ui/ Plate components):**
```typescript
// ONLY in src/components/ui/*-toolbar-button.tsx or *-node.tsx
import { Button } from '@/components/ui-plate/button';
import { DropdownMenu } from '@/components/ui-plate/dropdown-menu';
```

**Key Characteristics:**
- Uses `@radix-ui/react-*` primitives
- Has explicit `: ReactElement` return types (correctly typed)
- Specifically styled for editor toolbar aesthetics

### 3. Plate.js Editor Components

- **Location**: `src/components/ui/` (mixed with BaseUI)
- **Package**: `platejs` (^52.0.15) + `@platejs/*` plugins
- **Purpose**: Rich text editor nodes, toolbars, and UI elements
- **Component Count**: ~89 editor-specific components
- **Usage**: Lesson content editor, comments, messaging

**File Patterns:**
| Pattern | Purpose | Example |
|---------|---------|---------|
| `*-node.tsx` | Editor element renderers | `blockquote-node.tsx` |
| `*-node-static.tsx` | Static/read-only renderers | `heading-node-static.tsx` |
| `*-toolbar-button.tsx` | Toolbar action buttons | `align-toolbar-button.tsx` |
| `*-toolbar.tsx` | Toolbar containers | `fixed-toolbar.tsx`, `floating-toolbar.tsx` |
| `editor.tsx` | Main editor component | Core editor container |

**Key Characteristics:**
- Imports from `platejs/react` (e.g., `PlateElement`, `PlateContent`)
- Uses ui-plate components for toolbar primitives
- Functions without explicit return types (needs fixing)

## The `ui/ui/` Duplication Issue

### Current State

The `src/components/ui/ui/` folder contains **52 duplicate files** that are nearly identical copies of the parent `ui/` BaseUI components.

### Analysis

| File | `ui/` Version | `ui/ui/` Version | Differences |
|------|---------------|------------------|-------------|
| `button.tsx` | `forwardRef` pattern | function component | Minor style diff |
| `dialog.tsx` | Identical | Identical | None |
| `tooltip.tsx` | Identical | Identical | None |
| Others | Mostly identical | Mostly identical | Minor variations |

### Root Cause

This duplication likely occurred during:
1. A migration from Radix/shadcn to BaseUI
2. Plate.js component generation via CLI
3. Copy-paste during initial setup

### Import Analysis

```
Imports from @/components/ui/    → 499 occurrences (205 files)
Imports from @/components/ui/ui/ → 0 occurrences
Imports from @/components/ui-plate/ → 35 occurrences (35 files)
```

**Finding**: The `ui/ui/` folder is NOT imported anywhere. It is dead code.

## Component Mapping

### General UI Components (BaseUI)

| Component | Location | Primitive | Used In |
|-----------|----------|-----------|---------|
| Button | `ui/button.tsx` | `@base-ui/react/button` | Everywhere |
| Dialog | `ui/dialog.tsx` | `@base-ui/react/dialog` | Modals, forms |
| Tooltip | `ui/tooltip.tsx` | `@base-ui/react/tooltip` | Hover hints |
| DropdownMenu | `ui/dropdown-menu.tsx` | `@base-ui/react/menu` | Actions menus |
| Select | `ui/select.tsx` | `@base-ui/react/select` | Form selects |
| Popover | `ui/popover.tsx` | `@base-ui/react/popover` | Floating panels |
| Tabs | `ui/tabs.tsx` | `@base-ui/react/tabs` | Tab navigation |
| Switch | `ui/switch.tsx` | `@base-ui/react/switch` | Toggles |
| Checkbox | `ui/checkbox.tsx` | `@base-ui/react/checkbox` | Form checkboxes |
| Input | `ui/input.tsx` | `@base-ui/react/input` | Text inputs |
| ... | ... | ... | ... |

### Plate Editor Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Editor | `ui/editor.tsx` | Main editor container |
| Toolbar | `ui/toolbar.tsx` | Toolbar container |
| FixedToolbar | `ui/fixed-toolbar.tsx` | Top toolbar |
| FloatingToolbar | `ui/floating-toolbar.tsx` | Selection toolbar |
| BlockquoteNode | `ui/blockquote-node.tsx` | Quote blocks |
| HeadingNode | `ui/heading-node.tsx` | H1-H6 headings |
| LinkNode | `ui/link-node.tsx` | Hyperlinks |
| TableNode | `ui/table-node.tsx` | Tables |
| MediaNode | `ui/media-*-node.tsx` | Images, video, audio |
| ... | ... | ... |

## Import Guidelines

### For General Application UI

```typescript
// CORRECT - Use ui/ components
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Card, CardHeader, CardContent } from "@/components/ui/card"

// WRONG - Never use ui/ui/
import { Button } from "@/components/ui/ui/button" // ❌ DEPRECATED
```

### For Plate Editor Integration

```typescript
// In feature components that USE the editor
import { PlateEditor } from "@/components/editor/plate-editor"

// In editor plugin kits
import { Editor, EditorContainer } from "@/components/ui/editor"
import { Toolbar, ToolbarButton } from "@/components/ui/toolbar"
```

### For Plate Internal Components

```typescript
// ONLY in src/components/ui/*-toolbar-button.tsx or *-node.tsx files
// Use Radix primitives for editor toolbar internals
import { Button } from '@/components/ui-plate/button';
import { DropdownMenu } from '@/components/ui-plate/dropdown-menu';
```

## Recommendations

### Immediate Actions

1. **Remove `ui/ui/` folder** - It contains 52 unused duplicate files
   - Verify no imports exist: `grep -r "ui/ui/" src/` returns 0 matches
   - Delete safely: `rm -rf src/components/ui/ui/`

2. **Add explicit return types** to BaseUI components in `ui/`
   - Affects ~51 files with missing `: ReactElement` return types
   - Required by TypeScript strict mode

### Architecture Decisions

| Scenario | Decision | Rationale |
|----------|----------|-----------|
| New UI component | Use BaseUI via `@base-ui/react` | Project standard |
| Plate editor feature | Add to `ui/*-node.tsx` or `ui/*-toolbar-button.tsx` | Keeps editor code together |
| Plate internal primitive | Modify `ui-plate/*.tsx` | Radix required by Plate |
| Feature component | Import from `@/components/ui/` | Application design system |

### Future Considerations

1. **Consider renaming** `ui/` to `ui-base/` for clarity
2. **Extract Plate components** to `ui-plate-nodes/` for better separation
3. **Document which Radix packages** are required by Plate vs. can be removed

## Files Requiring Return Type Fixes

### `src/components/ui/` (BaseUI - needs fixes)

The following ~51 files need explicit `: ReactElement` return types:

```
accordion.tsx, alert-dialog.tsx, alert.tsx, aspect-ratio.tsx, avatar.tsx,
badge.tsx, breadcrumb.tsx, button-group.tsx, button.tsx, calendar.tsx,
card.tsx, carousel.tsx, chart.tsx, checkbox.tsx, collapsible.tsx,
combobox.tsx, command.tsx, context-menu.tsx, dialog.tsx, drawer.tsx,
dropdown-menu.tsx, empty.tsx, field.tsx, form.tsx, hover-card.tsx,
input-group.tsx, input-otp.tsx, input.tsx, item.tsx, kbd.tsx, label.tsx,
menubar.tsx, navigation-menu.tsx, pagination.tsx, popover.tsx, progress.tsx,
radio-group.tsx, resizable.tsx, scroll-area.tsx, select.tsx, separator.tsx,
sheet.tsx, sidebar.tsx, skeleton.tsx, slider.tsx, sonner.tsx, spinner.tsx,
switch.tsx, table.tsx, tabs.tsx, textarea.tsx, toggle-group.tsx, toggle.tsx,
tooltip.tsx
```

### `src/components/ui-plate/` (Radix - already correct)

All 9 files already have explicit `: ReactElement` return types. No changes needed.

### Files to NOT Modify

1. `src/components/ui/*-node.tsx` - Plate editor nodes (89 files)
2. `src/components/ui/*-toolbar*.tsx` - Plate toolbars (~20 files)
3. `src/components/ui/editor*.tsx` - Editor core components

These are generated/configured by Plate.js and should follow Plate conventions.

## Quality Gates Checklist

- [x] All UI folders examined
- [x] Component origins identified (BaseUI vs Radix vs Plate)
- [x] Import patterns documented
- [x] `docs/UI_ARCHITECTURE.md` created
- [x] Recommendation provided (D - Mixed components requiring separation)
- [x] Files needing return type fixes listed
- [x] Files that should NOT be modified listed

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Application Layer                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Feature Components (courses, admin, messaging, etc.)        │    │
│  │  Import from: @/components/ui/*                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         UI Layer                                     │
│  ┌────────────────────────┐    ┌────────────────────────────────┐   │
│  │   BaseUI Primitives    │    │   Plate.js Editor Components   │   │
│  │   (src/components/ui/) │    │   (src/components/ui/*-node)   │   │
│  │                        │    │                                │   │
│  │  • Button              │    │  • Editor, EditorContainer     │   │
│  │  • Dialog              │    │  • HeadingNode, BlockquoteNode │   │
│  │  • Tooltip             │    │  • FixedToolbar, FloatingToolbar│  │
│  │  • Select              │    │  • Various toolbar buttons     │   │
│  │  • Card, Badge, etc.   │    │                                │   │
│  │                        │    │         │                      │   │
│  │  @base-ui/react        │    │         ▼                      │   │
│  └────────────────────────┘    │  ┌──────────────────────┐      │   │
│                                │  │ Radix UI (ui-plate/) │      │   │
│                                │  │ • Button, Dialog     │      │   │
│                                │  │ • DropdownMenu       │      │   │
│                                │  │ • Tooltip, Popover   │      │   │
│                                │  │                      │      │   │
│                                │  │ @radix-ui/react-*    │      │   │
│                                │  └──────────────────────┘      │   │
│                                └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Primitive Libraries                             │
│  ┌────────────────────────┐    ┌────────────────────────────────┐   │
│  │  @base-ui/react ^1.0   │    │  @radix-ui/react-* ^1-2.x      │   │
│  │  (Primary UI system)   │    │  (Plate editor internals)      │   │
│  └────────────────────────┘    └────────────────────────────────┘   │
│                                                                      │
│  ┌────────────────────────┐    ┌────────────────────────────────┐   │
│  │  platejs ^52.0.15      │    │  @platejs/* ^52.0.x            │   │
│  │  (Editor core)         │    │  (Editor plugins)              │   │
│  └────────────────────────┘    └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

*Last updated: 2026-01-03*
*Architecture Version: 1.0*
