"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface ShortcutItem {
  format: string;
  syntax: string;
  result: string;
}

const FORMATTING_SHORTCUTS: ShortcutItem[] = [
  { format: "Bold", syntax: "**text**", result: "text" },
  { format: "Italic", syntax: "*text*", result: "text" },
  { format: "Code", syntax: "`code`", result: "code" },
  { format: "Strikethrough", syntax: "~~text~~", result: "text" },
];

const LIST_SHORTCUTS: ShortcutItem[] = [
  { format: "Bullet list", syntax: "* item", result: "- item" },
  { format: "Numbered list", syntax: "1. item", result: "1. item" },
];

const OTHER_SHORTCUTS: ShortcutItem[] = [
  { format: "Link", syntax: "https://example.com", result: "Auto-detected" },
  { format: "Mention", syntax: "@username", result: "User mention" },
  { format: "Line break", syntax: "Shift + Enter", result: "New line" },
];

interface MarkdownHelpDialogProps {
  triggerClassName?: string;
}

export function MarkdownHelpDialog({
  triggerClassName,
}: MarkdownHelpDialogProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={triggerClassName}
            aria-label="Show markdown formatting help"
          />
        }
      >
        <HelpCircle className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Formatting Shortcuts</DialogTitle>
          <DialogDescription>
            Use these shortcuts to format your messages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ShortcutSection title="Text Formatting" items={FORMATTING_SHORTCUTS} />
          <ShortcutSection title="Lists" items={LIST_SHORTCUTS} />
          <ShortcutSection title="Other" items={OTHER_SHORTCUTS} />
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

interface ShortcutSectionProps {
  title: string;
  items: ShortcutItem[];
}

function ShortcutSection({ title, items }: ShortcutSectionProps): React.ReactElement {
  return (
    <div data-slot="shortcut-section">
      <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </p>
      <Table>
        <caption className="sr-only">{title} shortcuts</caption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Format</TableHead>
            <TableHead>Syntax</TableHead>
            <TableHead className="text-right">Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.format}>
              <TableCell className="font-medium">{item.format}</TableCell>
              <TableCell>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {item.syntax}
                </code>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {item.format === "Bold" && <strong>{item.result}</strong>}
                {item.format === "Italic" && <em>{item.result}</em>}
                {item.format === "Code" && (
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {item.result}
                  </code>
                )}
                {item.format === "Strikethrough" && <s>{item.result}</s>}
                {!["Bold", "Italic", "Code", "Strikethrough"].includes(item.format) && item.result}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function MarkdownHelpTrigger({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}): React.ReactElement {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={onClick}
      aria-label="Show markdown formatting help"
    >
      <HelpCircle className="size-4" />
    </Button>
  );
}
