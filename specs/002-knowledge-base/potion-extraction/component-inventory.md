# Potion Template Component Inventory

## Overview Statistics

| Category | Files | Total Lines |
|----------|-------|-------------|
| Registry UI Components | 103 | ~15,339 |
| Registry Plugins | 52 | ~1,869 |
| App Editor Components | 40 | ~1,500 (est) |
| Sidebar Components | 5 | ~500 (est) |
| Other Components | ~60 | ~3,000 (est) |
| **TOTAL** | ~260 | ~22,000 |

---

## 1. Registry UI Components (`src/registry/ui/`)

### 1.1 Core Editor Components

| Component | File | Lines | Complexity | Dependencies | Purpose |
|-----------|------|-------|------------|--------------|---------|
| `Editor` | `editor.tsx` | ~150 | M | platejs/react, cva | Main editor container with variants |
| `EditorStatic` | `editor-static.tsx` | ~80 | S | platejs/react | Read-only static rendering |
| `Toolbar` | `toolbar.tsx` | ~120 | M | Radix Toggle, cva | Editor toolbar with button groups |

### 1.2 AI Components

| Component | File | Lines | Complexity | Dependencies | Purpose |
|-----------|------|-------|------------|--------------|---------|
| `AIMenu` | `ai-menu.tsx` | 744 | XL | @platejs/ai, jotai, zustand | AI command menu with actions |
| `AINode` | `ai-node.tsx` | ~100 | M | @platejs/ai | AI generation inline node |
| `AIChatEditor` | `ai-chat-editor.tsx` | ~200 | L | @platejs/ai | Chat interface for AI |
| `AIToolbarButton` | `ai-toolbar-button.tsx` | ~50 | S | @platejs/ai | Toolbar trigger for AI |

### 1.3 Block Components

| Component | File | Lines | Complexity | Dependencies | Purpose |
|-----------|------|-------|------------|--------------|---------|
| `BlockDraggable` | `block-draggable.tsx` | 590 | XL | @platejs/dnd, react-dnd | Drag handle & drop zones |
| `BlockMenu` | `block-menu.tsx` | 572 | XL | @platejs/selection | Block action menu (+, drag) |
| `BlockSelection` | `block-selection.tsx` | ~100 | M | @platejs/selection | Multi-block selection UI |
| `BlockContextMenu` | `block-context-menu.tsx` | ~150 | M | Radix ContextMenu | Right-click menu for blocks |
| `BlockList` | `block-list.tsx` | ~120 | M | platejs | Bulleted/numbered lists |
| `BlockListStatic` | `block-list-static.tsx` | ~80 | S | platejs | Static list rendering |

### 1.4 Text Block Nodes

| Component | File | Lines | Complexity | Dependencies | Purpose |
|-----------|------|-------|------------|--------------|---------|
| `ParagraphNode` | `paragraph-node.tsx` | ~50 | XS | platejs | Paragraph element |
| `HeadingNode` | `heading-node.tsx` | ~80 | S | platejs | H1-H6 headings |
| `BlockquoteNode` | `blockquote-node.tsx` | ~60 | S | platejs | Quote blocks |
| `CodeNode` | `code-node.tsx` | ~40 | XS | platejs | Inline code |
| `CodeBlockNode` | `code-block-node.tsx` | 283 | L | @platejs/code-block, lowlight | Code blocks with syntax |
| `CalloutNode` | `callout-node.tsx` | ~120 | M | @platejs/callout | Callout/alert blocks |
| `ToggleNode` | `toggle-node.tsx` | ~100 | M | @platejs/toggle | Collapsible toggle blocks |

### 1.5 Collaboration Components

| Component | File | Lines | Complexity | Dependencies | Purpose |
|-----------|------|-------|------------|--------------|---------|
| `FloatingDiscussion` | `floating-discussion.tsx` | 1090 | XXL | @platejs/comment | Discussion thread UI |
| `BlockDiscussion` | `block-discussion.tsx` | 372 | L | @platejs/comment | Block-level discussions |
| `BlockSuggestion` | `block-suggestion.tsx` | 485 | L | @platejs/suggestion | Track changes suggestions |
| `Comment` | `comment.tsx` | 624 | XL | @platejs/comment | Comment component |
| `CommentNode` | `comment-node.tsx` | ~80 | S | @platejs/comment | Inline comment highlight |
| `CommentToolbarButton` | `comment-toolbar-button.tsx` | ~60 | S | @platejs/comment | Comment action button |
| `SuggestionNode` | `suggestion-node.tsx` | ~100 | M | @platejs/suggestion | Inline suggestion marks |
| `SuggestionToolbarButton` | `suggestion-toolbar-button.tsx` | ~60 | S | @platejs/suggestion | Suggestion mode toggle |
| `CursorOverlay` | `cursor-overlay.tsx` | ~100 | M | @platejs/selection | Local cursor rendering |
| `RemoteCursorOverlay` | `remote-cursor-overlay.tsx` | ~150 | M | @platejs/yjs, @slate-yjs | Remote user cursors |

