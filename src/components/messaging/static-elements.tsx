"use client";

/**
 * Static Plate.js elements for message rendering.
 *
 * Contains simpler static components:
 * - MessageParagraphStatic - Compact paragraph element
 * - MessageLinkStatic - Link element with XSS protection
 * - MessageCodeStatic - Inline code element
 *
 * These components are used with PlateStatic for read-only rendering
 * of rich text content in messages.
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
// MessageParagraphStatic
// ============================================================================

export interface MessageParagraphStaticProps
  extends React.ComponentPropsWithoutRef<"p"> {
  children?: React.ReactNode;
  element?: unknown;
  attributes?: Record<string, unknown>;
}

/**
 * Compact paragraph element for message context.
 * Uses tighter spacing than the standard editor paragraph.
 */
export function MessageParagraphStatic(
  props: MessageParagraphStaticProps
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

// ============================================================================
// MessageLinkStatic
// ============================================================================

export interface MessageLinkStaticProps
  extends React.ComponentPropsWithoutRef<"a"> {
  children?: React.ReactNode;
  element?: { url?: string };
  attributes?: Record<string, unknown>;
}

/**
 * Link element for message context.
 * Clickable with visual distinction.
 *
 * SECURITY: Sanitizes URL to prevent XSS attacks via javascript: URLs.
 * Only allows http: and https: protocols.
 */
export function MessageLinkStatic(
  props: MessageLinkStaticProps
): React.ReactElement {
  const { children, element, attributes, ...rest } = props;
  const rawUrl = element?.url ?? "#";

  // SECURITY: Sanitize URL - only allow http/https protocols
  const url = React.useMemo(() => sanitizeUrl(rawUrl), [rawUrl]);

  // Filter out Plate.js internal methods before spreading to DOM
  const domSafeProps = filterPlatejsProps(rest);

  return (
    <a
      data-slot="message-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline decoration-primary/50 underline-offset-2 hover:decoration-primary"
      {...attributes}
      {...domSafeProps}
    >
      {children}
    </a>
  );
}

// ============================================================================
// MessageCodeStatic
// ============================================================================

export interface MessageCodeStaticProps
  extends React.ComponentPropsWithoutRef<"code"> {
  children?: React.ReactNode;
  leaf?: unknown;
  attributes?: Record<string, unknown>;
}

/**
 * Inline code element for message context.
 */
export function MessageCodeStatic(
  props: MessageCodeStaticProps
): React.ReactElement {
  const { children, leaf: _leaf, attributes, ...rest } = props;

  // Filter out Plate.js internal methods before spreading to DOM
  const domSafeProps = filterPlatejsProps(rest);

  return (
    <code
      data-slot="message-code"
      className="rounded bg-muted px-1 py-0.5 font-mono text-xs"
      {...attributes}
      {...domSafeProps}
    >
      {children}
    </code>
  );
}
