"use client";

import * as React from "react";

import { CheckIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { filterPlatejsProps } from "@/lib/plate-utils";
import { Button } from "@/components/ui/button";

// ============================================================================
// Types
// ============================================================================

export interface CodeBlockMessageProps {
  /**
   * The code content to display.
   */
  children?: React.ReactNode;
  /**
   * The programming language for syntax highlighting.
   * If not provided, no language label is shown.
   */
  language?: string;
  /**
   * Additional CSS classes to apply to the container.
   */
  className?: string;
}

// ============================================================================
// Language Display Names
// ============================================================================

const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  csharp: "C#",
  cpp: "C++",
  c: "C",
  go: "Go",
  rust: "Rust",
  ruby: "Ruby",
  php: "PHP",
  swift: "Swift",
  kotlin: "Kotlin",
  scala: "Scala",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  sql: "SQL",
  json: "JSON",
  yaml: "YAML",
  xml: "XML",
  markdown: "Markdown",
  bash: "Bash",
  shell: "Shell",
  powershell: "PowerShell",
  dockerfile: "Docker",
  plaintext: "Plain Text",
  auto: "Auto",
};

/**
 * Gets a display-friendly name for a language code.
 */
function getLanguageDisplayName(lang: string | undefined): string | undefined {
  if (!lang || lang === "plaintext" || lang === "auto") {
    return undefined;
  }
  return LANGUAGE_DISPLAY_NAMES[lang.toLowerCase()] ?? lang;
}

// ============================================================================
// Copy Button Component
// ============================================================================

interface CopyButtonProps {
  value: string;
  className?: string;
}