### 1.6 Media Components

| Component | File | Lines | Complexity | Dependencies | Purpose |
|-----------|------|-------|------------|--------------|---------|
| `MediaPlaceholderNode` | `media-placeholder-node.tsx` | 412 | L | @platejs/media, uploadthing | Upload placeholder |
| `MediaImageNode` | `media-image-node.tsx` | ~200 | M | @platejs/media | Image element |
| `MediaVideoNode` | `media-video-node.tsx` | ~180 | M | @platejs/media, react-player | Video element |
| `MediaAudioNode` | `media-audio-node.tsx` | ~150 | M | @platejs/media | Audio element |
| `MediaFileNode` | `media-file-node.tsx` | ~120 | M | @platejs/media | File attachment |
| `MediaEmbedNode` | `media-embed-node.tsx` | ~200 | M | @platejs/media | Embed (YouTube, etc) |
| `MediaToolbar` | `media-toolbar.tsx` | ~150 | M | @platejs/media | Media action toolbar |
| `MediaUploadToast` | `media-upload-toast.tsx` | ~80 | S | sonner | Upload progress toast |
| `MediaPreviewDialog` | `media-preview-dialog.tsx` | ~100 | M | Radix Dialog | Full-screen preview |
| `Caption` | `caption.tsx` | ~80 | S | @platejs/caption | Image/media captions |
| `ResizeHandle` | `resize-handle.tsx` | ~60 | S | @platejs/resizable | Drag resize handles |

### 1.7 Link & Mention Components

| Component | File | Lines | Complexity | Dependencies | Purpose |
|-----------|------|-------|------------|--------------|---------|
| `LinkNode` | `link-node.tsx` | ~100 | M | @platejs/link | Inline link element |
| `LinkToolbar` | `link-toolbar.tsx` | 428 | L | @platejs/link | Link edit floating UI |
| `LinkToolbarButton` | `link-toolbar-button.tsx` | ~60 | S | @platejs/link | Link action button |
| `MentionNode` | `mention-node.tsx` | 567 | XL | @platejs/mention | @mention element |
| `InlineCombobox` | `inline-combobox.tsx` | 402 | L | @ariakit/react | Combobox for mentions/slash |

### 1.8 Table Components

| Component | File | Lines | Complexity | Dependencies | Purpose |
|-----------|------|-------|------------|--------------|---------|
| `TableNode` | `table-node.tsx` | 299 | L | @platejs/table | Table element |
| `TableNodeStatic` | `table-node-static.tsx` | ~150 | M | @platejs/table | Static table rendering |

### 1.9 Math & Date Components

| Component | File | Lines | Complexity | Dependencies | Purpose |
|-----------|------|-------|------------|--------------|---------|
| `EquationNode` | `equation-node.tsx` | 237 | M | @platejs/math | LaTeX equation block |
| `EquationToolbarButton` | `equation-toolbar-button.tsx` | ~80 | S | @platejs/math | Equation insert button |
| `DateNode` | `date-node.tsx` | ~100 | M | @platejs/date | Inline date picker |
| `Calendar` | `calendar.tsx` | ~120 | M | react-day-picker | Calendar UI |

### 1.10 Layout Components

| Component | File | Lines | Complexity | Dependencies | Purpose |
|-----------|------|-------|------------|--------------|---------|
| `ColumnNode` | `column-node.tsx` | ~150 | M | @platejs/layout | Multi-column layout |
| `HrNode` | `hr-node.tsx` | ~40 | XS | platejs | Horizontal divider |
| `TocNode` | `toc-node.tsx` | ~200 | M | @platejs/toc | Table of contents block |
| `TocSidebar` | `toc-sidebar.tsx` | ~150 | M | @platejs/toc | Floating TOC sidebar |

### 1.11 Toolbar & Menu Components

