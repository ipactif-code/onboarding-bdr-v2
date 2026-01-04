# Component Extraction Analysis: Editor & Collaboration

This document provides detailed extraction analysis for all editor-related and collaboration components from the Potion template.

---

## Table of Contents

1. [Editor Core Components (T000k)](#1-editor-core-components-t000k)
2. [Toolbar Components (T000l)](#2-toolbar-components-t000l)
3. [Slash Command Menu (T000m)](#3-slash-command-menu-t000m)
4. [Block Components Inventory (T000n)](#4-block-components-inventory-t000n)
5. [Hocuspocus Setup (T000o)](#5-hocuspocus-setup-t000o)
6. [Collaboration Components (T000p-q)](#6-collaboration-components-t000p-q)

---

## 1. Editor Core Components (T000k)

### 1.1 Main Editor Wrapper

**File:** `src/components/editor/plate-editor.tsx`

```
PlateEditor
  |
  +-- Dependencies
  |     +-- @platejs/ai/react (AIChatPlugin)
  |     +-- @tanstack/react-query (useQuery)
  |     +-- platejs/react (usePluginOption)
  |     +-- yjsPlugin (from plate-provider)
  |
  +-- Features
  |     +-- Table of Contents sidebar toggle
  |     +-- Full width / default layout variants
  |     +-- Small text mode
  |     +-- Custom font styles
  |     +-- YJS loading state with skeleton
  |
  +-- Child Components
        +-- TocSidebar (when toc enabled)
        +-- EditorContainer
        +-- Editor
```

**Adaptation Notes:**
- **REMOVE:** tRPC `useDocumentQueryOptions` hook - Replace with Convex `useQuery`
- **REPLACE:** `TEXT_STYLE_ITEMS` config with our own design system
- **KEEP:** YJS loading state pattern with Skeleton

**Complexity Score:** 3/5 (moderate tRPC dependencies)

---

### 1.2 Plate Provider

**File:** `src/components/editor/plate-provider.tsx`

```
DocumentPlate (main authenticated editor)
  |
  +-- Dependencies
  |     +-- @platejs/yjs (YjsPlugin, BaseYjsPlugin)
  |     +-- platejs/react (Plate, usePlateEditor, createPlateEditor)
  |     +-- @tanstack/react-query
  |     +-- useSession (auth)
  |     +-- tRPC hooks
  |
  +-- Features
  |     +-- YJS real-time collaboration setup
  |     +-- Hocuspocus provider configuration
  |     +-- User cursor color generation (based on username hash)
  |     +-- Template document support
  |     +-- ReadOnly mode (locked/archived documents)
  |     +-- Auto-save with debounce
  |     +-- Value transition between YJS/non-YJS modes
  |
  +-- YJS Configuration
        +-- providers: [{ type: 'hocuspocus', url, name }]
        +-- cursors: { data: { color, name } }
        +-- RemoteCursorOverlay component

PublicPlate (public/demo editor)
  |
  +-- Uses localStorage for persistence
  +-- Debounced local saves

PrintPlate (print mode)
  |
  +-- ReadOnly mode
  +-- Selectively disable media
```

**Key Code Pattern - YJS Setup:**
```typescript
const editor = usePlateEditor({
  id: documentId,
  plugins: [
    ...EditorKit,
    yjsPlugin.configure({
      enabled: isYjsEnabled,
      options: {
        cursors: {
          data: { color: cursorColor, name: username },
        },
        providers: [{
          options: { name: documentId!, url: env.NEXT_PUBLIC_YJS_URL },
          type: 'hocuspocus' as const,
        }],
      },
      render: {
        afterEditable: RemoteCursorOverlay,
      },
    }),
  ],
  skipInitialization: !!isYjsEnabled,
  value: isYjsEnabled ? undefined : valueToUse,
  userId: user?.id,
}, [documentId, isYjsEnabled]);
```

**Adaptation Notes:**
- **REPLACE:** tRPC hooks with Convex `useQuery`/`useMutation`
- **REPLACE:** `useSession` with Clerk `useUser`
- **KEEP:** YJS plugin configuration pattern
- **KEEP:** Cursor color generation algorithm
- **MODIFY:** Environment variable for Hocuspocus URL

**Complexity Score:** 5/5 (heavy tRPC/auth dependencies)

---

### 1.3 Editor Kit Assembly

**File:** `src/components/editor/editor-kit-app.tsx`

```
EditorKit Plugin List
  |
  +-- AI Plugins
  |     +-- CopilotKit
  |     +-- AIKit
  |
  +-- Selection Plugins
  |     +-- BlockMenuKit
  |     +-- BlockSelectionKit
  |
  +-- Element Plugins (Block Types)
  |     +-- BasicBlocksKit (p, h1-h3, blockquote, hr)
  |     +-- CodeBlockKit
  |     +-- TableKit
  |     +-- ToggleKit (collapsible)
  |     +-- TocKit (table of contents)
  |     +-- MediaKit (image, video, audio, file)
  |     +-- CalloutKit
  |     +-- ColumnKit
  |     +-- MathKit (equations)
  |     +-- DateKit
  |     +-- LinkKit
  |     +-- MentionKit
  |
  +-- Mark Plugins
  |     +-- BasicMarksKit (bold, italic, underline, code, etc.)
  |     +-- FontKit (colors, background)
  |
  +-- Structure Plugins
  |     +-- ListKit
  |
  +-- Collaboration Plugins
  |     +-- CommentKit
  |     +-- SuggestionKit
  |
  +-- Editing Plugins
  |     +-- SlashKit
  |     +-- AutoformatKit
  |     +-- CursorOverlayKit
  |     +-- DndKit (drag and drop)
  |     +-- EmojiKit
  |     +-- ExitBreakKit
  |     +-- TrailingBlockPlugin
  |
  +-- Parser Plugins
  |     +-- DocxKit
  |     +-- MarkdownKit
  |
  +-- UI Plugins
        +-- BlockPlaceholderKit
        +-- FloatingToolbarKit
```

**Adaptation Notes:**
- **CAN COPY:** Most plugin kits are self-contained
- **MODIFY:** Import paths to match our project structure
- **EVALUATE:** AI plugins (CopilotKit, AIKit) - may need custom implementation
- **CUSTOMIZE:** Comment/Suggestion kits for our discussion system

**Complexity Score:** 2/5 (mostly configuration)

---

### 1.4 Editor UI Components

**File:** `src/registry/ui/editor.tsx`

```
EditorContainer
  |
  +-- Variants: default, demo, comment, select
  +-- Uses PlateContainer
  +-- Focus management for comment variant

Editor
  |
  +-- Variants: ai, aiChat, comment, default, demo, fullWidth, select, update, versionHistory
  +-- Uses PlateContent
  +-- Custom styling with cva
```

**Adaptation Notes:**
- **CAN COPY:** Direct copy with path adjustments
- **MODIFY:** Remove unused variants (demo, versionHistory)
- **CUSTOMIZE:** Styling for our design system

**Complexity Score:** 1/5 (pure UI)

---

## 2. Toolbar Components (T000l)

### 2.1 Base Toolbar

**File:** `src/registry/ui/toolbar.tsx`

```
Toolbar Components
  |
  +-- Toolbar (root)
  |     +-- Variants: default, media
  |     +-- Uses Radix Toolbar primitive
  |
  +-- ToolbarToggleGroup
  +-- ToolbarToggleItem
  +-- ToolbarButton (with tooltip HOC)
  +-- ToolbarSeparator
  +-- ToolbarGroup (with auto separator)
  +-- ToolbarLink
```

**Key Pattern - Button Variants:**
```typescript
const toolbarButtonVariants = cva(
  'inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md font-medium text-foreground/80 text-sm...',
  {
    variants: {
      size: { default: 'h-10 px-3', lg: 'h-11 px-5', sm: 'h-[28px] px-1.5', none: '' },
      variant: {
        default: 'bg-transparent hover:bg-black/5 aria-checked:bg-accent...',
        media: 'no-focus-ring m-0 h-auto rounded-none... bg-black/20 px-1.5 py-1 text-white...',
        outline: 'border border-input bg-transparent...',
      },
    },
  }
);
```

**Adaptation Notes:**
- **CAN COPY:** Direct copy
- **MERGE:** With existing shadcn/ui button styles

**Complexity Score:** 1/5 (pure UI)

---

### 2.2 Floating Toolbar

**File:** `src/registry/ui/floating-toolbar.tsx`

```
FloatingToolbar
  |
  +-- Dependencies
  |     +-- @platejs/floating (useFloatingToolbar, offset, flip, shift)
  |     +-- @platejs/ai/react (AIChatPlugin)
  |     +-- @platejs/selection/react (BlockSelectionPlugin)
  |
  +-- Features
  |     +-- Position calculation with floating-ui
  |     +-- Auto-hide when AI chat open
  |     +-- Auto-hide when link editing
  |     +-- Auto-hide when selecting blocks
  |     +-- Animation (animate-zoom)
  |
  +-- Configuration
        +-- placement: 'top-start'
        +-- offset: { crossAxis: -24, mainAxis: 12 }
        +-- shift: { padding: 50 }
        +-- flip fallback placements
```

**Adaptation Notes:**
- **CAN COPY:** Core floating logic
- **REMOVE:** AI chat hiding logic if not using AI features
- **KEEP:** Floating-ui middleware configuration

**Complexity Score:** 2/5 (floating-ui integration)

---

### 2.3 Floating Toolbar Buttons

**File:** `src/registry/ui/floating-toolbar-buttons.tsx`

```
FloatingToolbarButtons
  |
  +-- Groups
  |     +-- AI Group: AIToolbarButton
  |     +-- Comment Group: CommentToolbarButton, SuggestionToolbarButton
  |     +-- Format Group: TurnIntoToolbarButton, Bold, Italic, Underline, Strike, Code, Equation, Link, FontColor
  |     +-- More Group: MoreToolbarButton
  |
  +-- Mark Buttons (Bold, Italic, etc.)
        +-- nodeType: KEYS.bold/italic/etc.
        +-- shortcut display
        +-- tooltip
```

**Adaptation Notes:**
- **CUSTOMIZE:** Remove AIToolbarButton if not using AI
- **KEEP:** Mark toolbar button pattern
- **CUSTOMIZE:** Add/remove buttons as needed

**Complexity Score:** 2/5 (composition of simpler components)

---

### 2.4 Floating Toolbar Kit

**File:** `src/components/editor/plugins/floating-toolbar-kit-app.tsx`

```typescript
export const FloatingToolbarKit = [
  createPlatePlugin({
    key: 'floating-toolbar',
    render: {
      afterEditable: () => (
        <FloatingToolbar>
          <FloatingToolbarButtons />
        </FloatingToolbar>
      ),
    },
  }),
];
```

**Adaptation Notes:**
- **CAN COPY:** Simple plugin wrapper pattern

**Complexity Score:** 1/5 (simple wrapper)

---

## 3. Slash Command Menu (T000m)

### 3.1 Slash Input Element

**File:** `src/registry/ui/slash-node.tsx`

```
SlashInputElement
  |
  +-- Uses InlineCombobox pattern
  +-- trigger: "/"
  |
  +-- Command Groups
        +-- AI: Ask AI (opens AIChatPlugin)
        +-- Basic blocks: Text, H1-H3, Lists, Toggle, Code, Table, Quote, Callout
        +-- Media: Image, Video, Audio, File
        +-- Advanced: TOC, Equation, 3 Columns
        +-- Inline: Inline Equation, Date
        +-- Turn into: (transform current block)
        +-- Actions: Delete, Duplicate
        +-- Colors: Text color, Background color
```

**Key Pattern - Group Definition:**
```typescript
type Group = {
  group: string;
  items: {
    icon: React.ReactNode;
    value: string;
    onSelect: (editor: PlateEditor, value: string) => void;
    description?: string;
    focusEditor?: boolean;
    keywords?: string[];
    label?: string;
  }[];
};
```

**Action Types:**
```typescript
// Block insertion
onSelect: (editor, value) => insertBlock(editor, value);

// Inline insertion
onSelect: (editor, value) => insertInlineElement(editor, value);

// Type transformation
onSelect: (editor) => setBlockType(editor, item.value);

// Special actions
onSelect: (editor) => editor.tf.removeNodes();
onSelect: (editor) => editor.getTransforms(BlockSelectionPlugin).blockSelection.duplicate();
```

**Adaptation Notes:**
- **CAN COPY:** Core slash menu structure
- **CUSTOMIZE:** Group definitions for our block types
- **REMOVE:** AI group if not needed
- **ADD:** Custom blocks (e.g., embed types specific to our platform)

**Complexity Score:** 3/5 (complex but self-contained)

---

### 3.2 Block Menu (Context Menu)

**File:** `src/registry/ui/block-menu.tsx`

```
BlockMenu (right-click / block selection menu)
  |
  +-- Dependencies
  |     +-- @platejs/selection/react (BlockMenuPlugin, BlockSelectionPlugin)
  |     +-- Custom Menu primitives (Ariakit-based)
  |
  +-- Menu Items
  |     +-- askAI (shortcut: Cmd+J)
  |     +-- caption (for media)
  |     +-- comment (shortcut: Cmd+Shift+M)
  |     +-- delete (shortcut: Del/Ctrl+D)
  |     +-- duplicate (shortcut: Cmd+D)
  |     +-- align: left/center/right (for media)
  |     +-- color (text + background submenu)
  |     +-- turnInto (block type transformation)
  |
  +-- Context-Aware Display
        +-- Media blocks: caption, align, delete, duplicate
        +-- Regular blocks: comment, AI, delete, duplicate, turnInto, color
```

**Adaptation Notes:**
- **CAN COPY:** Menu structure and keyboard shortcuts
- **REMOVE:** AI item if not needed
- **CUSTOMIZE:** Available actions based on our requirements

**Complexity Score:** 3/5 (complex Ariakit integration)

---

### 3.3 Inline Combobox

**File:** `src/registry/ui/inline-combobox.tsx`

```
InlineCombobox System
  |
  +-- InlineCombobox (context provider)
  |     +-- Handles trigger character (e.g., "/", "@")
  |     +-- Filter function
  |     +-- Ariakit ComboboxProvider
  |     +-- YJS collaboration awareness (userId check)
  |
  +-- InlineComboboxInput (search input)
  |     +-- Auto-sizing based on content
  |     +-- Shows trigger character
  |
  +-- InlineComboboxContent (dropdown)
  |     +-- Variants: default, emoji, mention, slash
  |     +-- Animated popover
  |
  +-- InlineComboboxItem
  |     +-- Filter visibility
  |     +-- Click handling with editor focus
  |
  +-- InlineComboboxEmpty
  +-- InlineComboboxGroup
  +-- InlineComboboxGroupLabel
  +-- InlineComboboxRow
```

**Key Feature - YJS Collaboration:**
```typescript
// Only the creator of the inline element can see the combobox
const isCreator = React.useMemo(() => {
  const elementUserId = (element as any).userId;
  const currentUserId = editor.meta.userId;
  if (!elementUserId) return true;
  return elementUserId === currentUserId;
}, [editor, element]);
```

**Adaptation Notes:**
- **CAN COPY:** Core combobox pattern
- **KEEP:** YJS awareness for collaboration
- **CUSTOMIZE:** Variants for our use cases

**Complexity Score:** 4/5 (complex state management)

---

## 4. Block Components Inventory (T000n)

### 4.1 Text Blocks

| Component | File | Complexity | Copy Strategy |
|-----------|------|------------|---------------|
| HeadingElement (H1, H2, H3) | `heading-node.tsx` | 1/5 | Direct copy |
| ParagraphElement | `paragraph-node.tsx` | 1/5 | Direct copy |
| BlockquoteElement | `blockquote-node.tsx` | 1/5 | Direct copy |

**HeadingElement Pattern:**
```typescript
const headingVariants = cva('relative mb-1 px-0.5 py-[3px] font-semibold leading-[1.3]!', {
  variants: {
    isFirstBlock: { false: '', true: 'mt-0!' },
    variant: {
      h1: 'mt-8 text-[1.875em]',
      h2: 'mt-[1.4em] text-[1.5em]',
      h3: 'mt-[1em] text-[1.25em]',
    },
  },
});
```

---

### 4.2 Code Blocks

| Component | File | Complexity | Copy Strategy |
|-----------|------|------------|---------------|
| CodeBlockElement | `code-block-node.tsx` | 3/5 | Copy with modifications |
| CodeLineElement | `code-block-node.tsx` | 1/5 | Direct copy |
| CodeSyntaxLeaf | `code-block-node.tsx` | 1/5 | Direct copy |

**Features:**
- Language selector dropdown (80+ languages)
- Syntax highlighting via highlight.js classes
- Copy code button
- Block action menu

**Adaptation Notes:**
- **KEEP:** Language list and selector
- **KEEP:** Syntax highlighting CSS classes
- **CUSTOMIZE:** Action buttons styling

---

### 4.3 List Components

| Component | File | Complexity | Copy Strategy |
|-----------|------|------------|---------------|
| BlockListElement | `block-list.tsx` | 2/5 | Copy |
| BlockListItemElement | `block-list.tsx` | 2/5 | Copy |
| TodoListElement | `block-list.tsx` | 2/5 | Copy with checkbox styling |

---

### 4.4 Table Components

| Component | File | Complexity | Copy Strategy |
|-----------|------|------------|---------------|
| TableElement | `table-node.tsx` | 4/5 | Copy with care |
| TableRowElement | `table-node.tsx` | 1/5 | Direct copy |
| TableCellElement | `table-node.tsx` | 4/5 | Copy with care |
| TableCellHeaderElement | `table-node.tsx` | 1/5 | Direct copy |

**Features:**
- Column/row resize handles
- Add row/column buttons
- Cell background colors
- Block selection integration
- Border customization

**Adaptation Notes:**
- **KEEP:** Resize functionality
- **KEEP:** Add buttons pattern
- **CUSTOMIZE:** Styling

---

### 4.5 Media Components

| Component | File | Complexity | Copy Strategy |
|-----------|------|------------|---------------|
| ImageElement | `media-image-node.tsx` | 4/5 | Major adaptation |
| VideoElement | `media-video-node.tsx` | 3/5 | Copy with adaptation |
| AudioElement | `media-audio-node.tsx` | 3/5 | Copy with adaptation |
| FileElement | `media-file-node.tsx` | 2/5 | Copy |
| MediaEmbedElement | `media-embed-node.tsx` | 3/5 | Copy |
| MediaPlaceholderElement | `media-placeholder-node.tsx` | 3/5 | Major adaptation |
| MediaToolbar | `media-toolbar.tsx` | 2/5 | Copy |

**Image Element Features:**
- Lazy loading with `react-lazy-load-image-component`
- Resize handles
- Drag and drop support
- Caption support
- Loading placeholder with shimmer
- Print mode optimization

**Adaptation Notes:**
- **REPLACE:** Upload mechanism (currently uses uploadthing)
- **KEEP:** Resize, caption, placeholder patterns
- **INTEGRATE:** With our Convex file storage

---

### 4.6 Special Blocks

| Component | File | Complexity | Copy Strategy |
|-----------|------|------------|---------------|
| CalloutElement | `callout-node.tsx` | 2/5 | Copy |
| ToggleElement | `toggle-node.tsx` | 2/5 | Copy |
| TocElement | `toc-node.tsx` | 3/5 | Copy |
| ColumnElement | `column-node.tsx` | 2/5 | Copy |
| DateElement | `date-node.tsx` | 2/5 | Copy |
| MentionElement | `mention-node.tsx` | 3/5 | Copy with user system |
| EquationElement | `equation-node.tsx` | 3/5 | Copy |
| HrElement | `hr-node.tsx` | 1/5 | Direct copy |

**CalloutElement Features:**
- Emoji icon picker
- Custom background color support

**ToggleElement Features:**
- Collapsible content
- Animated chevron icon

---

### 4.7 Mark/Inline Components

| Component | File | Complexity | Copy Strategy |
|-----------|------|------------|---------------|
| LinkNode | `link-node.tsx` | 2/5 | Copy |
| EmojiNode | `emoji-node.tsx` | 1/5 | Direct copy |
| CommentNode | `comment-node.tsx` | 3/5 | Copy with adaptation |
| SuggestionNode | `suggestion-node.tsx` | 3/5 | Copy with adaptation |

---

### 4.8 Static Variants (for rendering without editor)

All block components have `-static.tsx` variants for non-editable rendering:
- `heading-node-static.tsx`
- `paragraph-node-static.tsx`
- `code-block-node-static.tsx`
- `table-node-static.tsx`
- `media-image-node-static.tsx`
- etc.

**Use Case:** Rendering content in read-only contexts (previews, exports, etc.)

---

## 5. Hocuspocus Setup (T000o)

### 5.1 Server Configuration

**File:** `src/server/yjs/server.ts`

```
Hocuspocus Server
  |
  +-- Configuration
  |     +-- YJS_PORT: 4444 (default)
  |     +-- YJS_HOST: 0.0.0.0
  |     +-- YJS_PATH: /yjs
  |     +-- YJS_TIMEOUT: 10000ms
  |     +-- YJS_DEBOUNCE: 2000ms
  |     +-- YJS_MAX_DEBOUNCE: 10000ms
  |
  +-- Extensions
  |     +-- LoggerExtension (disabled in prod)
  |     +-- RedisExtension (for horizontal scaling)
  |
  +-- Hooks
        +-- onAuthenticate: Auth + permissions
        +-- onLoadDocument: Initial document load
        +-- onStoreDocument: Persist changes
        +-- onDestroy: Cleanup
```

**Key Pattern - Authentication:**
```typescript
onAuthenticate: async (payload) => {
  const context = payload.context as CollabContext;
  const documentId = payload.documentName;
  const docRecord = await ensureDocument(context, documentId);
  const { user } = await authenticateFromHeaders(payload.requestHeaders);

  // Anonymous users - read-only on published docs
  if (!user) {
    if (!docRecord.isPublished) {
      throw new Error('Unauthorized: Document is not published');
    }
    markReadOnly(context, payload.connectionConfig);
    return;
  }

  // Authenticated non-owner accessing unpublished doc
  if (!isOwner && !docRecord.isPublished) {
    throw new Error('Forbidden: Document is not published');
  }

  // Locked/archived docs are read-only
  if (docRecord.isArchived || docRecord.lockPage) {
    markReadOnly(context, payload.connectionConfig);
  }
}
```

**Adaptation Notes:**
- **REPLACE:** Prisma with Convex
- **REPLACE:** Auth with Clerk
- **KEEP:** Permission logic patterns
- **EVALUATE:** Redis extension (may use Convex for pub/sub instead)

**Complexity Score:** 5/5 (critical infrastructure)

---

### 5.2 Document Persistence

**File:** `src/server/yjs/document.ts`

```
Document Operations
  |
  +-- ensureDocument: Load or cache document record
  |
  +-- loadDocumentSnapshot
  |     +-- Priority: yjsSnapshot (binary) > contentRich (JSON)
  |     +-- Y.applyUpdate for binary format
  |     +-- slateNodesToInsertDelta for JSON migration
  |     +-- Auto-save yjsSnapshot after JSON migration
  |
  +-- storeDocumentSnapshot
        +-- Extract Slate value from Y.doc
        +-- Content length validation (1MB max)
        +-- Save: content (plaintext), contentRich (JSON), yjsSnapshot (binary)
```

**Key Constants:**
```typescript
const SHARED_ROOT_KEY = 'content';
const MAX_CONTENT_LENGTH = 1_000_000;
```

**Key Functions:**
```typescript
// Convert Slate to Y.doc
const applySlateValueToYDoc = (ydoc, value) => {
  const sharedRoot = ydoc.get(SHARED_ROOT_KEY, Y.XmlText);
  sharedRoot.delete(0, sharedRoot.length);
  sharedRoot.applyDelta(slateNodesToInsertDelta(value));
};

// Convert Y.doc to Slate
const extractSlateValueFromYDoc = (ydoc): Value => {
  const sharedRoot = ydoc.get(SHARED_ROOT_KEY, Y.XmlText);
  const slateElement = yTextToSlateElement(sharedRoot);
  return Array.isArray(slateElement) ? slateElement : [slateElement];
};
```

**Adaptation Notes:**
- **REPLACE:** Prisma queries with Convex mutations
- **KEEP:** Binary snapshot format for performance
- **KEEP:** Migration logic from JSON to binary
- **CUSTOMIZE:** Max content length if needed

---

### 5.3 Auth Handler

**File:** `src/server/yjs/auth.ts`

```typescript
export const authenticateFromHeaders = async (
  headers: IncomingHttpHeaders
): Promise<{ session: AuthSession | null; user: AuthUser | null }> => {
  const cookies = parseCookies(headers.cookie);
  const fetchHeaders = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      fetchHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }

  const sessionData = await auth.api.getSession({ headers: fetchHeaders });

  if (!sessionData) {
    return { session: null, user: null };
  }

  return {
    session: sessionData.session,
    user: getAuthUser(sessionData.user, devUser),
  };
};
```

**Adaptation Notes:**
- **REPLACE:** Better-auth with Clerk
- **USE:** Clerk's `clerkClient.verifyToken()` for WebSocket auth
- **PASS:** Clerk token via WebSocket headers or query params

---

### 5.4 Types

**File:** `src/server/yjs/types.ts`

```typescript
export type CollabContext = {
  document?: CollabDocument;
  readOnly?: boolean;
  userId?: string;
};

export type CollabDocument = Pick<
  DocumentModel,
  'contentRich' | 'id' | 'isArchived' | 'isPublished' | 'lockPage' | 'userId' | 'yjsSnapshot'
>;
```

---

## 6. Collaboration Components (T000p-q)

### 6.1 Remote Cursor Overlay

**File:** `src/registry/ui/remote-cursor-overlay.tsx`

```
RemoteCursorOverlay
  |
  +-- Dependencies
  |     +-- @platejs/yjs/react (YjsPlugin)
  |     +-- @slate-yjs/react (useRemoteCursorOverlayPositions)
  |
  +-- Features
  |     +-- Only renders when YJS is synced
  |     +-- Selection rectangles (semi-transparent)
  |     +-- Caret with username label
  |     +-- Hover state for opacity change
  |
  +-- Cursor Data
        +-- color: HSL color string
        +-- name: username
```

**Key Pattern - Color with Alpha:**
```typescript
function addAlpha(color: string, opacity: number): string {
  // Handle HSL: hsl(120, 50%, 50%) -> hsla(120, 50%, 50%, 0.5)
  if (color.startsWith('hsl(')) {
    return color.replace('hsl(', 'hsla(').replace(')', `, ${opacity})`);
  }
  // Handle RGB: rgb(255, 0, 0) -> rgba(255, 0, 0, 0.5)
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
  }
  // Handle HEX: #FF0000 -> #FF000080
  const normalized = Math.round(Math.min(Math.max(opacity, 0), 1) * 255);
  return color + normalized.toString(16).padStart(2, '0').toUpperCase();
}
```

**Adaptation Notes:**
- **CAN COPY:** Direct copy
- **KEEP:** All functionality

**Complexity Score:** 2/5 (straightforward)

---

### 6.2 Local Cursor Overlay

**File:** `src/registry/ui/cursor-overlay.tsx`

```
CursorOverlay (local cursor display)
  |
  +-- Uses @platejs/selection/react (useCursorOverlay)
  +-- Renders selection and caret
  +-- Hides during AI streaming
  +-- Different styles for 'selection' vs 'drag' cursor
```

**Adaptation Notes:**
- **CAN COPY:** Direct copy
- **REMOVE:** AI streaming check if not using AI

---

### 6.3 Floating Discussion Panel

**File:** `src/registry/ui/floating-discussion.tsx`

```
FloatingDiscussion (sidebar comment/suggestion display)
  |
  +-- Dependencies
  |     +-- discussionPlugin (custom)
  |     +-- commentPlugin
  |     +-- suggestionPlugin
  |
  +-- Features
  |     +-- Position calculations relative to editor
  |     +-- Non-overlapping layout algorithm
  |     +-- Active/hover states
  |     +-- Comment threads with collapse
  |     +-- Suggestion cards with accept/reject
  |
  +-- Components
        +-- CommentCreateForm
        +-- FloatingCommentsContent (comment threads)
        +-- FloatingSuggestionContent (suggestion cards)
```

**Key Algorithm - Non-overlapping Layout:**
```typescript
const resolveOverlappingTop = (
  topMap: Record<string, number>,
  domMap: Record<string, HTMLDivElement | null>
) => {
  const discussionArray = Object.entries(topMap)
    .map(([id, topDistance]) => ({ id, topDistance }))
    .sort((a, b) => a.topDistance - b.topDistance);

  // Check each discussion for overlap with previous ones
  for (let i = 1; i < discussionArray.length; i++) {
    const current = discussionArray[i];
    const currentElement = domMap[current.id];

    for (let j = 0; j < i; j++) {
      const previous = discussionArray[j];
      const previousElement = domMap[previous.id];

      const previousEnd = previous.topDistance + previousElement.clientHeight;

      if (current.topDistance <= previousEnd) {
        current.topDistance = previousEnd + 10; // 10px gap
        i--; // Recheck
        break;
      }
    }
  }

  return Object.fromEntries(discussionArray.map(d => [d.id, d.topDistance]));
};
```

**Adaptation Notes:**
- **SIGNIFICANT ADAPTATION:** Needs custom discussion plugin integration
- **KEEP:** Layout algorithm
- **REPLACE:** tRPC discussion fetching with Convex

**Complexity Score:** 5/5 (complex state management)

---

### 6.4 Block Discussion (Inline Comments)

**File:** `src/registry/ui/block-discussion.tsx`

```
BlockDiscussion (inline comment indicator)
  |
  +-- Used when isOverlapWithEditor is true
  +-- Shows comment count badge on block
  +-- Popover for viewing/creating comments
  +-- Handles both comments and suggestions
```

**Features:**
- Badge showing comment/suggestion count
- Icons differentiate comments vs suggestions
- Popover for thread display
- Active state tracking

**Adaptation Notes:**
- **COMPLEX:** Ties into custom plugin system
- **KEEP:** UI patterns
- **REPLACE:** Discussion data fetching

**Complexity Score:** 4/5 (plugin integration)

---

## Summary: Extraction Priority

### Phase 1 - Core Editor (Copy Directly)
1. `editor.tsx` - Editor/EditorContainer
2. `toolbar.tsx` - Toolbar primitives
3. `floating-toolbar.tsx` - Floating toolbar
4. `cursor-overlay.tsx` - Local cursor
5. Basic blocks: heading, paragraph, blockquote, hr, lists
6. `inline-combobox.tsx` - Combobox system

### Phase 2 - Rich Blocks (Copy with Modifications)
1. `code-block-node.tsx` - Code blocks
2. `table-node.tsx` - Tables
3. `callout-node.tsx` - Callouts
4. `toggle-node.tsx` - Toggles
5. `slash-node.tsx` - Slash commands
6. `block-menu.tsx` - Context menu

### Phase 3 - Media (Requires Upload Integration)
1. `media-image-node.tsx`
2. `media-video-node.tsx`
3. `media-audio-node.tsx`
4. `media-file-node.tsx`
5. `media-placeholder-node.tsx`

### Phase 4 - Collaboration (Requires Backend)
1. `remote-cursor-overlay.tsx`
2. `floating-discussion.tsx`
3. `block-discussion.tsx`
4. Hocuspocus server setup

### Phase 5 - Provider Integration
1. `plate-provider.tsx` (needs tRPC -> Convex conversion)
2. Discussion plugin integration
3. Comment/Suggestion systems

---

## Dependencies to Install

```json
{
  "dependencies": {
    "@platejs/ai": "^52",
    "@platejs/autoformat": "^52",
    "@platejs/basic-blocks": "^52",
    "@platejs/basic-marks": "^52",
    "@platejs/block-menu": "^52",
    "@platejs/callout": "^52",
    "@platejs/caption": "^52",
    "@platejs/code-block": "^52",
    "@platejs/column": "^52",
    "@platejs/combobox": "^52",
    "@platejs/comment": "^52",
    "@platejs/cursor-overlay": "^52",
    "@platejs/date": "^52",
    "@platejs/dnd": "^52",
    "@platejs/docx": "^52",
    "@platejs/emoji": "^52",
    "@platejs/floating": "^52",
    "@platejs/font": "^52",
    "@platejs/link": "^52",
    "@platejs/list": "^52",
    "@platejs/markdown": "^52",
    "@platejs/math": "^52",
    "@platejs/media": "^52",
    "@platejs/mention": "^52",
    "@platejs/resizable": "^52",
    "@platejs/selection": "^52",
    "@platejs/suggestion": "^52",
    "@platejs/table": "^52",
    "@platejs/toc": "^52",
    "@platejs/toggle": "^52",
    "@platejs/yjs": "^52",
    "@slate-yjs/core": "^1.2.0",
    "@slate-yjs/react": "^1.2.0",
    "platejs": "^52",
    "yjs": "^13",
    "@hocuspocus/server": "^2",
    "@hocuspocus/extension-logger": "^2",
    "@hocuspocus/extension-redis": "^2"
  }
}
```

---

## Next Steps

1. Create feature flag for gradual editor rollout
2. Set up Hocuspocus server (separate service)
3. Create Convex functions for document collaboration
4. Build component migration plan with tests
5. Design discussion/comment data model for Convex