function CopyButton({ value, className }: CopyButtonProps): React.ReactElement {
  const [hasCopied, setHasCopied] = React.useState(false);

  React.useEffect(() => {
    if (!hasCopied) return;

    const timeout = setTimeout(() => {
      setHasCopied(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [hasCopied]);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setHasCopied(true);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = value;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setHasCopied(true);
      } catch {
        toast.error("Failed to copy code");
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      className={cn(
        "size-6 text-muted-foreground hover:text-foreground",
        className
      )}
      title={hasCopied ? "Copied!" : "Copy code"}
      aria-label={hasCopied ? "Copied to clipboard" : "Copy code"}
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="sr-only">{hasCopied ? "Copied" : "Copy code"}</span>
      {hasCopied ? (
        <CheckIcon className="size-3.5" />
      ) : (
        <CopyIcon className="size-3.5" />
      )}
    </Button>
  );
}

// ============================================================================
// CodeBlockMessage Component
// ============================================================================

/**
 * Compact code block component for displaying code in messages.
 *
 * Features:
 * - Syntax highlighting via highlight.js CSS classes (hljs-*)
 * - Copy button in top-right corner
 * - Language label when provided
 * - Dark-friendly styling that works in both light and dark modes
 * - Compact styling optimized for message context
 *
 * This component renders pre-highlighted code from Plate.js code block nodes.
 * The syntax highlighting is applied through hljs-* CSS classes on child elements.
 *
 * @example
 * ```tsx
 * // With Plate.js content (already highlighted)
 * <CodeBlockMessage language="typescript">
 *   <span className="hljs-keyword">const</span> x = 1;
 * </CodeBlockMessage>
 *
 * // Plain code (no highlighting)
 * <CodeBlockMessage language="javascript">
 *   console.log("Hello");
 * </CodeBlockMessage>
 * ```
 */
export function CodeBlockMessage({
  children,
  language,
  className,
}: CodeBlockMessageProps): React.ReactElement {
  const codeRef = React.useRef<HTMLElement>(null);
  const displayName = getLanguageDisplayName(language);

  // Extract plain text from children for copy functionality
  const getCodeText = React.useCallback((): string => {
    if (codeRef.current) {
      return codeRef.current.textContent ?? "";
    }
    return "";
  }, []);

  return (
    <div
      data-slot="code-block-message"
      className={cn(
        // Container styling
        "group/code relative my-1 rounded-md bg-muted/60 dark:bg-muted/40",
        // Syntax highlighting styles (matching Plate.js code block)
        // These use the ** selector to apply to any nested hljs-* classes
        "**:[.hljs-addition]:bg-[#f0fff4] **:[.hljs-addition]:text-[#22863a]",
        "dark:**:[.hljs-addition]:bg-[#3c5743] dark:**:[.hljs-addition]:text-[#ceead5]",
        "**:[.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-variable]:text-[#005cc5]",
        "dark:**:[.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id,.hljs-variable]:text-[#6596cf]",
        "**:[.hljs-built_in,.hljs-symbol]:text-[#e36209]",
        "dark:**:[.hljs-built_in,.hljs-symbol]:text-[#c3854e]",
        "**:[.hljs-bullet]:text-[#735c0f]",
        "**:[.hljs-comment,.hljs-code,.hljs-formula]:text-[#6a737d]",
        "dark:**:[.hljs-comment,.hljs-code,.hljs-formula]:text-[#6a737d]",
        "**:[.hljs-deletion]:bg-[#ffeef0] **:[.hljs-deletion]:text-[#b31d28]",
        "dark:**:[.hljs-deletion]:bg-[#473235] dark:**:[.hljs-deletion]:text-[#e7c7cb]",
        "**:[.hljs-emphasis]:italic",
        "**:[.hljs-keyword,.hljs-doctag,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_]:text-[#d73a49]",
        "dark:**:[.hljs-keyword,.hljs-doctag,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_]:text-[#ee6960]",
        "**:[.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo]:text-[#22863a]",
        "dark:**:[.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo]:text-[#36a84f]",
        "**:[.hljs-regexp,.hljs-string,.hljs-meta_.hljs-string]:text-[#032f62]",
        "dark:**:[.hljs-regexp,.hljs-string,.hljs-meta_.hljs-string]:text-[#3593ff]",
        "**:[.hljs-section]:font-bold **:[.hljs-section]:text-[#005cc5]",
        "dark:**:[.hljs-section]:text-[#61a5f2]",
        "**:[.hljs-strong]:font-bold",
        "**:[.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_]:text-[#6f42c1]",
        "dark:**:[.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_]:text-[#a77bfa]",
        className
      )}
    >
      {/* Header with language label and copy button */}
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-1">
        <span className="text-xs text-muted-foreground">
          {displayName ?? "Code"}
        </span>
        <CopyButton value={getCodeText()} />
      </div>

      {/* Code content */}
      <pre
        className="overflow-x-auto p-3 font-mono text-xs leading-relaxed [tab-size:2]"
        aria-label={displayName ? `${displayName} code block` : "Code block"}
      >
        <code ref={codeRef}>{children}</code>
      </pre>
    </div>
  );
}

// ============================================================================
// Plate.js Static Components for Message Rendering
// ============================================================================

/**
 * Static code block element for Plate.js PlateStatic rendering.
 * Wraps children in CodeBlockMessage with language support.
 */
export function MessageCodeBlockStatic(
  props: React.ComponentPropsWithoutRef<"div"> & {
    children?: React.ReactNode;
    element?: { lang?: string };
    attributes?: Record<string, unknown>;
  }
): React.ReactElement {
  const { children, element, attributes, ...rest } = props;
  const language = element?.lang;

  // Filter out Plate.js internal methods before spreading to DOM
  const domSafeProps = filterPlatejsProps(rest);

  return (
    <CodeBlockMessage language={language} {...attributes} {...domSafeProps}>
      {children}
    </CodeBlockMessage>
  );
}

/**
 * Static code line element for Plate.js PlateStatic rendering.
 * Renders as a simple div to preserve line structure.
 */
export function MessageCodeLineStatic(
  props: React.ComponentPropsWithoutRef<"div"> & {
    children?: React.ReactNode;
    element?: unknown;
    attributes?: Record<string, unknown>;
  }
): React.ReactElement {
  const { children, element: _element, attributes, ...rest } = props;

  // Filter out Plate.js internal methods before spreading to DOM
  const domSafeProps = filterPlatejsProps(rest);

  return (
    <div data-slot="code-line" {...attributes} {...domSafeProps}>
      {children}
    </div>
  );
}

/**
 * Static code syntax leaf for Plate.js PlateStatic rendering.
 * Applies the hljs-* className for syntax highlighting.
 */
export function MessageCodeSyntaxLeafStatic(
  props: React.ComponentPropsWithoutRef<"span"> & {
    children?: React.ReactNode;
    leaf?: { className?: string };
    attributes?: Record<string, unknown>;
  }
): React.ReactElement {
  const { children, leaf, attributes, ...rest } = props;
  const tokenClassName = leaf?.className as string | undefined;

  // Filter out Plate.js internal methods before spreading to DOM
  const domSafeProps = filterPlatejsProps(rest);

  return (
    <span className={tokenClassName} {...attributes} {...domSafeProps}>
      {children}
    </span>
  );
}