| Component | File | Lines | Complexity | Dependencies | Purpose |
|-----------|------|-------|------------|--------------|---------|
| `FloatingToolbar` | `floating-toolbar.tsx` | ~150 | M | @platejs/floating | Selection toolbar |
| `FloatingToolbarButtons` | `floating-toolbar-buttons.tsx` | ~200 | M | @platejs/floating | Toolbar button set |
| `SlashNode` | `slash-node.tsx` | 414 | L | @platejs/slash-command | Slash command menu |
| `Menu` | `menu.tsx` | 537 | XL | Ariakit, cva | Generic menu component |
| `DropdownMenu` | `dropdown-menu.tsx` | 270 | L | Radix DropdownMenu | Dropdown menus |
| `MarkToolbarButton` | `mark-toolbar-button.tsx` | ~60 | S | platejs | Bold/italic/etc buttons |
| `TurnIntoToolbarButton` | `turn-into-toolbar-button.tsx` | ~100 | M | platejs | Block type changer |
| `MoreToolbarButton` | `more-toolbar-button.tsx` | ~80 | S | platejs | Overflow menu |
| `FontColorToolbarButton` | `font-color-toolbar-button.tsx` | ~150 | M | @platejs/font | Color picker button |
| `EmojiToolbarButton` | `emoji-toolbar-button.tsx` | 610 | XL | @platejs/emoji, emoji-picker-react | Emoji picker |
| `EmojiNode` | `emoji-node.tsx` | ~40 | XS | @platejs/emoji | Inline emoji |

### 1.12 Base UI Components

| Component | File | Lines | Complexity | Dependencies | Purpose |
|-----------|------|-------|------------|--------------|---------|
| `Button` | `button.tsx` | ~120 | M | cva, Radix Slot | Button with variants |
| `Dialog` | `dialog.tsx` | 434 | L | Radix Dialog | Modal dialogs |
| `Popover` | `popover.tsx` | ~80 | S | Radix Popover | Popovers |
| `Tooltip` | `tooltip.tsx` | ~80 | S | Radix Tooltip | Tooltips |
| `Command` | `command.tsx` | ~200 | M | cmdk | Command palette |
| `Input` | `input.tsx` | ~60 | S | - | Text input |
| `Textarea` | `textarea.tsx` | ~60 | S | - | Multiline input |
| `Checkbox` | `checkbox.tsx` | ~60 | S | Radix Checkbox | Checkbox |
| `Tabs` | `tabs.tsx` | ~80 | S | Radix Tabs | Tab navigation |
| `Toggle` | `toggle.tsx` | ~60 | S | Radix Toggle | Toggle button |
| `Separator` | `separator.tsx` | ~40 | XS | Radix Separator | Visual separator |
| `Avatar` | `avatar.tsx` | ~80 | S | Radix Avatar | User avatars |
| `HoverCard` | `hover-card.tsx` | ~80 | S | Radix HoverCard | Hover popups |
| `Label` | `label.tsx` | ~40 | XS | Radix Label | Form labels |
| `Progress` | `progress.tsx` | ~50 | XS | Radix Progress | Progress bars |
| `Spinner` | `spinner.tsx` | ~30 | XS | - | Loading spinner |
| `GhostText` | `ghost-text.tsx` | ~60 | S | @platejs/ai | AI completion preview |

---

## 2. Registry Plugin Configurations (`src/registry/components/editor/plugins/`)

### 2.1 AI & Copilot Plugins

| Plugin | File | Lines | Complexity | Purpose |
|--------|------|-------|------------|---------|
| `AIKit` | `ai-kit.tsx` | 169 | L | AI chat, generation, commands |
| `CopilotKit` | `copilot-kit.tsx` | 70 | M | Inline AI completion |

### 2.2 Block Plugins

| Plugin | File | Lines | Complexity | Purpose |
|--------|------|-------|------------|---------|
| `BasicBlocksKit` | `basic-blocks-kit.tsx` | 51 | M | Paragraph, heading, quote, etc |
| `BasicBlocksBaseKit` | `basic-blocks-base-kit.tsx` | 26 | S | Base block plugins without UI |
| `CodeBlockKit` | `code-block-kit.tsx` | 26 | S | Syntax highlighted code |
| `CalloutKit` | `callout-kit.tsx` | 7 | XS | Alert/callout blocks |
| `ColumnKit` | `column-kit.tsx` | 10 | XS | Multi-column layout |
| `ToggleKit` | `toggle-kit.tsx` | 11 | XS | Collapsible sections |
| `TocKit` | `toc-kit.tsx` | 14 | XS | Table of contents |

### 2.3 Mark Plugins

