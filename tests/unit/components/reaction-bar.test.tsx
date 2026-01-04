import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ReactionBar,
  type ReactionGroup,
} from "@/components/messaging/reaction-bar";
import type { Id } from "../../../convex/_generated/dataModel";

// ============================================================================
// Mocks
// ============================================================================

// Create mock functions
const mockAddReaction = vi.fn();
const mockRemoveReaction = vi.fn();

// Mock Convex React hooks
vi.mock("convex/react", () => ({
  useMutation: vi.fn((_api) => {
    // Return mockAddReaction for both mutations (they're called from same hook)
    return mockAddReaction;
  }),
  useQuery: vi.fn(() => {
    // Return user names data
    return [
      { userId: "user1" as Id<"users">, name: "Alice" },
      { userId: "user2" as Id<"users">, name: "Bob" },
      { userId: "user3" as Id<"users">, name: "Charlie" },
    ];
  }),
}));

// Mock Button component
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    "aria-label": ariaLabel,
    "aria-pressed": ariaPressed,
    type,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    "aria-label"?: string;
    "aria-pressed"?: boolean;
    type?: "button" | "submit" | "reset";
    [key: string]: unknown;
  }) => (
    <button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      {...props}
    >
      {children}
    </button>
  ),
}));

// Mock Tooltip
vi.mock("@/components/ui-plate/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({
    asChild: _asChild,
    children,
  }: {
    asChild?: boolean;
    children: React.ReactNode;
  }) => <div data-tooltip-trigger>{children}</div>,
  TooltipContent: ({
    children,
  }: {
    children: React.ReactNode;
  }) => (
    <div data-tooltip-content>
      {children}
    </div>
  ),
}));

