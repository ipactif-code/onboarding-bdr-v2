# Plate.js Rich-Text Editor

Plate.js is a rich-text editor framework built on Slate.js with shadcn/ui integration.

## Table of Contents

1. [Installation](#installation)
2. [Basic Setup](#basic-setup)
3. [Plugin System](#plugin-system)
4. [Toolbar Components](#toolbar-components)
5. [Custom Elements](#custom-elements)
6. [Serialization](#serialization)

---

## Installation

```bash
# Core packages
npm install @udecode/plate @udecode/plate-common slate slate-react slate-history

# Plugin packages (install as needed)
npm install @udecode/plate-basic-marks       # Bold, italic, underline, etc.
npm install @udecode/plate-heading           # Headings h1-h6
npm install @udecode/plate-list              # Lists (ul, ol)
npm install @udecode/plate-link              # Links
npm install @udecode/plate-block-quote       # Block quotes
npm install @udecode/plate-code-block        # Code blocks
npm install @udecode/plate-table             # Tables
npm install @udecode/plate-media             # Images, videos
npm install @udecode/plate-mention           # @mentions
npm install @udecode/plate-emoji             # Emoji picker
npm install @udecode/plate-ai                # AI features
```

---

## Basic Setup

### Editor Component

```tsx
"use client"

import * as React from "react"
import { Plate, PlateContent, PlateEditor } from "@udecode/plate/react"
import { BasicMarksPlugin } from "@udecode/plate-basic-marks/react"
import { HeadingPlugin } from "@udecode/plate-heading/react"
import { ParagraphPlugin } from "@udecode/plate-common/react"
import { cn } from "@/lib/utils"

const plugins = [
  ParagraphPlugin,
  HeadingPlugin,
  BasicMarksPlugin,
]

interface EditorProps {
  value?: any[]
  onChange?: (value: any[]) => void
  className?: string
  placeholder?: string
}

function Editor({ value, onChange, className, placeholder }: EditorProps) {
  return (
    <Plate
      plugins={plugins}
      value={value}
      onChange={onChange}
    >
      <PlateContent
        data-slot="editor"
        placeholder={placeholder ?? "Start typing..."}
        className={cn(
          "min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2",
          "text-sm ring-offset-background",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      />
    </Plate>
  )
}

export { Editor }
```

### With Toolbar

```tsx
"use client"

import * as React from "react"
import { Plate, PlateContent } from "@udecode/plate/react"
import { cn } from "@/lib/utils"
import { EditorToolbar } from "./editor-toolbar"

function EditorWithToolbar({ value, onChange, className }: EditorProps) {
  return (
    <Plate plugins={plugins} value={value} onChange={onChange}>
      <div
        data-slot="editor-container"
        className={cn(
          "rounded-md border border-input bg-background",
          "focus-within:ring-[3px] focus-within:ring-ring/50",
          className
        )}
      >
        <EditorToolbar />
        <PlateContent
          data-slot="editor-content"
          placeholder="Start typing..."
          className="min-h-[200px] px-3 py-2 text-sm focus:outline-none"
        />
      </div>
    </Plate>
  )
}
```

---

## Plugin System

### Common Plugins Configuration

```tsx
import { createPlatePlugin } from "@udecode/plate-common/react"
import { BasicMarksPlugin } from "@udecode/plate-basic-marks/react"
import { HeadingPlugin } from "@udecode/plate-heading/react"
import { ListPlugin } from "@udecode/plate-list/react"
import { LinkPlugin } from "@udecode/plate-link/react"
import { BlockquotePlugin } from "@udecode/plate-block-quote/react"
import { CodeBlockPlugin } from "@udecode/plate-code-block/react"
import { TablePlugin } from "@udecode/plate-table/react"
import { ImagePlugin } from "@udecode/plate-media/react"
import { MentionPlugin } from "@udecode/plate-mention/react"

// Full plugin configuration
const plugins = [
  // Block elements
  ParagraphPlugin,
  HeadingPlugin.configure({
    options: { levels: 3 }, // Only h1, h2, h3
  }),
  BlockquotePlugin,
  CodeBlockPlugin,
  ListPlugin,
  TablePlugin,
  ImagePlugin,

  // Inline elements
  LinkPlugin.configure({
    options: {
      allowedSchemes: ["http", "https", "mailto"],
    },
  }),
  MentionPlugin.configure({
    options: {
      triggerPreviousCharPattern: /^$|^[\s"']$/,
    },
  }),

  // Marks (inline formatting)
  BasicMarksPlugin, // Includes bold, italic, underline, strikethrough, code, subscript, superscript
]
```

### Custom Plugin

```tsx
import { createPlatePlugin } from "@udecode/plate-common/react"

const MyCustomPlugin = createPlatePlugin({
  key: "myCustom",
  node: {
    isElement: true,
    type: "my-custom-element",
  },
  handlers: {
    onKeyDown: (editor) => (event) => {
      // Custom keyboard handling
    },
  },
})
```

---

## Toolbar Components

### Basic Toolbar

```tsx
"use client"

import * as React from "react"
import { useEditorRef, useEditorSelector } from "@udecode/plate/react"
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
} from "@udecode/plate-basic-marks/react"
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link,
  Quote,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Toggle } from "@/components/ui/toggle"
import { Separator } from "@/components/ui/separator"

function EditorToolbar() {
  const editor = useEditorRef()

  return (
    <div
      data-slot="editor-toolbar"
      className="flex flex-wrap items-center gap-1 border-b border-input p-1"
    >
      <ToolbarMarkButton nodeType={BoldPlugin.key} icon={Bold} tooltip="Bold (⌘B)" />
      <ToolbarMarkButton nodeType={ItalicPlugin.key} icon={Italic} tooltip="Italic (⌘I)" />
      <ToolbarMarkButton nodeType={UnderlinePlugin.key} icon={Underline} tooltip="Underline (⌘U)" />
      <ToolbarMarkButton nodeType={StrikethroughPlugin.key} icon={Strikethrough} tooltip="Strikethrough" />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarBlockButton nodeType="ul" icon={List} tooltip="Bullet List" />
      <ToolbarBlockButton nodeType="ol" icon={ListOrdered} tooltip="Numbered List" />

      <Separator orientation="vertical" className="mx-1 h-6" />

      <ToolbarBlockButton nodeType="blockquote" icon={Quote} tooltip="Quote" />
      <ToolbarLinkButton />
    </div>
  )
}
```

### Mark Toggle Button

```tsx
import { toggleMark } from "@udecode/plate-common"
import { useEditorRef, useEditorSelector } from "@udecode/plate/react"
import { isMarkActive } from "@udecode/plate-common"
import type { LucideIcon } from "lucide-react"

interface ToolbarMarkButtonProps {
  nodeType: string
  icon: LucideIcon
  tooltip?: string
}

function ToolbarMarkButton({ nodeType, icon: Icon, tooltip }: ToolbarMarkButtonProps) {
  const editor = useEditorRef()
  const isActive = useEditorSelector(
    (editor) => isMarkActive(editor, nodeType),
    [nodeType]
  )

  return (
    <Toggle
      data-slot="toolbar-mark-button"
      size="sm"
      pressed={isActive}
      onPressedChange={() => toggleMark(editor, { key: nodeType })}
      title={tooltip}
      className="size-8"
    >
      <Icon className="size-4" />
    </Toggle>
  )
}
```

### Block Toggle Button

```tsx
import { toggleBlock, isBlockActive } from "@udecode/plate-common"
import { useEditorRef, useEditorSelector } from "@udecode/plate/react"
import type { LucideIcon } from "lucide-react"

interface ToolbarBlockButtonProps {
  nodeType: string
  icon: LucideIcon
  tooltip?: string
}

function ToolbarBlockButton({ nodeType, icon: Icon, tooltip }: ToolbarBlockButtonProps) {
  const editor = useEditorRef()
  const isActive = useEditorSelector(
    (editor) => isBlockActive(editor, nodeType),
    [nodeType]
  )

  return (
    <Toggle
      data-slot="toolbar-block-button"
      size="sm"
      pressed={isActive}
      onPressedChange={() => toggleBlock(editor, { type: nodeType })}
      title={tooltip}
      className="size-8"
    >
      <Icon className="size-4" />
    </Toggle>
  )
}
```

---

## Custom Elements

### Element Component Pattern

```tsx
import { PlateElement, PlateElementProps } from "@udecode/plate/react"
import { cn } from "@/lib/utils"

// Paragraph Element
function ParagraphElement({ className, children, ...props }: PlateElementProps) {
  return (
    <PlateElement
      data-slot="paragraph"
      className={cn("m-0 px-0 py-1", className)}
      {...props}
    >
      {children}
    </PlateElement>
  )
}

// Heading Element
function HeadingElement({ className, children, element, ...props }: PlateElementProps) {
  const level = (element as any).level ?? 1

  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"

  const headingClasses = {
    1: "text-3xl font-bold mt-6 mb-2",
    2: "text-2xl font-semibold mt-5 mb-2",
    3: "text-xl font-semibold mt-4 mb-1",
    4: "text-lg font-medium mt-3 mb-1",
    5: "text-base font-medium mt-2 mb-1",
    6: "text-sm font-medium mt-2 mb-1",
  }

  return (
    <PlateElement
      data-slot={`heading-${level}`}
      asChild
      className={cn(headingClasses[level as keyof typeof headingClasses], className)}
      {...props}
    >
      <Tag>{children}</Tag>
    </PlateElement>
  )
}

// Blockquote Element
function BlockquoteElement({ className, children, ...props }: PlateElementProps) {
  return (
    <PlateElement
      data-slot="blockquote"
      asChild
      className={cn(
        "my-2 border-l-4 border-primary/30 pl-4 italic text-muted-foreground",
        className
      )}
      {...props}
    >
      <blockquote>{children}</blockquote>
    </PlateElement>
  )
}

// Code Block Element
function CodeBlockElement({ className, children, ...props }: PlateElementProps) {
  return (
    <PlateElement
      data-slot="code-block"
      asChild
      className={cn(
        "my-2 rounded-md bg-muted p-4 font-mono text-sm",
        className
      )}
      {...props}
    >
      <pre>
        <code>{children}</code>
      </pre>
    </PlateElement>
  )
}
```

### Leaf Component Pattern (Marks)

```tsx
import { PlateLeaf, PlateLeafProps } from "@udecode/plate/react"
import { cn } from "@/lib/utils"

// Bold Leaf
function BoldLeaf({ className, children, ...props }: PlateLeafProps) {
  return (
    <PlateLeaf
      data-slot="bold"
      asChild
      className={cn("font-bold", className)}
      {...props}
    >
      <strong>{children}</strong>
    </PlateLeaf>
  )
}

// Italic Leaf
function ItalicLeaf({ className, children, ...props }: PlateLeafProps) {
  return (
    <PlateLeaf
      data-slot="italic"
      asChild
      className={cn("italic", className)}
      {...props}
    >
      <em>{children}</em>
    </PlateLeaf>
  )
}

// Code Leaf (inline)
function CodeLeaf({ className, children, ...props }: PlateLeafProps) {
  return (
    <PlateLeaf
      data-slot="code"
      asChild
      className={cn(
        "rounded bg-muted px-1.5 py-0.5 font-mono text-sm",
        className
      )}
      {...props}
    >
      <code>{children}</code>
    </PlateLeaf>
  )
}
```

### Registering Custom Components

```tsx
const plugins = [
  ParagraphPlugin.configure({
    render: {
      node: ParagraphElement,
    },
  }),
  HeadingPlugin.configure({
    render: {
      node: HeadingElement,
    },
  }),
  BlockquotePlugin.configure({
    render: {
      node: BlockquoteElement,
    },
  }),
  BasicMarksPlugin.configure({
    render: {
      leafs: {
        bold: BoldLeaf,
        italic: ItalicLeaf,
        code: CodeLeaf,
      },
    },
  }),
]
```

---

## Serialization

### HTML Serialization

```tsx
import { createPlateEditor, serializeHtml } from "@udecode/plate"
import { DOMEditor } from "slate-dom"

// Serialize to HTML
function editorToHtml(value: any[]) {
  const editor = createPlateEditor({ plugins })
  editor.children = value
  return serializeHtml(editor, {
    nodes: value,
  })
}

// Parse from HTML
import { deserializeHtml } from "@udecode/plate"

function htmlToEditor(html: string) {
  const editor = createPlateEditor({ plugins })
  return deserializeHtml(editor, {
    element: html,
  })
}
```

### Markdown Serialization

```tsx
import { MarkdownPlugin } from "@udecode/plate-markdown"

const plugins = [
  // ... other plugins
  MarkdownPlugin,
]

// Serialize to Markdown
import { serializeMd } from "@udecode/plate-markdown"

function editorToMarkdown(editor: PlateEditor) {
  return serializeMd(editor)
}

// Parse from Markdown
import { deserializeMd } from "@udecode/plate-markdown"

function markdownToEditor(markdown: string) {
  const editor = createPlateEditor({ plugins })
  return deserializeMd(editor, markdown)
}
```

### JSON Storage

```tsx
// Direct JSON serialization (default format)
function saveContent(value: any[]) {
  localStorage.setItem("editor-content", JSON.stringify(value))
}

function loadContent(): any[] {
  const saved = localStorage.getItem("editor-content")
  return saved ? JSON.parse(saved) : [{ type: "p", children: [{ text: "" }] }]
}
```

---

## Form Integration

### With react-hook-form

```tsx
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Editor } from "@/components/ui-plate/editor"

const formSchema = z.object({
  content: z.array(z.any()).min(1, "Content is required"),
})

function RichTextForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: [{ type: "p", children: [{ text: "" }] }],
    },
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Controller
        control={form.control}
        name="content"
        render={({ field }) => (
          <Editor
            value={field.value}
            onChange={field.onChange}
            placeholder="Write your content..."
          />
        )}
      />
      <Button type="submit">Save</Button>
    </form>
  )
}
```