| Plugin | File | Lines | Complexity | Purpose |
|--------|------|-------|------------|---------|
| `BasicMarksKit` | `basic-marks-kit.tsx` | 32 | S | Bold, italic, underline, etc |
| `BasicMarksBaseKit` | `basic-marks-base-kit.tsx` | 21 | S | Base marks without UI |
| `FontKit` | `font-kit.tsx` | 28 | S | Font color, background |

### 2.4 List Plugins

| Plugin | File | Lines | Complexity | Purpose |
|--------|------|-------|------------|---------|
| `ListKit` | `list-kit.tsx` | 27 | S | Bulleted, numbered, todo lists |
| `ListBaseKit` | `list-base-kit.tsx` | 24 | S | Base list without UI |
| `IndentKit` | `indent-kit.tsx` | 22 | S | Block indentation |

### 2.5 Media Plugins

| Plugin | File | Lines | Complexity | Purpose |
|--------|------|-------|------------|---------|
| `MediaKit` | `media-kit.tsx` | 48 | M | Image, video, audio, file, embed |
| `MediaBaseKit` | `media-base-kit.tsx` | 31 | S | Base media without UI |

### 2.6 Link & Mention Plugins

| Plugin | File | Lines | Complexity | Purpose |
|--------|------|-------|------------|---------|
| `LinkKit` | `link-kit.tsx` | 101 | M | Hyperlinks with floating UI |
| `MentionKit` | `mention-kit.tsx` | 34 | S | @mentions |
| `EmojiKit` | `emoji-kit.tsx` | 14 | XS | Emoji insertion |

### 2.7 Collaboration Plugins

| Plugin | File | Lines | Complexity | Purpose |
|--------|------|-------|------------|---------|
| `CommentKit` | `comment-kit.tsx` | 170 | L | Comments & highlights |
| `DiscussionKit` | `discussion-kit.tsx` | 258 | L | Discussion threads |
| `SuggestionKit` | `suggestion-kit.tsx` | 92 | M | Track changes |

### 2.8 UI Enhancement Plugins

| Plugin | File | Lines | Complexity | Purpose |
|--------|------|-------|------------|---------|
| `FloatingToolbarKit` | `floating-toolbar-kit.tsx` | 19 | S | Selection toolbar |
| `BlockMenuKit` | `block-menu-kit.tsx` | 14 | XS | Block action menu |
| `BlockSelectionKit` | `block-selection-kit.tsx` | 32 | S | Multi-block selection |
| `BlockPlaceholderKit` | `block-placeholder-kit.tsx` | 17 | S | Empty block placeholder |
| `SlashKit` | `slash-kit.tsx` | 17 | S | Slash commands |
| `DndKit` | `dnd-kit.tsx` | 27 | S | Drag & drop |
| `CursorOverlayKit` | `cursor-overlay-kit.tsx` | 13 | XS | Cursor visualization |

### 2.9 Utility Plugins

| Plugin | File | Lines | Complexity | Purpose |
|--------|------|-------|------------|---------|
| `AutoformatKit` | `autoformat-kit.tsx` | 212 | L | Markdown shortcuts |
| `ExitBreakKit` | `exit-break-kit.tsx` | 12 | XS | Exit code blocks |
| `MarkdownKit` | `markdown-kit.tsx` | 13 | XS | Markdown parsing |
| `DocxKit` | `docx-kit.tsx` | 6 | XS | DOCX import |

### 2.10 Math & Date Plugins

| Plugin | File | Lines | Complexity | Purpose |
|--------|------|-------|------------|---------|
| `MathKit` | `math-kit.tsx` | 13 | XS | LaTeX equations |
| `DateKit` | `date-kit.tsx` | 7 | XS | Inline dates |
| `TableKit` | `table-kit.tsx` | 22 | S | Tables |

---

## 3. Application Editor Components (`src/components/editor/`)

### 3.1 Core Editor Files

| Component | File | Lines | Complexity | Purpose |
|-----------|------|-------|------------|---------|
| `PlateEditor` | `plate-editor.tsx` | ~150 | M | Editor wrapper |
| `PlateProvider` | `plate-provider.tsx` | ~350 | XL | YJS + Editor setup |
| `EditorKitApp` | `editor-kit-app.tsx` | ~80 | M | App-specific plugin config |

### 3.2 App-Specific Plugins (`src/components/editor/plugins/`)

