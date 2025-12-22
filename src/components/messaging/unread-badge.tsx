import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const unreadBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-full font-medium text-white bg-destructive",
  {
    variants: {
      size: {
        default: "h-5 min-w-5 px-1.5 text-xs",
        sm: "h-4 min-w-4 px-1 text-[10px]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export interface UnreadBadgeProps
  extends VariantProps<typeof unreadBadgeVariants> {
  count: number;
  max?: number;
  className?: string;
}

export function UnreadBadge({
  count,
  max = 99,
  size,
  className,
}: UnreadBadgeProps): React.ReactElement | null {
  if (count <= 0) {
    return null;
  }

  const displayCount = count > max ? `${max}+` : String(count);
  const ariaLabel = count > max
    ? `more than ${max} unread messages`
    : `${count} unread ${count === 1 ? "message" : "messages"}`;

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn(unreadBadgeVariants({ size }), className)}
    >
      {displayCount}
    </span>
  );
}