// Mock EmojiPicker - simplified
vi.mock("@/components/messaging/emoji-picker", () => ({
  EmojiPicker: () => null, // Simplified for testing
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

// ============================================================================
// Test Data
// ============================================================================

const sampleReactions: ReactionGroup[] = [
  {
    emoji: "👍",
    count: 3,
    userIds: [
      "user1" as Id<"users">,
      "user2" as Id<"users">,
      "user3" as Id<"users">,
    ],
    currentUserReacted: true,
  },
  {
    emoji: "❤️",
    count: 1,
    userIds: ["user4" as Id<"users">],
    currentUserReacted: false,
  },
];

const messageId = "msg123" as Id<"messages">;

// ============================================================================
// Tests
// ============================================================================

describe("ReactionBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddReaction.mockResolvedValue(undefined);
    mockRemoveReaction.mockResolvedValue(undefined);
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  it("should render reactions with correct counts", () => {
    // Arrange & Act
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Assert
    expect(screen.getByText("👍")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("❤️")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("should render empty state with container", () => {
    // Arrange & Act
    render(<ReactionBar messageId={messageId} reactions={[]} />);

    // Assert
    const container = screen.getByRole("group", { name: /message reactions/i });
    expect(container).toBeInTheDocument();
  });

  // ==========================================================================
  // User's Own Reactions Highlighting
  // ==========================================================================

  it("should highlight current user's reactions with primary styling", () => {
    // Arrange & Act
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Assert - First reaction (currentUserReacted: true)
    const thumbsUpButton = screen.getByRole("button", {
      name: /👍 reaction.*you reacted/i,
    });
    expect(thumbsUpButton).toBeInTheDocument();
    expect(thumbsUpButton.className).toMatch(/bg-primary\/10/);
    expect(thumbsUpButton.className).toMatch(/text-primary/);
    expect(thumbsUpButton).toHaveAttribute("aria-pressed", "true");
  });

  it("should not highlight other users' reactions", () => {
    // Arrange & Act
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Assert - Second reaction (currentUserReacted: false)
    const heartButton = screen.getByRole("button", {
      name: /❤️ reaction.*1 person$/i,
    });
    expect(heartButton).toBeInTheDocument();
    expect(heartButton.className).not.toMatch(/bg-primary\/10/);
    expect(heartButton.className).not.toMatch(/text-primary/);
    expect(heartButton).toHaveAttribute("aria-pressed", "false");
  });

  // ==========================================================================
  // Interaction Tests
  // ==========================================================================

  it("should render clickable reaction buttons", async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Act
    const thumbsUpButton = screen.getByRole("button", {
      name: /👍 reaction/i,
    });
    await user.click(thumbsUpButton);

    // Assert - Button is interactive
    expect(thumbsUpButton).toBeInTheDocument();
  });

  // ==========================================================================
  // Tooltip Tests
  // ==========================================================================

  it("should render tooltip content with user names", () => {
    // Arrange & Act
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Assert - Tooltip content should contain names
    const tooltipContent = screen.getAllByText(/Alice, Bob, Charlie/i)[0];
    expect(tooltipContent).toBeInTheDocument();
  });

  it("should show correct pluralization in aria-label", () => {
    // Arrange
    const singleReaction: ReactionGroup[] = [
      {
        emoji: "🔥",
        count: 1,
        userIds: ["user1" as Id<"users">],
        currentUserReacted: false,
      },
    ];

    // Act
    render(<ReactionBar messageId={messageId} reactions={singleReaction} />);

    // Assert - Should say "1 person" not "1 people"
    expect(
      screen.getByRole("button", { name: /🔥 reaction, 1 person$/i })
    ).toBeInTheDocument();
  });

  it("should show correct pluralization for multiple people", () => {
    // Arrange & Act
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Assert - Should say "3 people"
    expect(
      screen.getByRole("button", { name: /👍 reaction, 3 people/i })
    ).toBeInTheDocument();
  });

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  it("should have proper aria-labels on reaction buttons", () => {
    // Arrange & Act
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Assert
    expect(
      screen.getByRole("button", {
        name: /👍 reaction, 3 people, you reacted/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /❤️ reaction, 1 person$/i,
      })
    ).toBeInTheDocument();
  });

  it("should have aria-pressed state for user's reactions", () => {
    // Arrange & Act
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Assert
    const thumbsUpButton = screen.getByRole("button", {
      name: /👍 reaction/i,
    });
    const heartButton = screen.getByRole("button", {
      name: /❤️ reaction/i,
    });

    expect(thumbsUpButton).toHaveAttribute("aria-pressed", "true");
    expect(heartButton).toHaveAttribute("aria-pressed", "false");
  });

  it("should meet WCAG 2.5.5 touch target size (44px)", () => {
    // Arrange & Act
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Assert - All reaction buttons should have min-h-11 min-w-11 (44px)
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button.className).toMatch(/min-h-11/);
      expect(button.className).toMatch(/min-w-11/);
    });
  });

  it("should have role=group with proper label", () => {
    // Arrange & Act
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Assert
    const container = screen.getByRole("group", { name: /message reactions/i });
    expect(container).toBeInTheDocument();
  });

  it("should have tabular-nums class for consistent number width", () => {
    // Arrange & Act
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Assert - Count spans should have tabular-nums
    const countElements = screen.getAllByText(/^[0-9]+$/);
    countElements.forEach((element) => {
      expect(element.className).toMatch(/tabular-nums/);
    });
  });

  it("should have aria-hidden on emoji spans", () => {
    // Arrange & Act
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Assert - Emoji spans should be aria-hidden (icon-like)
    const emojiSpans = screen.getAllByText(/[👍❤️]/);
    emojiSpans.forEach((span) => {
      expect(span).toHaveAttribute("aria-hidden", "true");
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  it("should apply custom className", () => {
    // Arrange & Act
    const { container } = render(
      <ReactionBar
        messageId={messageId}
        reactions={sampleReactions}
        className="custom-class"
      />
    );

    // Assert
    const reactionBar = container.querySelector('[data-slot="reaction-bar"]');
    expect(reactionBar).toHaveClass("custom-class");
  });

  it("should render with no reactions", () => {
    // Arrange & Act
    render(<ReactionBar messageId={messageId} reactions={[]} />);

    // Assert - Should still render container
    const container = screen.getByRole("group");
    expect(container).toBeInTheDocument();
  });

  it("should handle many reactions", () => {
    // Arrange
    const manyReactions: ReactionGroup[] = Array.from({ length: 10 }, (_, i) => ({
      emoji: String.fromCodePoint(0x1f600 + i),
      count: i + 1,
      userIds: [`user${i}` as Id<"users">],
      currentUserReacted: i % 2 === 0,
    }));

    // Act
    render(<ReactionBar messageId={messageId} reactions={manyReactions} />);

    // Assert - All 10 reaction buttons should render
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(10);
  });

  it("should show currentUserReacted styling correctly", () => {
    // Arrange
    const mixedReactions: ReactionGroup[] = [
      {
        emoji: "🎉",
        count: 2,
        userIds: ["u1" as Id<"users">, "u2" as Id<"users">],
        currentUserReacted: true,
      },
      {
        emoji: "🚀",
        count: 1,
        userIds: ["u3" as Id<"users">],
        currentUserReacted: false,
      },
    ];

    // Act
    render(<ReactionBar messageId={messageId} reactions={mixedReactions} />);

    // Assert
    const ownReaction = screen.getByRole("button", { name: /🎉.*you reacted/i });
    const otherReaction = screen.getByRole("button", { name: /🚀 reaction, 1 person$/i });

    expect(ownReaction).toHaveAttribute("aria-pressed", "true");
    expect(otherReaction).toHaveAttribute("aria-pressed", "false");

    expect(ownReaction.className).toMatch(/bg-primary/);
    expect(otherReaction.className).not.toMatch(/bg-primary/);
  });

  it("should have proper button type attribute", () => {
    // Arrange & Act
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Assert - All buttons should have type="button"
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toHaveAttribute("type", "button");
    });
  });

  it("should render all reaction data correctly", () => {
    // Arrange & Act
    render(
      <ReactionBar messageId={messageId} reactions={sampleReactions} />
    );

    // Assert - Verify each reaction is rendered with correct data
    const reactions = screen.getAllByRole("button");

    // First reaction: 👍 with 3 people, user reacted
    expect(reactions[0]).toHaveTextContent("👍");
    expect(reactions[0]).toHaveTextContent("3");
    expect(reactions[0]).toHaveAttribute("aria-pressed", "true");

    // Second reaction: ❤️ with 1 person, user didn't react
    expect(reactions[1]).toHaveTextContent("❤️");
    expect(reactions[1]).toHaveTextContent("1");
    expect(reactions[1]).toHaveAttribute("aria-pressed", "false");
  });
});