| Plugin | File | Lines | Complexity | Purpose |
|--------|------|-------|------------|---------|
| `AIKitApp` | `ai-kit-app.tsx` | ~100 | M | App-specific AI config |
| `BlockSelectionKitApp` | `block-selection-kit-app.tsx` | ~50 | S | App selection config |
| `CommentKitApp` | `comment-kit-app.tsx` | ~100 | M | App comment config |
| `FloatingToolbarKitApp` | `floating-toolbar-kit-app.tsx` | ~80 | S | App toolbar config |
| `LinkKitApp` | `link-kit-app.tsx` | ~60 | S | App link config |
| `MediaKitApp` | `media-kit-app.tsx` | ~100 | M | App media config |
| `MentionKitApp` | `mention-kit-app.tsx` | ~80 | S | App mention config |
| `SuggestionKitApp` | `suggestion-kit-app.tsx` | ~60 | S | App suggestion config |

### 3.3 App-Specific UI (`src/components/editor/ui/`)

| Component | File | Lines | Complexity | Purpose |
|-----------|------|-------|------------|---------|
| `BlockDiscussionApp` | `block-discussion-app.tsx` | ~150 | M | App discussion UI |
| `BlockSuggestionApp` | `block-suggestion-app.tsx` | ~100 | M | App suggestion UI |
| `CommentApp` | `comment-app.tsx` | ~150 | M | App comment UI |
| `FloatingDiscussionApp` | `floating-discussion-app.tsx` | ~200 | L | App discussion panel |
| `FloatingToolbarButtonsApp` | `floating-toolbar-buttons-app.tsx` | ~100 | M | App toolbar buttons |
| `LinkFloatingToolbarApp` | `link-floating-toolbar-app.tsx` | ~80 | S | App link toolbar |
| `LinkNodeApp` | `link-node-app.tsx` | ~60 | S | App link node |
| `MediaPlaceholderNodeApp` | `media-placeholder-node-app.tsx` | ~150 | M | App upload UI |
| `MentionNodeApp` | `mention-node-app.tsx` | ~80 | S | App mention UI |
| `CommentToolbarButtonApp` | `comment-toolbar-button-app.tsx` | ~50 | S | App comment button |
| `SuggestionToolbarButtonApp` | `suggestion-toolbar-button-app.tsx` | ~50 | S | App suggestion button |

### 3.4 Version History (`src/components/editor/version-history/`)

| Component | File | Lines | Complexity | Purpose |
|-----------|------|-------|------------|---------|
| `VersionHistoryModal` | `version-history-modal.tsx` | ~100 | M | Version history dialog |
| `VersionHistoryPanel` | `version-history-panel.tsx` | ~200 | L | Version list panel |
| `VersionPlate` | `version-plate.tsx` | ~100 | M | Version preview editor |
| `DiffPlate` | `diff-plate.tsx` | ~150 | M | Diff visualization |
| `DiffNode` | `diff-node.tsx` | ~80 | S | Diff inline marks |
| `DiffPlugin` | `diff-plugin.ts` | ~60 | S | Diff plugin config |
| `ChunkNode` | `chunk-node.tsx` | ~60 | S | Collapsed diff chunks |
| `ChunkPlugin` | `chunk-plugin.ts` | ~50 | S | Chunk plugin config |
| `collapseBlocksWithoutDiff` | `collapseBlocksWithoutDiff.ts` | ~80 | S | Diff collapsing logic |

### 3.5 Editor Utilities (`src/components/editor/utils/`)

| Utility | File | Lines | Complexity | Purpose |
|---------|------|-------|------------|---------|
| `getEditorWordCount` | `getEditorWordCount.ts` | ~30 | XS | Word count calculation |
| `scrollSelectionIntoView` | `scrollSelectionIntoView.ts` | ~40 | S | Scroll to selection |
| `searchRanges` | `searchRanges.ts` | ~50 | S | Text search |
| `selectByText` | `selectByText.ts` | ~40 | S | Select text range |
| `traverseElementNodes` | `traverseElementNodes.ts` | ~30 | XS | Node traversal |
| `traverseTextNodes` | `traverseTextNodes.ts` | ~30 | XS | Text traversal |
| `useDebouncedEditorVersion` | `useDebouncedEditorVersion.ts` | ~40 | S | Version debouncing |
| `useResetEditorOnChange` | `useResetEditorOnChange.ts` | ~50 | S | Editor reset hook |
| `useTemplateDocument` | `useTemplateDocument.tsx` | ~100 | M | Template loading |

---

## 4. Sidebar Components (`src/components/sidebar/`)

