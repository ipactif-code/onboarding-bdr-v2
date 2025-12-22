# XSS Prevention - DOMPurify + Plate.js

## Table of Contents
1. [DOMPurify Setup](#dompurify-setup)
2. [Plate.js Serialization](#platejs-serialization)
3. [Safe Render Patterns](#safe-render-patterns)
4. [Content Security Policy](#content-security-policy)

---

## DOMPurify Setup

### Installation

```bash
npm install dompurify
npm install -D @types/dompurify
```

### Configuration

```typescript
// src/lib/sanitize.ts
import DOMPurify from "dompurify";

// Configure DOMPurify with safe defaults
const SANITIZE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr",
    "ul", "ol", "li",
    "strong", "em", "u", "s", "code", "pre",
    "blockquote",
    "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
    "div", "span",
  ],
  ALLOWED_ATTR: [
    "href", "src", "alt", "title", "class",
    "target", "rel",
    "colspan", "rowspan",
  ],
  ALLOW_DATA_ATTR: false,
  // Force safe link targets
  ADD_ATTR: ["target"],
  // Sanitize URLs
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * Sanitize HTML content for safe rendering
 * ALWAYS use before dangerouslySetInnerHTML
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, SANITIZE_CONFIG);
}

/**
 * Sanitize and return TrustedHTML for strict CSP environments
 */
export function sanitizeHtmlStrict(dirty: string): TrustedHTML {
  return DOMPurify.sanitize(dirty, {
    ...SANITIZE_CONFIG,
    RETURN_TRUSTED_TYPE: true,
  }) as TrustedHTML;
}

/**
 * Strip all HTML tags, return plain text only
 * Use for search indexing, previews, etc.
 */
export function stripHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] });
}
```

### Strict Mode for Rich Text

```typescript
// src/lib/sanitize-rich-text.ts
import DOMPurify from "dompurify";

// More permissive config for rich text editor content
const RICH_TEXT_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    // Headings
    "h1", "h2", "h3", "h4", "h5", "h6",
    // Text structure
    "p", "br", "hr", "div", "span",
    // Lists
    "ul", "ol", "li", "dl", "dt", "dd",
    // Formatting
    "strong", "b", "em", "i", "u", "s", "mark", "sub", "sup",
    // Code
    "code", "pre", "kbd", "samp",
    // Quotes
    "blockquote", "q", "cite",
    // Media
    "img", "figure", "figcaption",
    // Links
    "a",
    // Tables
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  ],
  ALLOWED_ATTR: [
    "href", "src", "alt", "title", "class", "id",
    "target", "rel",
    "colspan", "rowspan", "scope",
    "width", "height",
    "data-slate-node", "data-slate-leaf", // Plate.js attributes
  ],
  // Force rel="noopener noreferrer" on links
  ADD_ATTR: ["target"],
  FORBID_TAGS: ["script", "style", "iframe", "form", "input", "button"],
  FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover"],
};

export function sanitizeRichText(dirty: string): string {
  // Add hooks for link safety
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("rel", "noopener noreferrer");
      if (node.getAttribute("target") === "_blank") {
        // Already has rel from above
      }
    }
  });

  const clean = DOMPurify.sanitize(dirty, RICH_TEXT_CONFIG);
  
  // Remove hooks to avoid affecting other sanitizations
  DOMPurify.removeHook("afterSanitizeAttributes");
  
  return clean;
}
```

---

## Plate.js Serialization

### Safe HTML Serialization

```typescript
// src/lib/plate/serialize.ts
import {
  serializeHtml,
  type PlateEditor,
} from "@udecode/plate";
import { sanitizeRichText } from "@/lib/sanitize-rich-text";

/**
 * Serialize Plate editor content to sanitized HTML
 * Use when storing or displaying content
 */
export function serializeToSafeHtml(editor: PlateEditor): string {
  const rawHtml = serializeHtml(editor, {
    nodes: editor.children,
    // Add your Plate plugins here
  });
  
  // ALWAYS sanitize before storage/display
  return sanitizeRichText(rawHtml);
}

/**
 * Get plain text from editor for previews/search
 */
export function serializeToPlainText(editor: PlateEditor): string {
  return editor.children
    .map((node) => getNodeText(node))
    .join("\n")
    .trim();
}

function getNodeText(node: any): string {
  if (typeof node.text === "string") return node.text;
  if (Array.isArray(node.children)) {
    return node.children.map(getNodeText).join("");
  }
  return "";
}
```

### Storing Content Safely

```typescript
// convex/lessons.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const updateContent = mutation({
  args: {
    lessonId: v.id("lessons"),
    // Store as JSON, not HTML - safer and more flexible
    content: v.string(), // JSON stringified Plate content
    // Optionally store sanitized HTML for display
    htmlContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) throw new Error("Lesson not found");
    
    // Verify ownership/permission
    if (lesson.authorId !== user._id) {
      throw new Error("Forbidden: Cannot edit this lesson");
    }
    
    // Store the raw JSON content (safe, no XSS risk)
    // HTML sanitization happens on the client before display
    await ctx.db.patch(args.lessonId, {
      content: args.content,
      htmlContent: args.htmlContent, // Pre-sanitized on client
      updatedAt: Date.now(),
    });
  },
});
```

---

## Safe Render Patterns

### ❌ NEVER Do This

```typescript
// DANGEROUS: Never render unsanitized HTML
function DangerousComponent({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

### ✅ Always Sanitize

```typescript
// src/components/safe-html.tsx
"use client";

import { useMemo } from "react";
import { sanitizeHtml } from "@/lib/sanitize";

interface SafeHtmlProps {
  html: string;
  className?: string;
}

export function SafeHtml({ html, className }: SafeHtmlProps) {
  const sanitized = useMemo(() => sanitizeHtml(html), [html]);
  
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
```

### Plate.js Content Display

```typescript
// src/components/lesson-content.tsx
"use client";

import { useMemo } from "react";
import { createPlateEditor, Plate, PlateContent } from "@udecode/plate";
import { sanitizeRichText } from "@/lib/sanitize-rich-text";
import { plugins } from "@/lib/plate/plugins";

interface LessonContentProps {
  // JSON content from database
  content: string;
  // Fallback HTML (already sanitized on save)
  htmlContent?: string;
}

export function LessonContent({ content, htmlContent }: LessonContentProps) {
  // Option 1: Render with Plate (preferred - maintains interactivity)
  const editor = useMemo(() => {
    try {
      const parsed = JSON.parse(content);
      return createPlateEditor({
        plugins,
        value: parsed,
      });
    } catch {
      return null;
    }
  }, [content]);
  
  if (editor) {
    return (
      <Plate editor={editor} readOnly>
        <PlateContent className="prose" />
      </Plate>
    );
  }
  
  // Option 2: Fallback to sanitized HTML
  if (htmlContent) {
    const sanitized = useMemo(
      () => sanitizeRichText(htmlContent),
      [htmlContent]
    );
    
    return (
      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    );
  }
  
  return <p className="text-muted-foreground">No content available</p>;
}
```

---

## Content Security Policy

### Next.js CSP Configuration

```typescript
// next.config.ts
import type { NextConfig } from "next";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://clerk.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https:;
  font-src 'self';
  connect-src 'self' https://*.convex.cloud https://clerk.com;
  frame-ancestors 'none';
  form-action 'self';
  base-uri 'self';
`;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(/\n/g, " ").trim(),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### Trusted Types (Advanced)

```typescript
// src/lib/trusted-types.ts
// For browsers supporting Trusted Types API

if (typeof window !== "undefined" && window.trustedTypes) {
  window.trustedTypes.createPolicy("default", {
    createHTML: (input) => {
      // Use DOMPurify for all HTML creation
      return DOMPurify.sanitize(input);
    },
    createScriptURL: (input) => {
      // Only allow same-origin scripts
      const url = new URL(input, window.location.origin);
      if (url.origin === window.location.origin) {
        return input;
      }
      throw new Error("Blocked script from external origin");
    },
  });
}
```
