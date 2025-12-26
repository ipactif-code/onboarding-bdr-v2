"use client";

/**
 * Static Plate.js components for message rendering.
 *
 * These components are used with PlateStatic for read-only rendering
 * of rich text content in messages. They provide compact styling
 * optimized for messaging contexts.
 */

import * as React from "react";
import { filterPlatejsProps } from "@/lib/plate-utils";

// ============================================================================
// URL Sanitization (XSS Prevention)
// ============================================================================

/**
 * Sanitizes a URL to prevent XSS attacks via javascript: or other dangerous protocols.
 * Only allows http: and https: protocols.
 *
 * @param rawUrl - The raw URL to sanitize
 * @returns A safe URL (http/https) or "#" if the URL is invalid/dangerous
 */
function sanitizeUrl(rawUrl: string): string {
  try {
    const urlObj = new URL(rawUrl);
    // SECURITY: Only allow http and https protocols
    // Block javascript:, data:, file:, vbscript:, etc.
    if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
      return rawUrl;
    }
    return "#";
  } catch {
    // Invalid URL - return safe no-op
    return "#";
  }
}

// ============================================================================
// Static Components for Message Rendering (Compact Variants)
// ============================================================================

/**
 * Compact paragraph element for message context.
 * Uses tighter spacing than the standard editor paragraph.
 */
export function MessageParagraphStatic(
  props: React.ComponentPropsWithoutRef<"p"> & {
    children?: React.ReactNode;
    element?: unknown;
    attributes?: Record<string, unknown>;
  }
): React.ReactElement {
  const { children, element: _element, attributes, ...rest } = props;
  // Filter out Plate.js internal methods (setOption, setOptions, getOption, getOptions)
  // that should not be passed to DOM elements
  const domSafeProps = filterPlatejsProps(rest);
  return (
    <p
      data-slot="message-paragraph"
      className="m-0 py-0.5 leading-relaxed"
      {...attributes}
      {...domSafeProps}
    >
      {children}
    </p>
  );
}

/**
 * Link element for message context.
 * Clickable with visual distinction.
 *
 * SECURITY: Sanitizes URL to prevent XSS attacks via javascript: URLs.
 * Only allows http: and https: protocols.
 */
export function MessageLinkStatic(
  props: React.ComponentPropsWithoutRef<"a"> & {
    children?: React.ReactNode;
    element?: { url?: string };
    attributes?: Record<string, unknown>;
  }
): React.ReactElement {
  const { children, element, attributes, ...rest } = props;
  const rawUrl = element?.url ?? "#";

  // SECURITY: Sanitize URL - only allow http/https protocols
  const url = React.useMemo(() => sanitizeUrl(rawUrl), [rawUrl]);

  return (
    <a
      data-slot="message-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline decoration-primary/50 underline-offset-2 hover:decoration-primary"
      {...attributes}
      {...rest}
    >
      {children}
    </a>
  );
}

/**
 * Mention element for message context.
 * Displays @username with subtle styling.
 */
export function MessageMentionStatic(
  props: React.ComponentPropsWithoutRef<"span"> & {
    children?: React.ReactNode;
    element?: { value?: string };
    attributes?: Record<string, unknown>;
  }
): React.ReactElement {
  const { children, element, attributes, ...rest } = props;
  const value = element?.value ?? "";

  return (
    <span
      data-slot="message-mention"
      data-mention-value={value}
      className="inline rounded bg-primary/10 px-1 py-0.5 font-medium text-primary"
      {...attributes}
      {...rest}
    >
      {children}@{value}
    </span>
  );
}

/**
 * Inline code element for message context.
 */
export function MessageCodeStatic(
  props: React.ComponentPropsWithoutRef<"code"> & {
    children?: React.ReactNode;
    leaf?: unknown;
    attributes?: Record<string, unknown>;
  }
): React.ReactElement {
  const { children, leaf: _leaf, attributes, ...rest } = props;
  return (
    <code
      data-slot="message-code"
      className="rounded bg-muted px-1 py-0.5 font-mono text-xs"
      {...attributes}
      {...rest}
    >
      {children}
    </code>
  );
}