| Component | File | Lines | Complexity | Purpose |
|-----------|------|-------|------------|---------|
| `Sidebar` | `sidebar.tsx` | ~200 | L | Main sidebar container |
| `SidebarSwitcher` | `sidebar-switcher.tsx` | ~100 | M | User/workspace switcher |
| `DocumentList` | `document-list.tsx` | ~150 | M | Recursive document tree |
| `NavItem` | `nav-item.tsx` | ~100 | M | Navigation item component |
| `TrashBox` | `trash-box.tsx` | ~120 | M | Deleted documents list |

---

## 5. Server Components (`src/server/`)

### 5.1 YJS/Hocuspocus Server (`src/server/yjs/`)

| File | Lines | Complexity | Purpose |
|------|-------|------------|---------|
| `server.ts` | ~170 | L | Hocuspocus server setup |
| `document.ts` | ~150 | L | Y.doc ↔ Slate conversion |
| `auth.ts` | ~80 | M | YJS authentication |
| `types.ts` | ~30 | XS | TypeScript types |

### 5.2 tRPC API (`src/server/api/`)

| File | Lines | Complexity | Purpose |
|------|-------|------------|---------|
| `root.ts` | ~30 | XS | tRPC router root |
| `trpc.ts` | ~80 | M | tRPC context setup |
| `types.ts` | ~50 | S | API types |

**Routers:**
| Router | File | Purpose |
|--------|------|---------|
| `document` | `routers/document.ts` | CRUD for documents |
| `comment` | `routers/comment.ts` | Comments/discussions |
| `version` | `routers/version.ts` | Version history |
| `user` | `routers/user.ts` | User profile |
| `layout` | `routers/layout.ts` | Layout preferences |
| `file` | `routers/file.ts` | File management |

### 5.3 Hono API (`src/server/hono/`)

| Route | File | Purpose |
|-------|------|---------|
| `ai` | `routes/ai.ts` | AI generation endpoints |
| `export` | `routes/export.ts` | PDF/HTML export |
| `prompts` | `routes/prompts.ts` | AI prompt templates |
| `utils` | `routes/utils.ts` | Utility endpoints |

---

## 6. Extraction Priority Matrix

### Priority 1: CRITICAL (Must Extract First)

| Component | Reason | Adaptation Needed |
|-----------|--------|-------------------|
| `src/registry/ui/*` | Core Plate.js UI | Minimal - copy directly |
| `src/registry/components/editor/*` | Plugin configurations | Minimal - copy directly |
| `src/server/yjs/*` | Real-time collaboration | Heavy - adapt to Convex or keep |

### Priority 2: HIGH (Extract After Core)

| Component | Reason | Adaptation Needed |
|-----------|--------|-------------------|
| `src/components/sidebar/*` | Document navigation | Medium - adapt to Convex |
| `src/components/editor/plate-provider.tsx` | Editor setup | Heavy - adapt YJS integration |
| `src/components/cover/*` | Document metadata | Light - adapt to Convex |
| `src/components/navbar/*` | Document actions | Medium - adapt to Convex |

### Priority 3: MEDIUM (Nice to Have)

| Component | Reason | Adaptation Needed |
|-----------|--------|-------------------|
| Version history components | Feature parity | Heavy - redesign for Convex |
| Search components | Feature parity | Heavy - Convex search |
| Context panel | Feature parity | Medium - adapt to Convex |
| Settings modal | Feature parity | Light - adapt to Clerk |

### Priority 4: LOW (Can Skip/Rebuild)

| Component | Reason | Alternative |
|-----------|--------|-------------|
| Auth components | Using Clerk | Use existing Clerk setup |
| tRPC layer | Using Convex | Use Convex functions |
| Prisma schema | Using Convex | Design Convex schema |
| Hono routes | Using Convex | Use Convex actions |

---

## 7. Complexity Scoring Legend

| Score | Lines | Description |
|-------|-------|-------------|
| XS | <50 | Simple, single-purpose component |
| S | 50-100 | Small component with minimal logic |
| M | 100-200 | Medium component with some complexity |
| L | 200-400 | Large component with significant logic |
| XL | 400-700 | Very large, complex component |
| XXL | 700+ | Extremely complex, consider splitting |

---

## 8. Next Steps

1. **T000c**: Create dependency mapping (compare package.json files)
2. **T001**: Copy registry UI components with minimal changes
3. **T002**: Design Convex schema for Knowledge Base pages
4. **T003**: Evaluate Hocuspocus vs Convex real-time strategy
5. **T004**: Adapt sidebar for Convex document tree
